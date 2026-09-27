import "server-only";
import { createHmac } from "node:crypto";
import { safeEqual } from "@/lib/crypto";
import { clipBody, type NormalizedMessage } from "@/lib/ingestion";

// Slack 連携（Events API で受信、chat.postMessage でスレッドに返信）。
// 必要な Bot Token Scopes: channels:history, channels:read, chat:write, users:read

const SIGNATURE_TOLERANCE_SEC = 60 * 5;

export class SlackError extends Error {}

export const slackConfigured = () => Boolean(process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET);

/** Slack からのリクエストかを署名で確かめる（https://api.slack.com/authentication/verifying-requests-from-slack） */
export function verifySlackSignature(rawBody: string, timestamp: string | null, signature: string | null): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > SIGNATURE_TOLERANCE_SEC) return false;
  const expected = `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`;
  return safeEqual(expected, signature);
}

async function slackApi<T>(method: string, params: Record<string, string>, init?: { json?: boolean }): Promise<T> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new SlackError("SLACK_BOT_TOKEN が設定されていません");
  const res = init?.json
    ? await fetch(`https://slack.com/api/${method}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(params),
      })
    : await fetch(`https://slack.com/api/${method}?${new URLSearchParams(params)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
  const data = (await res.json()) as { ok: boolean; error?: string } & T;
  if (!data.ok) throw new SlackError(`${method}: ${data.error ?? res.status}`);
  return data;
}

const nameCache = new Map<string, string>();

async function userName(userId: string): Promise<string> {
  const cached = nameCache.get(`u:${userId}`);
  if (cached) return cached;
  const { user } = await slackApi<{ user: { real_name?: string; profile?: { display_name?: string; real_name?: string } } }>(
    "users.info",
    { user: userId },
  );
  const name = user.profile?.display_name || user.profile?.real_name || user.real_name || userId;
  nameCache.set(`u:${userId}`, name);
  return name;
}

async function channelName(channelId: string): Promise<string> {
  const cached = nameCache.get(`c:${channelId}`);
  if (cached) return cached;
  const { channel } = await slackApi<{ channel: { name?: string } }>("conversations.info", { channel: channelId });
  const name = `#${channel.name ?? channelId}`;
  nameCache.set(`c:${channelId}`, name);
  return name;
}

/** Slack の書式（<@U123>、<https://…|表示名>、&amp; など）を読みやすい文字列に直す */
async function toPlainText(text: string): Promise<string> {
  const mentions = [...new Set([...text.matchAll(/<@([A-Z0-9]+)>/g)].map((m) => m[1]))];
  const names = new Map(await Promise.all(mentions.map(async (id) => [id, await userName(id).catch(() => id)] as const)));
  return text
    .replace(/<@([A-Z0-9]+)>/g, (_, id: string) => `@${names.get(id) ?? id}`)
    .replace(/<#[A-Z0-9]+\|([^>]+)>/g, "#$1")
    .replace(/<(https?:[^|>]+)\|([^>]+)>/g, "$2 ($1)")
    .replace(/<(https?:[^>]+)>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

export type SlackMessageEvent = {
  type: "message" | "app_mention";
  subtype?: string;
  bot_id?: string;
  user?: string;
  text?: string;
  channel: string;
  ts: string;
  thread_ts?: string;
};

/**
 * 依頼として取り込む投稿かを判定する。
 * ボット（自分の返信を含む）・編集や削除などのサブタイプ・スレッド内の返信・対象外のチャンネルは取り込まない。
 */
export function isRequestMessage(event: SlackMessageEvent): boolean {
  if (event.type !== "message") return false; // app_mention は同じ投稿の message と重複するため使わない
  if (event.bot_id || event.subtype || !event.user || !event.text?.trim()) return false;
  if (event.thread_ts && event.thread_ts !== event.ts) return false;
  const target = process.env.SLACK_CHANNEL_ID?.trim();
  return !target || event.channel === target;
}

export async function normalizeSlackEvent(event: SlackMessageEvent): Promise<NormalizedMessage> {
  const [author, channel, body] = await Promise.all([userName(event.user!), channelName(event.channel), toPlainText(event.text ?? "")]);
  return {
    sourceType: "slack",
    requesterName: author,
    subject: null,
    body: clipBody(body),
    metadata: { sourceType: "slack", author, authorId: event.user!, channel, channelId: event.channel, ts: event.ts },
    receivedAt: new Date(Number(event.ts) * 1000),
  };
}

export const slackExternalId = (event: Pick<SlackMessageEvent, "channel" | "ts">) => `${event.channel}:${event.ts}`;

/** 元の投稿のスレッドに返信する */
export async function postThreadReply(channelId: string, threadTs: string, text: string): Promise<string> {
  const { ts } = await slackApi<{ ts: string }>("chat.postMessage", { channel: channelId, thread_ts: threadTs, text }, { json: true });
  return ts;
}

/** 接続確認（連携画面の表示用） */
export async function slackStatus(): Promise<{ connected: boolean; team?: string; bot?: string; error?: string }> {
  if (!slackConfigured()) return { connected: false };
  try {
    const data = await slackApi<{ team: string; user: string }>("auth.test", {});
    return { connected: true, team: data.team, bot: data.user };
  } catch (error) {
    return { connected: false, error: error instanceof Error ? error.message : String(error) };
  }
}
