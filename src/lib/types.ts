import type { Category, Confidence, Priority, RequestStatus, ReviewState, SourceType } from "./domain";
import type { AiErrorCode } from "./ai/errors";
import type { AnalysisStepKey } from "./ai/steps";
import type { SourceMetadata } from "./ingestion";

// サーバー → クライアントに渡すデータの形（日付は ISO 文字列）

export type MemberDTO = {
  id: string;
  name: string;
  department: string;
  role: string;
  responsibilities: string[];
};

export type ActivityDTO = {
  id: string;
  type: string;
  actor: "ai" | "human" | "system";
  description: string;
  createdAt: string;
};

/** 関連する依頼へのリンク表示用 */
export type RequestLinkDTO = {
  id: string;
  title: string;
  receivedAt: string;
  assigneeId: string | null;
  status: RequestStatus;
};

export type AnalysisDTO = {
  provider: string;
  model: string;
  assigneeConfidence: Confidence;
  latencyMs: number | null;
  createdAt: string;
  intent: string | null;
  /** 過去の依頼と照合した結果の説明 */
  relationReasoning: string | null;
  priorityReason: string | null;
  assigneeReasoning: string | null;
  /** AI が最初に提案した担当者（人が変更しても残る） */
  suggestedAssigneeId: string | null;
  dueSourceText: string | null;
  missingInformation: string[];
};

export type RequestDTO = {
  id: string;
  title: string;
  sourceType: SourceType;
  sourceMetadata: SourceMetadata;
  requesterName: string;
  originalMessage: string;
  summary: string;
  category: Category;
  priority: Priority;
  assigneeId: string | null;
  reviewState: ReviewState;
  dueDate: string | null;
  nextAction: string;
  replySubject: string;
  replyDraft: string;
  replySentAt: string | null;
  status: RequestStatus;
  /** AI が「この依頼の元になった」と判断した過去の依頼 */
  relatedRequest: RequestLinkDTO | null;
  receivedAt: string;
  updatedAt: string;
  analysis: AnalysisDTO | null;
  activities: ActivityDTO[];
};

/** まだ依頼になっていない受信（AI 分析中・失敗） */
export type InboundIssueDTO = {
  id: string;
  source: SourceType;
  status: "received" | "processing" | "processed" | "failed";
  error: string | null;
  attempts: number;
  requesterName: string;
  preview: string;
  receivedAt: string;
};

/**
 * 公開フォームに返す分析結果。要約や担当者名は返さない
 * （AI の要約には過去の依頼との照合結果など、社内の情報が含まれうるため）
 */
export type FormResultDTO = {
  categoryLabel: string;
  priorityLabel: string;
  department: string | null;
  dueDate: string | null;
};

/** /api/form がストリームで返すイベント（NDJSON 1 行 = 1 イベント） */
export type FormEvent =
  | { type: "step"; step: AnalysisStepKey }
  | { type: "done"; result: FormResultDTO }
  | { type: "error"; code: AiErrorCode | "rate_limited" | "validation"; detail?: string };
