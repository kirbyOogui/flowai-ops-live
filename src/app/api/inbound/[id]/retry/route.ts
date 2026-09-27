import { requireAdmin } from "@/lib/auth/session";
import { toErrorResponse } from "@/lib/http";
import { AlreadyHandledError, processInbound } from "@/lib/pipeline/process";
import { getRequestDTO } from "@/lib/services/requests";

export const maxDuration = 90;

/** AI 分析に失敗した受信を、もう一度分析する */
export async function POST(_request: Request, ctx: RouteContext<"/api/inbound/[id]/retry">) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const requestId = await processInbound(id);
    return Response.json({ request: await getRequestDTO(requestId) });
  } catch (error) {
    if (error instanceof AlreadyHandledError) return Response.json({ error: "すでに分析中か、分析済みです" }, { status: 409 });
    return toErrorResponse(error);
  }
}
