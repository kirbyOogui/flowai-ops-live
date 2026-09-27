import "server-only";
import { hashKey } from "@/lib/crypto";
import { prisma } from "@/lib/db";

// DB を使った簡易的な回数制限（フォーム送信・AI 分析・ログイン試行）。

export class RateLimitError extends Error {
  constructor(readonly scope: string) {
    super(`rate limited: ${scope}`);
  }
}

export function envLimit(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

/** 期間内の回数が上限未満なら 1 回として記録する。上限に達していれば RateLimitError */
export async function consume(key: string, limit: number, windowMs: number) {
  const since = new Date(Date.now() - windowMs);
  const count = await prisma.usageLog.count({ where: { key, createdAt: { gte: since } } });
  if (count >= limit) throw new RateLimitError(key.split(":")[0]);
  await prisma.usageLog.create({ data: { key } });
}

/** リクエスト元の IP を、そのまま保存しないようハッシュにして返す */
export function clientKey(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return hashKey(ip);
}
