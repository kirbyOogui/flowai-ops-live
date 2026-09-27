import { requireAdmin } from "@/lib/auth/session";
import { gmailStatus } from "@/lib/channels/gmail";
import { slackStatus } from "@/lib/channels/slack";
import { toErrorResponse } from "@/lib/http";

/** 連携画面の表示用（トークンの値そのものは返さない） */
export async function GET() {
  try {
    await requireAdmin();
    const [gmail, slack] = await Promise.all([gmailStatus(), slackStatus()]);
    return Response.json({
      gmail,
      slack: { ...slack, channelId: process.env.SLACK_CHANNEL_ID || null },
      formUrl: `${process.env.APP_URL?.replace(/\/$/, "") ?? ""}/form`,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
