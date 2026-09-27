import { requireAdmin } from "@/lib/auth/session";
import { disconnectGmail } from "@/lib/channels/gmail";
import { toErrorResponse } from "@/lib/http";

export async function POST() {
  try {
    await requireAdmin();
    await disconnectGmail();
    return Response.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
