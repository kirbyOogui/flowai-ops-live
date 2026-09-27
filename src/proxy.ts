import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/auth/token";

// オーナー専用の画面・API への事前チェック（最終的な確認は各ページ・Route Handler でも行う）。
// 紹介ページ・公開フォーム・Webhook・Cron は誰でもアクセスできる。

const PUBLIC_API = ["/api/webhooks/", "/api/form", "/api/auth/", "/api/cron/"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_API.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const authed = await verifyAdminToken(request.cookies.get(ADMIN_COOKIE)?.value);
  if (authed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/app/:path*", "/api/:path*"],
};
