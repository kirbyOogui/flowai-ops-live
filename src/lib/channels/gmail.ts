import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { clipBody, type NormalizedMessage } from "@/lib/ingestion";

// Gmail 連携（OAuth で接続、Gmail API で受信・返信）。
// 受信は 3 経路：Pub/Sub のプッシュ通知（リアルタイム）/ Vercel Cron（定期）/ 画面の「今すぐ受信」。
// どの経路でも同じ syncInbox() を呼び、二重に取り込まないことは InboundMessage の一意制約で保証する。

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send"];
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const INTEGRATION_ID = "google";

export class GmailError extends Error {}

type StoredGoogle = {
  refreshToken: string;
  email: string;
  historyId: string;
  watchExpiration: string | null;
  connectedAt: string;
  lastSyncAt: string | null;
};

export const gmailConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const redirectUri = () => `${process.env.APP_URL?.replace(/\/$/, "")}/api/integrations/google/callback`;
const stateKey = () => new TextEncoder().encode(`${process.env.SESSION_SECRET}:google-oauth`);

// ─── 接続情報の保存 ────────────────────────────────────

async function loadStored(): Promise<StoredGoogle | null> {
  const row = await prisma.integration.findUnique({ where: { id: INTEGRATION_ID } });
  return row ? decryptJson<StoredGoogle>(row.data) : null;
}

async function saveStored(data: StoredGoogle) {
  const encrypted = encryptJson(data);
  await prisma.integration.upsert({ where: { id: INTEGRATION_ID }, create: { id: INTEGRATION_ID, data: encrypted }, update: { data: encrypted } });
}

export async function disconnectGmail() {
  await prisma.integration.deleteMany({ where: { id: INTEGRATION_ID } });
  cachedToken = null;
}

// ─── OAuth ───────────────────────────────────────────

/** 接続開始用の Google 同意画面の URL。state は CSRF 対策の署名付きトークン */
export async function buildAuthUrl(): Promise<string> {
  const state = await new SignJWT({ purpose: "google-oauth" }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m").sign(stateKey());
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "", ...body }),
  });
  const data = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) throw new GmailError(`Google token error: ${data.error ?? res.status} ${data.error_description ?? ""}`.trim());
  return data as { access_token: string; refresh_token?: string; expires_in: number };
}

/** OAuth のコールバック：トークンを保存し、受信の起点（historyId）と通知の登録を行う */
export async function completeOAuth(code: string, state: string) {
  await jwtVerify(state, stateKey(), { algorithms: ["HS256"] }).catch(() => {
    throw new GmailError("接続の有効期限が切れたか、不正なリクエストです。もう一度接続してください。");
  });
  const tokens = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  if (!tokens.refresh_token) throw new GmailError("リフレッシュトークンを取得できませんでした。もう一度接続してください。");
  cachedToken = { token: tokens.access_token, expiresAt: Date.now() + (tokens.expires_in - 60) * 1000 };

  const profile = await gmailFetch<{ emailAddress: string; historyId: string }>("/profile");
  await saveStored({
    refreshToken: tokens.refresh_token,
    email: profile.emailAddress,
    historyId: profile.historyId,
    watchExpiration: null,
    connectedAt: new Date().toISOString(),
    lastSyncAt: null,
  });
  await renewWatch().catch((error) => console.error("[gmail] watch failed", error));
  return profile.emailAddress;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;
  const stored = await loadStored();
  if (!stored) throw new GmailError("Gmail が接続されていません");
  const tokens = await tokenRequest({ refresh_token: stored.refreshToken, grant_type: "refresh_token" });
  cachedToken = { token: tokens.access_token, expiresAt: Date.now() + (tokens.expires_in - 60) * 1000 };
  return tokens.access_token;
}

async function gmailFetch<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${await accessToken()}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new GmailError(`Gmail API ${res.status} ${path}: ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// ─── 受信 ───────────────────────────────────────────

/** Pub/Sub への通知登録（7 日で失効するため、Cron で毎日更新する） */
export async function renewWatch() {
  const topic = process.env.GMAIL_PUBSUB_TOPIC?.trim();
  const stored = await loadStored();
  if (!topic || !stored) return null;
  const res = await gmailFetch<{ historyId: string; expiration: string }>("/watch", {
    method: "POST",
    body: { topicName: topic, labelIds: ["INBOX"], labelFilterBehavior: "INCLUDE" },
  });
  const expiration = new Date(Number(res.expiration)).toISOString();
  await saveStored({ ...(await loadStored())!, watchExpiration: expiration });
  return expiration;
}

type GmailHeader = { name: string; value: string };
type GmailPart = { mimeType: string; body?: { data?: string }; parts?: GmailPart[]; headers?: GmailHeader[] };
type GmailMessage = { id: string; threadId: string; labelIds?: string[]; internalDate: string; payload: GmailPart };

const header = (m: GmailMessage, name: string) => m.payload.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;
const decode = (data: string) => Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

function findPart(part: GmailPart, mimeType: string): string | null {
  if (part.mimeType === mimeType && part.body?.data) return decode(part.body.data);
  for (const child of part.parts ?? []) {
    const found = findPart(child, mimeType);
    if (found) return found;
  }
  return null;
}

const stripHtml = (html: string) =>
  html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

/** 返信メールの引用部分（「> 」の行や「〜 wrote:」以降）を取り除く */
function stripQuoted(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const cut = lines.findIndex(
    (line, i) =>
      i > 0 &&
      (/^On .+wrote:$/.test(line.trim()) || /(のメッセージ|書きました|wrote)[:：]\s*$/.test(line.trim()) || /^-{2,}\s*Original Message/i.test(line.trim())),
  );
  const kept = (cut > 0 ? lines.slice(0, cut) : lines).filter((line) => !line.startsWith(">"));
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function parseFrom(value: string): { name: string; email: string } {
  const match = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1].trim() || match[2], email: match[2].trim() };
  return { name: value.trim(), email: value.trim() };
}

/**
 * 依頼として取り込むメールかを判定する。
 * 自分が送ったメール・下書き・迷惑メール、メルマガや自動送信（List-Unsubscribe / Auto-Submitted / プロモーション等）は取り込まない。
 */
function isRequestMail(m: GmailMessage, selfEmail: string): boolean {
  const labels = m.labelIds ?? [];
  if (!labels.includes("INBOX")) return false;
  if (labels.some((l) => ["SENT", "DRAFT", "SPAM", "TRASH", "CHAT"].includes(l))) return false;
  if (labels.some((l) => ["CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_UPDATES", "CATEGORY_FORUMS"].includes(l))) return false;
  if (header(m, "List-Unsubscribe") || header(m, "List-Id")) return false;
  const autoSubmitted = header(m, "Auto-Submitted");
  if (autoSubmitted && autoSubmitted.toLowerCase() !== "no") return false;
  if (/bulk|list|junk/i.test(header(m, "Precedence") ?? "")) return false;
  const from = parseFrom(header(m, "From") ?? "");
  return from.email.toLowerCase() !== selfEmail.toLowerCase() && !/no-?reply/i.test(from.email);
}

function normalizeMail(m: GmailMessage): NormalizedMessage {
  const from = parseFrom(header(m, "From") ?? "（不明）");
  const subject = header(m, "Subject") ?? "（件名なし）";
  const plain = findPart(m.payload, "text/plain") ?? stripHtml(findPart(m.payload, "text/html") ?? "");
  const body = clipBody(stripQuoted(plain) || "（本文なし）");
  return {
    sourceType: "email",
    requesterName: from.name,
    subject,
    body,
    metadata: {
      sourceType: "email",
      from: from.name,
      fromEmail: from.email,
      subject,
      messageId: header(m, "Message-ID"),
      gmailId: m.id,
      threadId: m.threadId,
    },
    receivedAt: new Date(Number(m.internalDate)),
  };
}

/**
 * 前回の同期以降に受信トレイへ届いたメールを取得する。
 * historyId が古すぎて使えない場合（404）は、直近 2 日分の受信トレイから取り直す。
 * 取り込み（保存と AI 分析）は呼び出し側に任せ、ここでは正規化したメッセージを返すだけにする。
 */
export async function fetchNewMail(): Promise<{ messages: { externalId: string; message: NormalizedMessage }[]; skipped: number }> {
  const stored = await loadStored();
  if (!stored) throw new GmailError("Gmail が接続されていません");

  let ids: string[] = [];
  let latestHistoryId = stored.historyId;
  try {
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({ startHistoryId: stored.historyId, historyTypes: "messageAdded", labelId: "INBOX" });
      if (pageToken) params.set("pageToken", pageToken);
      const res = await gmailFetch<{ history?: { messagesAdded?: { message: { id: string } }[] }[]; historyId: string; nextPageToken?: string }>(
        `/history?${params}`,
      );
      ids.push(...(res.history ?? []).flatMap((h) => (h.messagesAdded ?? []).map((a) => a.message.id)));
      latestHistoryId = res.historyId;
      pageToken = res.nextPageToken;
    } while (pageToken);
  } catch (error) {
    if (!(error instanceof GmailError && error.message.includes(" 404 "))) throw error;
    const res = await gmailFetch<{ messages?: { id: string }[] }>(`/messages?${new URLSearchParams({ q: "in:inbox newer_than:2d", maxResults: "25" })}`);
    ids = (res.messages ?? []).map((m) => m.id);
    latestHistoryId = (await gmailFetch<{ historyId: string }>("/profile")).historyId;
  }

  const unique = [...new Set(ids)];
  const fetched = await Promise.all(unique.map((id) => gmailFetch<GmailMessage>(`/messages/${id}?format=full`).catch(() => null)));
  const mails = fetched.filter((m): m is GmailMessage => m !== null);
  const accepted = mails.filter((m) => isRequestMail(m, stored.email));

  // 同時に複数の同期が走っても historyId が巻き戻らないよう、最新の値を読み直して大きい方を保存する
  const current = (await loadStored()) ?? stored;
  const newest = BigInt(latestHistoryId) > BigInt(current.historyId) ? latestHistoryId : current.historyId;
  await saveStored({ ...current, historyId: newest, lastSyncAt: new Date().toISOString() });

  return {
    messages: accepted.map((m) => ({ externalId: m.id, message: normalizeMail(m) })),
    skipped: mails.length - accepted.length,
  };
}

// ─── 送信 ───────────────────────────────────────────

const encodeHeader = (value: string) => (/^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`);

function buildMime(input: { to: string; subject: string; body: string; inReplyTo?: string | null }): string {
  const headers = [
    `To: ${input.to}`,
    `Subject: ${encodeHeader(input.subject)}`,
    ...(input.inReplyTo ? [`In-Reply-To: ${input.inReplyTo}`, `References: ${input.inReplyTo}`] : []),
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ];
  const body = Buffer.from(input.body.replace(/\r?\n/g, "\r\n"), "utf8").toString("base64").replace(/.{76}/g, "$&\r\n");
  return Buffer.from(`${headers.join("\r\n")}\r\n\r\n${body}`, "utf8").toString("base64url");
}

/** メールを送る。threadId と inReplyTo を渡すと、元のメールへの返信として同じスレッドに入る */
export async function sendMail(input: { to: string; subject: string; body: string; threadId?: string; inReplyTo?: string | null }): Promise<string> {
  const res = await gmailFetch<{ id: string }>("/messages/send", {
    method: "POST",
    body: { raw: buildMime(input), ...(input.threadId ? { threadId: input.threadId } : {}) },
  });
  return res.id;
}

/** 連携画面の表示用 */
export async function gmailStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  email?: string;
  lastSyncAt?: string | null;
  watchExpiration?: string | null;
  realtime: boolean;
}> {
  const realtime = Boolean(process.env.GMAIL_PUBSUB_TOPIC?.trim());
  if (!gmailConfigured()) return { configured: false, connected: false, realtime };
  const stored = await loadStored().catch(() => null);
  if (!stored) return { configured: true, connected: false, realtime };
  return { configured: true, connected: true, email: stored.email, lastSyncAt: stored.lastSyncAt, watchExpiration: stored.watchExpiration, realtime };
}
