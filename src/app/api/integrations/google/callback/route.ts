import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/session";
import { completeOAuth } from "@/lib/channels/gmail";

/** Google の同意画面から戻ってきたところ。結果を連携画面に表示する */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (params: Record<string, string>) =>
    NextResponse.redirect(new URL(`/app?${new URLSearchParams({ view: "integrations", ...params })}`, url));

  if (!(await isAdmin())) return NextResponse.redirect(new URL("/login", url));
  const error = url.searchParams.get("error");
  if (error) return back({ gmail: "error", reason: error });

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return back({ gmail: "error", reason: "missing_code" });
  try {
    const email = await completeOAuth(code, state);
    return back({ gmail: "connected", email });
  } catch (e) {
    console.error("[gmail] oauth failed", e);
    return back({ gmail: "error", reason: e instanceof Error ? e.message.slice(0, 120) : "unknown" });
  }
}
