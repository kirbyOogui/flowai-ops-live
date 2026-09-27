import { z } from "zod";
import type { SourceType } from "@/lib/domain";

// 受付元（Gmail / Slack / フォーム）ごとに届いたメッセージを、AI Pipeline が扱う共通形式 NormalizedMessage に揃える。
// 各受付元のアダプタ（src/lib/channels/*）はこの形を作るだけでよく、以降の処理は共通になる。

/** Request.sourceMetadata に保存する受付元ごとの付帯情報（返信の送り先の特定にも使う） */
export type SourceMetadata =
  | {
      sourceType: "email";
      from: string;
      fromEmail: string;
      subject: string;
      /** RFC 5322 の Message-ID（返信の In-Reply-To に使う） */
      messageId: string | null;
      gmailId: string;
      threadId: string;
    }
  | { sourceType: "slack"; author: string; authorId: string; channel: string; channelId: string; ts: string }
  | { sourceType: "form"; requester: string; email: string; company: string | null; subject: string; formName: string };

export type NormalizedMessage = {
  sourceType: SourceType;
  requesterName: string;
  /** 件名がない受付元（Slack）は null */
  subject: string | null;
  body: string;
  metadata: SourceMetadata;
  receivedAt: Date;
};

/** InboundMessage.payload に保存する形（日付は文字列） */
export type SerializedMessage = Omit<NormalizedMessage, "receivedAt"> & { receivedAt: string };

export const serializeMessage = (m: NormalizedMessage): SerializedMessage => ({ ...m, receivedAt: m.receivedAt.toISOString() });
export const deserializeMessage = (m: SerializedMessage): NormalizedMessage => ({ ...m, receivedAt: new Date(m.receivedAt) });

/** AI に渡す本文の上限（長いメールの引用部分などでコストが増えすぎないように） */
export const MAX_BODY_LENGTH = 6000;
export const clipBody = (body: string) => (body.length > MAX_BODY_LENGTH ? `${body.slice(0, MAX_BODY_LENGTH)}\n…（以下省略）` : body);

// ─── 公開フォーム ─────────────────────────────────────

const text = (label: string, max: number) =>
  z
    .string({ error: `${label}を入力してください` })
    .trim()
    .min(1, `${label}を入力してください`)
    .max(max, `${label}は${max}文字以内で入力してください`);

export const formInputSchema = z.object({
  name: text("お名前", 80),
  email: z.email("メールアドレスの形式が正しくありません").max(200),
  company: z.string().trim().max(120).optional().default(""),
  subject: text("件名", 200),
  content: text("依頼内容", 4000),
  /** ボット対策の隠し項目。人間は入力しないので、値があれば破棄する */
  website: z.string().optional().default(""),
});

export type FormInput = z.infer<typeof formInputSchema>;

export function normalizeForm(input: FormInput, receivedAt = new Date()): NormalizedMessage {
  const company = input.company || null;
  const requester = company ? `${company} ${input.name}` : input.name;
  return {
    sourceType: "form",
    requesterName: requester,
    subject: input.subject,
    body: input.content,
    metadata: { sourceType: "form", requester, email: input.email, company, subject: input.subject, formName: "Web依頼フォーム" },
    receivedAt,
  };
}

/** 画面表示・AI入力用に、受付元の情報を 1 行で表す */
export function describeOrigin(metadata: SourceMetadata): string {
  switch (metadata.sourceType) {
    case "email":
      return `Gmail / 差出人: ${metadata.from} <${metadata.fromEmail}>`;
    case "slack":
      return `Slack / ${metadata.channel} / 投稿者: ${metadata.author}`;
    case "form":
      return `${metadata.formName} / 依頼者: ${metadata.requester}`;
  }
}

/** 返信の宛先の表示 */
export function replyRecipient(metadata: SourceMetadata): string {
  switch (metadata.sourceType) {
    case "email":
      return `${metadata.from} <${metadata.fromEmail}>`;
    case "slack":
      return `${metadata.channel}（${metadata.author}さんへのスレッド返信）`;
    case "form":
      return `${metadata.requester} <${metadata.email}>（メールで返信）`;
  }
}
