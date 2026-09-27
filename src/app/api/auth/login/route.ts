import { z } from "zod";
import { startAdminSession } from "@/lib/auth/session";
import { safeEqual } from "@/lib/crypto";
import { readJson, toErrorResponse } from "@/lib/http";
import { clientKey, consume, RateLimitError } from "@/lib/rate-limit";

const loginSchema = z.object({ password: z.string().min(1).max(200) });

/** オーナーのログイン。総当たり対策として、同じ IP からの試行は 15 分に 10 回まで */
export async function POST(request: Request) {
  try {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) return Response.json({ error: "ADMIN_PASSWORD が設定されていません" }, { status: 500 });
    await consume(`login:${clientKey(request)}`, 10, 15 * 60 * 1000);
    const { password } = loginSchema.parse(await readJson(request));
    if (!safeEqual(password, expected)) return Response.json({ error: "パスワードが違います" }, { status: 401 });
    await startAdminSession();
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json({ error: "試行回数が多すぎます。15分ほど待ってからお試しください。" }, { status: 429 });
    }
    return toErrorResponse(error);
  }
}
