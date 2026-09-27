import { randomUUID } from "node:crypto";
import { AiError } from "@/lib/ai/errors";
import { CATEGORY_LABEL, PRIORITY_LABEL } from "@/lib/domain";
import { formInputSchema, normalizeForm } from "@/lib/ingestion";
import { MEMBERS } from "@/lib/nexora";
import { processInbound, recordInbound } from "@/lib/pipeline/process";
import { clientKey, consume, envLimit, RateLimitError } from "@/lib/rate-limit";
import { getRequestDTO } from "@/lib/services/requests";
import type { FormEvent } from "@/lib/types";

export const maxDuration = 90;

const ndjson = (events: FormEvent[], status = 200) =>
  new Response(events.map((e) => `${JSON.stringify(e)}\n`).join(""), {
    status,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });

/**
 * 公開の依頼フォーム。受信を保存して AI で分析し、進み具合を NDJSON で返す。
 * 送信者には社内の詳細（要約・担当者名など）は出さず、受付部署・重要度・期限だけを返す。
 */
export async function POST(request: Request) {
  const parsed = formInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return ndjson([{ type: "error", code: "validation", detail: parsed.error.issues[0]?.message }], 400);
  }
  // ボット対策：人には見えない項目に入力があれば、受け付けたように見せて破棄する
  if (parsed.data.website) {
    return ndjson([{ type: "done", result: { categoryLabel: "", priorityLabel: "", department: null, dueDate: null } }]);
  }
  try {
    await consume(`form:${clientKey(request)}`, envLimit("FORM_LIMIT_PER_HOUR", 5), 60 * 60 * 1000);
  } catch (error) {
    if (error instanceof RateLimitError) return ndjson([{ type: "error", code: "rate_limited" }], 429);
    throw error;
  }

  const message = normalizeForm(parsed.data);
  const { id } = await recordInbound(message, randomUUID());
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: FormEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false; // 送信者がページを閉じても、分析と登録は最後まで行う
        }
      };
      try {
        const requestId = await processInbound(id, { onStep: (step) => send({ type: "step", step }) });
        send({ type: "step", step: "register" });
        const r = await getRequestDTO(requestId);
        const member = MEMBERS.find((m) => m.id === r.assigneeId);
        send({
          type: "done",
          result: {
            categoryLabel: CATEGORY_LABEL[r.category],
            priorityLabel: PRIORITY_LABEL[r.priority],
            department: member?.department ?? null,
            dueDate: r.dueDate,
          },
        });
      } catch (error) {
        // 受信は保存済みなので、AI 分析に失敗してもオーナーが画面から再分析できる
        send({ type: "error", code: error instanceof AiError ? error.code : "internal" });
      } finally {
        open = false;
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}
