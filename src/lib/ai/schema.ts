import { z } from "zod";
import { CATEGORIES, CONFIDENCE_LEVELS, PRIORITIES } from "@/lib/domain";
import { MEMBER_IDS } from "@/lib/nexora";

// LLM に返させる構造化出力のスキーマ。
// OpenAI の Structured Outputs（strict）に渡すため、全項目を必須にし「無い」は null で表す。
// プロパティの並び順 = モデルが生成する順序。UI の処理ステップもこの順で進む（ANALYSIS_STEPS 参照）。

export const analysisSchema = z.object({
  intent: z.string().describe("依頼者が何を求めているかを1文で。依頼の意図の読み取り結果"),
  relatedRequest: z.object({
    reasoning: z
      .string()
      .describe("過去の依頼（history）と照合した結果と根拠。60文字以内"),
    requestId: z
      .string()
      .nullable()
      .describe("関連する過去の依頼の番号（H1 など）。1件に特定できない・関連しない場合は null"),
  }),
  title: z.string().describe("仕事一覧に表示するタイトル。体言止めで30文字以内"),
  summary: z.string().describe("担当者が一読で把握できる要約。80文字以内"),
  category: z.enum(CATEGORIES).describe("依頼のカテゴリ"),
  priority: z.enum(PRIORITIES).describe("重要度"),
  priorityReason: z.string().describe("その重要度にした根拠。40文字以内"),
  assignee: z.object({
    reasoning: z
      .string()
      .describe("依頼に必要なスキル・担当領域と、候補メンバーを比較した判断根拠。60文字以内"),
    memberId: z
      .enum(MEMBER_IDS)
      .nullable()
      .describe("担当者のメンバーID。確信を持って選べない場合は null"),
    confidence: z.enum(CONFIDENCE_LEVELS).describe("担当者判断の確信度"),
  }),
  dueDate: z.object({
    sourceText: z
      .string()
      .nullable()
      .describe("依頼文中の期限表現をそのまま抜き出したもの（例: 「明日の15時まで」）。無ければ null"),
    date: z
      .string()
      .nullable()
      .describe("sourceText を基準日から解釈した日付 YYYY-MM-DD。sourceText が null なら必ず null"),
  }),
  nextAction: z.string().describe("担当者が最初に取るべき具体的な行動。動詞で終える1〜2文"),
  reply: z.object({
    subject: z.string().describe("返信の件名。Slack の場合は空文字"),
    body: z.string().describe("依頼者に送る返信文"),
  }),
  missingInformation: z
    .array(z.string())
    .describe("対応に必要だが依頼文に書かれていない情報。無ければ空配列"),
});

export type AnalysisOutput = z.infer<typeof analysisSchema>;
