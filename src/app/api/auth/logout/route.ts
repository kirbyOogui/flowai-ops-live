import { endAdminSession } from "@/lib/auth/session";

export async function POST() {
  await endAdminSession();
  return Response.json({ ok: true });
}
