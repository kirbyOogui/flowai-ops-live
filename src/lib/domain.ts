// クライアント・サーバー双方で使うドメイン定数。
// 値は prisma/schema.prisma の enum と一致させる（src/lib/db.ts で型チェックしている）。

export const SOURCE_TYPES = ["email", "slack", "form"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_LABEL: Record<SourceType, string> = {
  email: "メール",
  slack: "Slack",
  form: "フォーム",
};

export const CATEGORIES = [
  "sales",
  "customer_success",
  "product",
  "design",
  "engineering",
  "marketing",
  "finance",
  "hr",
  "general_affairs",
  "legal",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  sales: "営業",
  customer_success: "カスタマーサクセス",
  product: "プロダクト",
  design: "デザイン",
  engineering: "エンジニアリング",
  marketing: "マーケティング",
  finance: "財務",
  hr: "人事",
  general_affairs: "総務",
  legal: "法務",
};

export const PRIORITIES = ["urgent", "high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: "緊急",
  high: "高",
  medium: "中",
  low: "低",
};

export const STATUSES = ["todo", "in_progress", "done"] as const;
export type RequestStatus = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<RequestStatus, string> = {
  todo: "未着手",
  in_progress: "対応中",
  done: "完了",
};

export const REVIEW_STATES = ["auto_assigned", "needs_review", "confirmed"] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "高",
  medium: "中",
  low: "低",
};
