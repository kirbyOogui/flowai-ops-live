import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

// 外部サービスのトークンを DB に保存するための暗号化（AES-256-GCM）。
// 保存形式: base64(iv[12] | authTag[16] | ciphertext)

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY が設定されていません");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY は 32 バイトを base64 にした値にしてください（openssl rand -base64 32）");
  return buf;
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

export function decryptJson<T>(payload: string): T {
  const buf = Buffer.from(payload, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  const decrypted = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as T;
}

/** 秘密の文字列を、長さや内容の一部からの推測を許さずに比較する */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** IP アドレスなどを、そのまま保存しないためのハッシュ */
export function hashKey(value: string): string {
  return createHash("sha256").update(`${process.env.SESSION_SECRET ?? ""}:${value}`).digest("hex").slice(0, 24);
}
