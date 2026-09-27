import { after } from "next/server";
import { syncGmail } from "@/lib/channels";
import { safeEqual } from "@/lib/crypto";
import { processInboundInBackground } from "@/lib/pipeline/process";

export const maxDuration = 120;

/**
 * Gmail の新着通知（Google Cloud Pub/Sub のプッシュ）の受け口。
 * 通知には「新着がある」ことしか含まれないため、Gmail API で差分を取りにいく。
 * プッシュ先 URL の ?token= が GMAIL_PUSH_TOKEN と一致しない通知は破棄する。
 */
export async function POST(request: Request) {
  const expected = process.env.GMAIL_PUSH_TOKEN;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!expected || !safeEqual(token, expected)) return new Response("forbidden", { status: 403 });

  try {
    const { inboundIds } = await syncGmail();
    after(async () => {
      for (const id of inboundIds) await processInboundInBackground(id);
    });
  } catch (error) {
    console.error("[gmail] sync from push failed", error);
    // 200 以外を返すと Pub/Sub が再送を続けるため、失敗は記録して 200 を返す（次の同期で取り直せる）
  }
  return new Response("ok");
}
