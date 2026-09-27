import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { buildAuthUrl, gmailConfigured } from "@/lib/channels/gmail";
import { toErrorResponse } from "@/lib/http";

/** Gmail の接続を開始する（Google の同意画面へ移動） */
export async function GET() {
  try {
    await requireAdmin();
    if (!gmailConfigured()) {
      return Response.json({ error: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が設定されていません" }, { status: 400 });
    }
    return NextResponse.redirect(await buildAuthUrl());
  } catch (error) {
    return toErrorResponse(error);
  }
}
