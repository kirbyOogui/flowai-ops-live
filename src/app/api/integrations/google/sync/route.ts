import { after } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { syncGmail } from "@/lib/channels";
import { toErrorResponse } from "@/lib/http";
import { processInboundInBackground } from "@/lib/pipeline/process";

export const maxDuration = 120;

/** 画面の「今すぐ受信」：Gmail の新着を取り込み、AI 分析は応答後に行う */
export async function POST() {
  try {
    await requireAdmin();
    const result = await syncGmail();
    after(async () => {
      for (const id of result.inboundIds) await processInboundInBackground(id);
    });
    return Response.json({ imported: result.inboundIds.length, skipped: result.skipped, duplicates: result.duplicates });
  } catch (error) {
    return toErrorResponse(error);
  }
}
