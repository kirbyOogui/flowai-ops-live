import type { Category, RequestStatus, SourceType } from "@/lib/domain";

/** AI に「関連する過去の依頼の候補」として渡す情報 */
export type HistoryCandidate = {
  id: string;
  receivedAt: string;
  sourceType: SourceType;
  requesterName: string;
  title: string;
  summary: string;
  category: Category;
  assigneeId: string | null;
  status: RequestStatus;
  /** なぜ候補になったか（同じ依頼者 / 同じ組織 など） */
  matchedBy: string;
};

/** 「先日の件」「例の件」のように、過去のやり取りを前提にした表現 */
export const BACK_REFERENCE_RE = /先日|先般|前回|以前|例の|この前|その後|先ほど|昨日の件|あの件|さっきの|引き続き|追加で|Re:/i;
