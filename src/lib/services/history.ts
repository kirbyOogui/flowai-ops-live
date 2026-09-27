import type { PrismaClient, Request } from "@/generated/prisma/client";
import type { HistoryCandidate } from "@/lib/ai/history";
import type { NormalizedMessage } from "@/lib/ingestion";

// 受け付けた依頼と「同じ依頼者（人・組織・Slack 投稿者）」から届いた過去の依頼を探し、
// AI が「先日の件」のような依頼の文脈を判断できるよう候補として渡す。
// 初期データの投入（Next.js の外）からも使うため、DB クライアントは引数で受け取る。

const LOOKBACK_DAYS = 60;
const MAX_CANDIDATES = 8;

export type HistorySource = Pick<
  Request,
  "id" | "receivedAt" | "sourceType" | "requesterName" | "title" | "summary" | "category" | "assigneeId" | "status"
>;

/** 「株式会社ミナト精工 経理部 石井 大輔」→ 組織「株式会社ミナト精工」と個人「石井 大輔」に分ける */
export function parseRequester(name: string): { full: string; person: string; org: string | null } {
  const tokens = name.replace(/[　\s]+/g, " ").trim().split(" ");
  const full = tokens.join(" ");
  if (tokens.length <= 2) return { full, person: full, org: null };
  return { full, person: tokens.slice(-2).join(" "), org: tokens[0] };
}

/** 過去の依頼の一覧から、同じ依頼者のものを関連の強い順・新しい順に選ぶ */
export function pickHistoryCandidates(recent: HistorySource[], message: NormalizedMessage): HistoryCandidate[] {
  const me = parseRequester(message.requesterName);
  return recent
    .map((r) => {
      const other = parseRequester(r.requesterName);
      if (other.full === me.full) return { r, score: 3, matchedBy: "同じ依頼者" };
      if (other.person === me.person) return { r, score: 2, matchedBy: "同じ依頼者（表記違い）" };
      if (me.org && other.org === me.org) return { r, score: 1, matchedBy: "同じ組織" };
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score || b.r.receivedAt.getTime() - a.r.receivedAt.getTime())
    .slice(0, MAX_CANDIDATES)
    .map(({ r, matchedBy }) => ({
      id: r.id,
      receivedAt: r.receivedAt.toISOString(),
      sourceType: r.sourceType,
      requesterName: r.requesterName,
      title: r.title,
      summary: r.summary,
      category: r.category,
      assigneeId: r.assigneeId,
      status: r.status,
      matchedBy,
    }));
}

export async function findHistoryCandidates(
  db: Pick<PrismaClient, "request">,
  message: NormalizedMessage,
): Promise<HistoryCandidate[]> {
  const since = new Date(message.receivedAt.getTime() - LOOKBACK_DAYS * 86_400_000);
  const recent = await db.request.findMany({
    where: { receivedAt: { gte: since, lt: message.receivedAt } },
    orderBy: { receivedAt: "desc" },
    take: 200,
  });
  return pickHistoryCandidates(recent, message);
}
