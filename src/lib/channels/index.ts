import "server-only";
import type { SourceMetadata } from "@/lib/ingestion";
import { recordInbound } from "@/lib/pipeline/process";
import type { ReplyDelivery } from "@/lib/services/requests";
import { fetchNewMail, sendMail } from "./gmail";
import { postThreadReply } from "./slack";

// 受付元ごとの外部サービスへの出入り口。業務処理（services）からはここだけを使う。

export class DeliveryError extends Error {}

const withRe = (subject: string) => (/^re:/i.test(subject.trim()) ? subject : `Re: ${subject}`);

/** 返信を、依頼が届いた受付元へ実際に送る */
export const deliverReply: ReplyDelivery = async (metadata: SourceMetadata, input) => {
  try {
    switch (metadata.sourceType) {
      case "email": {
        const externalId = await sendMail({
          to: `${metadata.from} <${metadata.fromEmail}>`,
          subject: input.subject || withRe(metadata.subject),
          body: input.body,
          threadId: metadata.threadId,
          inReplyTo: metadata.messageId,
        });
        return { externalId, via: "Gmail で送信" };
      }
      case "slack": {
        const externalId = await postThreadReply(metadata.channelId, metadata.ts, input.body);
        return { externalId, via: "Slack のスレッドに投稿" };
      }
      case "form": {
        const externalId = await sendMail({
          to: `${metadata.requester} <${metadata.email}>`,
          subject: input.subject || `【受付】${metadata.subject}`,
          body: input.body,
        });
        return { externalId, via: "Gmail で送信" };
      }
    }
  } catch (error) {
    console.error("[delivery] failed", error);
    throw new DeliveryError(error instanceof Error ? error.message : String(error));
  }
};

/** Gmail の新着を取り込み、AI 分析が必要な受信の ID を返す（重複は除く） */
export async function syncGmail(): Promise<{ inboundIds: string[]; skipped: number; duplicates: number }> {
  const { messages, skipped } = await fetchNewMail();
  const inboundIds: string[] = [];
  let duplicates = 0;
  for (const { externalId, message } of messages) {
    const { id, duplicate } = await recordInbound(message, externalId);
    if (duplicate) duplicates += 1;
    else inboundIds.push(id);
  }
  return { inboundIds, skipped, duplicates };
}
