import { requireAdmin } from "@/lib/auth/session";
import { toErrorResponse } from "@/lib/http";
import { listInboundIssues, listRequests } from "@/lib/services/requests";

/** 画面の自動更新用：依頼と、まだ依頼になっていない受信（分析中・失敗） */
export async function GET() {
  try {
    await requireAdmin();
    const [requests, inbound] = await Promise.all([listRequests(), listInboundIssues()]);
    return Response.json({ requests, inbound });
  } catch (error) {
    return toErrorResponse(error);
  }
}
