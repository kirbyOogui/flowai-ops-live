import "server-only";
import { z } from "zod";
import { UnauthorizedError } from "@/lib/auth/session";
import { DeliveryError } from "@/lib/channels";
import { GmailError } from "@/lib/channels/gmail";
import { SlackError } from "@/lib/channels/slack";
import { RateLimitError } from "@/lib/rate-limit";
import { ConflictError, NotFoundError } from "@/lib/services/requests";

// 検証エラーの既定メッセージを日本語にする
z.config(z.locales.ja());

export function jsonError(status: number, message: string, issues?: unknown) {
  return Response.json({ error: message, issues }, { status });
}

/** Route Handler 内の例外を HTTP レスポンスに変換する */
export function toErrorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return jsonError(400, error.issues[0]?.message ?? "入力内容が正しくありません", z.flattenError(error));
  }
  if (error instanceof UnauthorizedError) return jsonError(401, "ログインが必要です");
  if (error instanceof NotFoundError) return jsonError(404, "依頼が見つかりません");
  if (error instanceof ConflictError) return jsonError(409, error.message);
  if (error instanceof RateLimitError) return jsonError(429, "回数の上限に達しました。時間をおいてお試しください。");
  if (error instanceof DeliveryError) return jsonError(502, `送信に失敗しました：${error.message}`);
  if (error instanceof GmailError || error instanceof SlackError) return jsonError(502, error.message);
  console.error(error);
  return jsonError(500, "サーバーでエラーが発生しました");
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new z.ZodError([{ code: "custom", message: "JSONの形式が正しくありません", path: [], input: undefined }]);
  }
}
