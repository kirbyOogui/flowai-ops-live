import type { AnalysisDecision } from "@/lib/ai/postprocess";
import { CATEGORY_LABEL, CONFIDENCE_LABEL, PRIORITY_LABEL, SOURCE_LABEL, STATUS_LABEL } from "@/lib/domain";
import type { SourceMetadata } from "@/lib/ingestion";
import { MEMBERS } from "@/lib/nexora";

// AI Processing Trace（ActivityLog）の文言をつくる。実際の AI 判断結果の値を埋め込む。

export type ActivityInput = {
  type: string;
  actor: "ai" | "human" | "system";
  description: string;
  createdAt: Date;
};

export const memberName = (id: string | null) => MEMBERS.find((m) => m.id === id)?.name ?? "未割り当て";

function receivedText(metadata: SourceMetadata): string {
  switch (metadata.sourceType) {
    case "email":
      return `${SOURCE_LABEL.email}を受信（差出人: ${metadata.from}）`;
    case "slack":
      return `${SOURCE_LABEL.slack}の投稿を受信（${metadata.channel} / ${metadata.author}）`;
    case "form":
      return `${metadata.formName}から受信（依頼者: ${metadata.requester}）`;
  }
}

/**
 * 受信 → AI の各判断 → 登録 までの履歴を作る。
 * 時刻は受信時刻から AI の処理時間の範囲で均等に割り振る（実際の処理の開始と終了に対応）。
 */
export function buildAnalysisActivities(
  metadata: SourceMetadata,
  decision: AnalysisDecision,
  startedAt: Date,
  latencyMs: number,
  history: { candidates: number; relatedTitle: string | null },
): ActivityInput[] {
  const { output, assigneeId, dueDate } = decision;
  const entries: Omit<ActivityInput, "createdAt">[] = [
    { type: "received", actor: "system", description: receivedText(metadata) },
    { type: "ai_parse", actor: "ai", description: `依頼内容を解析：${output.intent}` },
    {
      type: "ai_history",
      actor: "ai",
      description:
        history.candidates === 0
          ? "過去の依頼を照合：同じ依頼者からの過去の依頼なし"
          : history.relatedTitle
            ? `過去の依頼を照合：候補${history.candidates}件から「${history.relatedTitle}」の続きと判断`
            : `過去の依頼を照合：候補${history.candidates}件（${output.relatedRequest.reasoning}）`,
    },
    { type: "ai_summary", actor: "ai", description: "要約を生成" },
    { type: "ai_category", actor: "ai", description: `カテゴリを判定：${CATEGORY_LABEL[output.category]}` },
    {
      type: "ai_priority",
      actor: "ai",
      description: `重要度を判定：${PRIORITY_LABEL[output.priority]}（${output.priorityReason}）`,
    },
    assigneeId
      ? {
          type: "ai_assignee",
          actor: "ai",
          description: `担当者を決定：${memberName(assigneeId)}（確信度 ${CONFIDENCE_LABEL[decision.assigneeConfidence]}）`,
        }
      : {
          type: "ai_assignee_undecided",
          actor: "ai",
          description: `担当者を判断できないため、人間の確認待ちにしました（${output.assignee.reasoning}）`,
        },
    {
      type: "ai_deadline",
      actor: "ai",
      description: dueDate ? `期限を抽出：${dueDate}（「${output.dueDate.sourceText}」）` : "期限の記載なし（期限なしとして登録）",
    },
    { type: "ai_next_action", actor: "ai", description: "次のアクションを生成" },
    { type: "ai_reply", actor: "ai", description: "返信案を生成" },
    { type: "registered", actor: "system", description: `仕事として登録（${STATUS_LABEL.todo}）` },
  ];
  const span = Math.max(latencyMs, entries.length);
  return entries.map((e, i) => ({
    ...e,
    createdAt: new Date(startedAt.getTime() + Math.round((span * i) / (entries.length - 1))),
  }));
}
