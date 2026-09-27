import { requireAdmin } from "@/lib/auth/session";
import { deliverReply } from "@/lib/channels";
import { readJson, toErrorResponse } from "@/lib/http";
import { sendReply, sendReplySchema } from "@/lib/services/requests";

export const maxDuration = 60;

/** 人が確認した返信を、依頼が届いた受付元（Gmail / Slack）へ実際に送る */
export async function POST(request: Request, ctx: RouteContext<"/api/requests/[id]/send-reply">) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const input = sendReplySchema.parse(await readJson(request));
    return Response.json({ request: await sendReply(id, input, deliverReply) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
