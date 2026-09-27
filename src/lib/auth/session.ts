import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, SESSION_DAYS, signAdminToken, verifyAdminToken } from "./token";

// サーバー側での認証チェック（Data Access Layer）。proxy.ts のチェックは事前の振り分けにすぎないため、
// ページ・Route Handler では必ずここでも確認する。

export class UnauthorizedError extends Error {}

export async function isAdmin(): Promise<boolean> {
  return verifyAdminToken((await cookies()).get(ADMIN_COOKIE)?.value);
}

/** Route Handler 用：ログインしていなければ UnauthorizedError */
export async function requireAdmin() {
  if (!(await isAdmin())) throw new UnauthorizedError();
}

/** ページ用：ログインしていなければログイン画面へ */
export async function requireAdminPage(next = "/app") {
  if (!(await isAdmin())) redirect(`/login?next=${encodeURIComponent(next)}`);
}

export async function startAdminSession() {
  (await cookies()).set({
    name: ADMIN_COOKIE,
    value: await signAdminToken(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}
