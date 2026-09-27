import type { Confidence, ReviewState } from "@/lib/domain";
import { isValidISODate } from "@/lib/dates";
import { MEMBER_IDS } from "@/lib/nexora";
import { AiError } from "./errors";
import { analysisSchema, type AnalysisOutput } from "./schema";

// モデルの出力をそのまま信用せず、スキーマ検証 + 業務ルールで補正してから使う。
// Structured Outputs で形式はほぼ保証されるが、モックや将来のモデル変更でも壊れないよう必ず通す。

export type AnalysisDecision = {
  output: AnalysisOutput;
  /** AI が特定した関連する過去の依頼（DB の ID） */
  relatedRequestId: string | null;
  assigneeId: string | null;
  assigneeConfidence: Confidence;
  reviewState: ReviewState;
  dueDate: string | null;
};

const clip = (value: string, max: number) => {
  const v = value.trim();
  return v.length > max ? `${v.slice(0, max - 1)}…` : v;
};

/** 過去の依頼の候補番号（H1 など）の扱い */
export type HistoryRefs = {
  /** 候補番号 → DB の ID。候補にない値なら null */
  resolve: (ref: string) => string | null;
  /** 候補番号 → 件名。文章に番号が残ったときに件名へ置き換える */
  label: (ref: string) => string | null;
};

const NO_REFS: HistoryRefs = { resolve: () => null, label: () => null };
const REF_IN_TEXT_RE = /(?<![A-Za-z0-9])H(\d{1,2})(?![0-9])/g;

export function finalizeAnalysis(raw: unknown, refs: HistoryRefs = NO_REFS): AnalysisDecision {
  const parsed = analysisSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AiError("invalid_output", parsed.error.message);
  }
  const output = parsed.data;

  // 候補として渡していない依頼への関連付けは捨てる（ID の捏造対策）
  const relatedRef = output.relatedRequest.requestId?.trim();
  const relatedRequestId = relatedRef ? refs.resolve(relatedRef) : null;
  // 内部用の番号は利用者に見せない（プロンプトでも指示しているが、残った場合の保険）
  const text = (value: string) =>
    value
      .replace(REF_IN_TEXT_RE, (match, n) => {
        const title = refs.label(`H${n}`);
        return title ? `「${title}」` : match;
      })
      .trim();

  // 確信度が低いのに誰かが入っている、または存在しないIDの場合は人間の判断に戻す
  const { memberId, confidence } = output.assignee;
  const assigneeId =
    memberId && confidence !== "low" && MEMBER_IDS.includes(memberId) ? memberId : null;

  // 期限は「依頼文に根拠となる表現がある」かつ「日付として正しい」ときだけ採用する
  const { sourceText, date } = output.dueDate;
  const dueDate = sourceText?.trim() && date && isValidISODate(date) ? date : null;

  return {
    output: {
      ...output,
      relatedRequest: { reasoning: text(output.relatedRequest.reasoning), requestId: relatedRequestId },
      title: clip(text(output.title), 40),
      summary: clip(text(output.summary), 160),
      priorityReason: text(output.priorityReason),
      assignee: { ...output.assignee, reasoning: text(output.assignee.reasoning), memberId: assigneeId },
      dueDate: { sourceText: sourceText?.trim() || null, date: dueDate },
      nextAction: text(output.nextAction),
      reply: { subject: text(output.reply.subject), body: text(output.reply.body) },
    },
    relatedRequestId,
    assigneeId,
    assigneeConfidence: assigneeId ? confidence : "low",
    reviewState: assigneeId ? "auto_assigned" : "needs_review",
    dueDate,
  };
}
