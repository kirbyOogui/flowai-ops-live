import { after } from "next/server";
import { isRequestMessage, normalizeSlackEvent, slackExternalId, verifySlackSignature, type SlackMessageEvent } from "@/lib/channels/slack";
import { processInboundInBackground, recordInbound } from "@/lib/pipeline/process";

export const maxDuration = 90;

type SlackPayload =
  | { type: "url_verification"; challenge: string }
  | { type: "event_callback"; event_id: string; event: SlackMessageEvent }
  | { type: string };

/**
 * Slack Events API の受け口。
 * Slack は 3 秒以内に応答しないと再送するため、受信を保存したらすぐ 200 を返し、AI 分析は after() で行う。
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifySlackSignature(rawBody, request.headers.get("x-slack-request-timestamp"), request.headers.get("x-slack-signature"))) {
    return new Response("invalid signature", { status: 401 });
  }

  const payload = JSON.parse(rawBody) as SlackPayload;
  if (payload.type === "url_verification" && "challenge" in payload) {
    return Response.json({ challenge: payload.challenge });
  }
  if (payload.type !== "event_callback" || !("event" in payload) || !isRequestMessage(payload.event)) {
    return new Response("ignored");
  }

  const event = payload.event;
  try {
    const message = await normalizeSlackEvent(event);
    const { id, duplicate } = await recordInbound(message, slackExternalId(event));
    // Vercel ではレスポンスを返すと処理が止まるため、after() で「応答後も完了まで実行する」ことを明示する
    if (!duplicate) after(() => processInboundInBackground(id));
  } catch (error) {
    console.error("[slack] failed to record event", error);
    // 保存に失敗した場合は 500 を返し、Slack の再送に任せる
    return new Response("error", { status: 500 });
  }
  return new Response("ok");
}
