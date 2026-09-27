import { jwtVerify, SignJWT } from "jose";

// オーナーのログインセッション（署名付き Cookie）。proxy.ts とサーバーの両方から使うため server-only にしない。

export const ADMIN_COOKIE = "flowai_admin";
export const SESSION_DAYS = 14;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET が設定されていません");
  return new TextEncoder().encode(value);
}

export async function signAdminToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

export async function verifyAdminToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload.role === "admin";
  } catch {
    return false;
  }
}
