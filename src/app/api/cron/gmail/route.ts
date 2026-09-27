import { after } from "next/server";
import { syncGmail } from "@/lib/channels";
import { gmailStatus, renewWatch } from "@/lib/channels/gmail";
import { safeEqual } from "@/lib/crypto";
import { processInboundInBackground } from "@/lib/pipeline/process";

export const maxDuration = 120;

/** Vercel Cron（1日1回）：Gmail の通知登録を更新し、取りこぼしがないよう同期する */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new Response("unauthorized", { status: 401 });

  const status = await gmailStatus();
  if (!status.connected) return Response.json({ skipped: "gmail not connected" });

  const watchExpiration = await renewWatch().catch((error) => {
    console.error("[cron] renew watch failed", error);
    return null;
  });
  const { inboundIds, skipped } = await syncGmail();
  after(async () => {
    for (const id of inboundIds) await processInboundInBackground(id);
  });
  return Response.json({ watchExpiration, imported: inboundIds.length, skipped });
}
