import "server-only";
import { z } from "zod";
import type { PipelineResult } from "@/lib/ai";
import type { AnalysisOutput } from "@/lib/ai/schema";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  PRIORITIES,
  PRIORITY_LABEL,
  STATUSES,
  STATUS_LABEL,
  type Confidence,
} from "@/lib/domain";
import { fromISODate, isValidISODate, toISODate } from "@/lib/dates";
import { replyRecipient, type NormalizedMessage, type SourceMetadata } from "@/lib/ingestion";
import { MEMBER_IDS } from "@/lib/nexora";
import type { HistoryCandidate } from "@/lib/ai/history";
import type { InboundIssueDTO, MemberDTO, RequestDTO, RequestLinkDTO } from "@/lib/types";
import { buildAnalysisActivities, memberName, type ActivityInput } from "./activity";

const linkSelect = { id: true, title: true, receivedAt: true, assigneeId: true, status: true } as const;

const requestInclude = {
  activities: { orderBy: { createdAt: "asc" } },
  relatedRequest: { select: linkSelect },
  analyses: { orderBy: { createdAt: "desc" }, take: 1 },
} satisfies Prisma.RequestInclude;

type RequestWithRelations = Prisma.RequestGetPayload<{ include: typeof requestInclude }>;

export class NotFoundError extends Error {}
export class ConflictError extends Error {}

const toLink = (l: { id: string; title: string; receivedAt: Date; assigneeId: string | null; status: RequestDTO["status"] }): RequestLinkDTO => ({
  ...l,
  receivedAt: l.receivedAt.toISOString(),
});

function toDTO(r: RequestWithRelations): RequestDTO {
  const analysis = r.analyses[0];
  const result = (analysis?.result ?? null) as Partial<AnalysisOutput> | null;
  return {
    id: r.id,
    title: r.title,
    sourceType: r.sourceType,
    sourceMetadata: r.sourceMetadata as SourceMetadata,
    requesterName: r.requesterName,
    originalMessage: r.originalMessage,
    summary: r.summary,
    category: r.category,
    priority: r.priority,
    assigneeId: r.assigneeId,
    reviewState: r.reviewState,
    dueDate: r.dueDate ? toISODate(r.dueDate) : null,
    nextAction: r.nextAction,
    replySubject: r.replySubject,
    replyDraft: r.replyDraft,
    replySentAt: r.replySentAt?.toISOString() ?? null,
    status: r.status,
    relatedRequest: r.relatedRequest ? toLink(r.relatedRequest) : null,
    receivedAt: r.receivedAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    analysis: analysis
      ? {
          provider: analysis.provider,
          model: analysis.model,
          assigneeConfidence: analysis.assigneeConfidence as Confidence,
          latencyMs: analysis.latencyMs,
          createdAt: analysis.createdAt.toISOString(),
          intent: result?.intent ?? null,
          relationReasoning: result?.relatedRequest?.reasoning ?? null,
          priorityReason: result?.priorityReason ?? null,
          assigneeReasoning: result?.assignee?.reasoning ?? null,
          suggestedAssigneeId: result?.assignee?.memberId ?? null,
          dueSourceText: result?.dueDate?.sourceText ?? null,
          missingInformation: Array.isArray(result?.missingInformation) ? result.missingInformation : [],
        }
      : null,
    activities: r.activities.map((a) => ({
      id: a.id,
      type: a.type,
      actor: a.actor,
      description: a.description,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

export async function listMembers(): Promise<MemberDTO[]> {
  const members = await prisma.member.findMany({ orderBy: { sortOrder: "asc" } });
  return members.map(({ id, name, department, role, responsibilities }) => ({
    id,
    name,
    department,
    role,
    responsibilities,
  }));
}

export async function listRequests(): Promise<RequestDTO[]> {
  const rows = await prisma.request.findMany({ include: requestInclude, orderBy: { receivedAt: "desc" } });
  return rows.map(toDTO);
}

/** まだ依頼になっていない受信（AI 分析中・失敗）。画面で「分析中」「再分析」を出すために使う */
export async function listInboundIssues(): Promise<InboundIssueDTO[]> {
  const rows = await prisma.inboundMessage.findMany({
    where: { status: { in: ["received", "processing", "failed"] } },
    orderBy: { receivedAt: "desc" },
    take: 50,
  });
  return rows.map((r) => {
    const payload = r.payload as { requesterName?: string; subject?: string | null; body?: string };
    return {
      id: r.id,
      source: r.source,
      status: r.status,
      error: r.error,
      attempts: r.attempts,
      requesterName: payload.requesterName ?? "（不明）",
      preview: (payload.subject || payload.body || "").replace(/\s+/g, " ").slice(0, 80),
      receivedAt: r.receivedAt.toISOString(),
    };
  });
}

async function getRequest(id: string, tx: Prisma.TransactionClient = prisma): Promise<RequestDTO> {
  const row = await tx.request.findUnique({ where: { id }, include: requestInclude });
  if (!row) throw new NotFoundError(id);
  return toDTO(row);
}

/** 同じ依頼への同時更新（ダブルクリック・複数タブ）や返信の二重送信を防ぐため、行ロックを取ってから読む */
async function lockRequest(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM "Request" WHERE id = ${id} FOR UPDATE`;
  const current = await tx.request.findUnique({ where: { id } });
  if (!current) throw new NotFoundError(id);
  return current;
}

/** AI Pipeline の結果から Request を登録する（人の承認なしで自動登録） */
export async function createRequestFromAnalysis(
  tx: Prisma.TransactionClient,
  inboundId: string,
  message: NormalizedMessage,
  result: PipelineResult,
  history: HistoryCandidate[],
): Promise<string> {
  const { decision } = result;
  const { output } = decision;
  const related = history.find((h) => h.id === decision.relatedRequestId);
  const activities = buildAnalysisActivities(message.metadata, decision, message.receivedAt, result.latencyMs, {
    candidates: history.length,
    relatedTitle: related?.title ?? null,
  });

  const created = await tx.request.create({
      data: {
        inboundId,
        title: output.title,
        sourceType: message.sourceType,
        sourceMetadata: message.metadata,
        requesterName: message.requesterName,
        originalMessage: message.body,
        summary: output.summary,
        category: output.category,
        priority: output.priority,
        assigneeId: decision.assigneeId,
        reviewState: decision.reviewState,
        relatedRequestId: decision.relatedRequestId,
        dueDate: decision.dueDate ? fromISODate(decision.dueDate) : null,
        nextAction: output.nextAction,
        replySubject: output.reply.subject,
        replyDraft: output.reply.body,
        receivedAt: message.receivedAt,
        analyses: {
          create: {
            provider: result.provider,
            model: result.model,
            result: output,
            assigneeConfidence: decision.assigneeConfidence,
            latencyMs: result.latencyMs,
          },
        },
        activities: { create: activities },
      },
    });
  return created.id;
}

export async function getRequestDTO(id: string): Promise<RequestDTO> {
  return getRequest(id);
}

// ─── 人による編集 ───────────────────────────────────────────

const nonEmpty = z.string().trim().min(1).max(5000);

export const requestPatchSchema = z
  .object({
    title: nonEmpty.max(80),
    summary: nonEmpty,
    category: z.enum(CATEGORIES),
    priority: z.enum(PRIORITIES),
    assigneeId: z.enum(MEMBER_IDS).nullable(),
    /** 担当者が未確定の状態を、人が確認して確定させる */
    confirmAssignee: z.literal(true),
    dueDate: z.string().refine(isValidISODate, "日付の形式が正しくありません").nullable(),
    nextAction: nonEmpty,
    replySubject: z.string().trim().max(200),
    replyDraft: nonEmpty,
    status: z.enum(STATUSES),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "変更内容がありません");

export type RequestPatch = z.infer<typeof requestPatchSchema>;

export async function updateRequest(id: string, patch: RequestPatch): Promise<RequestDTO> {
  return prisma.$transaction(async (tx) => {
    const current = await lockRequest(tx, id);

    const data: Prisma.RequestUncheckedUpdateInput = {};
    const logs: Omit<ActivityInput, "createdAt">[] = [];
    const log = (type: string, description: string) => logs.push({ type, actor: "human", description });

    if (patch.title !== undefined && patch.title !== current.title) {
      data.title = patch.title;
      log("edit_title", "タイトルを編集");
    }
    if (patch.summary !== undefined && patch.summary !== current.summary) {
      data.summary = patch.summary;
      log("edit_summary", "要約を編集");
    }
    if (patch.category && patch.category !== current.category) {
      data.category = patch.category;
      log("edit_category", `カテゴリを変更：${CATEGORY_LABEL[current.category]} → ${CATEGORY_LABEL[patch.category]}`);
    }
    if (patch.priority && patch.priority !== current.priority) {
      data.priority = patch.priority;
      log("edit_priority", `重要度を変更：${PRIORITY_LABEL[current.priority]} → ${PRIORITY_LABEL[patch.priority]}`);
    }
    if (patch.assigneeId !== undefined && patch.assigneeId !== current.assigneeId) {
      data.assigneeId = patch.assigneeId;
      data.reviewState = patch.assigneeId ? "confirmed" : "needs_review";
      log(
        "edit_assignee",
        current.assigneeId
          ? `担当者を変更：${memberName(current.assigneeId)} → ${memberName(patch.assigneeId)}`
          : `担当者を選択：${memberName(patch.assigneeId)}`,
      );
    } else if (patch.confirmAssignee && current.reviewState === "needs_review") {
      const assignee = patch.assigneeId ?? current.assigneeId;
      if (!assignee) throw new ConflictError("担当者を選択してから確定してください");
      data.reviewState = "confirmed";
      log("confirm_assignee", `担当者を確認：${memberName(assignee)}`);
    }
    if (patch.dueDate !== undefined) {
      const currentDue = current.dueDate ? toISODate(current.dueDate) : null;
      if (patch.dueDate !== currentDue) {
        data.dueDate = patch.dueDate ? fromISODate(patch.dueDate) : null;
        log("edit_due", `期限を変更：${currentDue ?? "期限なし"} → ${patch.dueDate ?? "期限なし"}`);
      }
    }
    if (patch.nextAction !== undefined && patch.nextAction !== current.nextAction) {
      data.nextAction = patch.nextAction;
      log("edit_next_action", "次のアクションを編集");
    }
    if (
      (patch.replyDraft !== undefined && patch.replyDraft !== current.replyDraft) ||
      (patch.replySubject !== undefined && patch.replySubject !== current.replySubject)
    ) {
      if (current.replySentAt) throw new ConflictError("送信済みの返信は編集できません");
      if (patch.replyDraft !== undefined) data.replyDraft = patch.replyDraft;
      if (patch.replySubject !== undefined) data.replySubject = patch.replySubject;
      log("edit_reply", "返信案を編集");
    }
    if (patch.status && patch.status !== current.status) {
      data.status = patch.status;
      log("status_changed", `状態を変更：${STATUS_LABEL[current.status]} → ${STATUS_LABEL[patch.status]}`);
    }

    if (logs.length > 0) {
      const now = Date.now();
      await tx.request.update({
        where: { id },
        data: {
          ...data,
          activities: { create: logs.map((l, i) => ({ ...l, createdAt: new Date(now + i) })) },
        },
      });
    }
    return getRequest(id, tx);
  });
}

// ─── 外部アクション：返信の送信 ───────────────────────────────

export const sendReplySchema = z.object({
  subject: z.string().trim().max(200),
  body: nonEmpty,
});

export type ReplyInput = z.infer<typeof sendReplySchema>;

/** 受付元（Gmail / Slack）へ実際に送る処理。src/lib/channels/reply.ts が実装する */
export type ReplyDelivery = (metadata: SourceMetadata, input: ReplyInput) => Promise<{ externalId: string; via: string }>;

/**
 * 人が確認した返信を、元の受付元へ実際に送る。
 * 行ロックを取ったまま送信し、成功したときだけ「送信済み」として記録する（二重送信の防止）。
 */
export async function sendReply(id: string, input: ReplyInput, deliver: ReplyDelivery): Promise<RequestDTO> {
  return prisma.$transaction(
    async (tx) => {
      const current = await lockRequest(tx, id);
      if (current.replySentAt) throw new ConflictError("この返信は送信済みです");

      const metadata = current.sourceMetadata as SourceMetadata;
      const { externalId, via } = await deliver(metadata, input);

      const edited = input.body !== current.replyDraft || input.subject !== current.replySubject;
      const now = Date.now();
      await tx.request.update({
        where: { id },
        data: {
          replySubject: input.subject,
          replyDraft: input.body,
          replySentAt: new Date(now),
          replyExternalId: externalId,
          activities: {
            create: [
              ...(edited ? [{ type: "edit_reply", actor: "human" as const, description: "返信案を編集", createdAt: new Date(now) }] : []),
              {
                type: "reply_sent",
                actor: "human" as const,
                description: `返信を確認して送信：${replyRecipient(metadata)}（${via}）`,
                createdAt: new Date(now + 1),
              },
            ],
          },
        },
      });
      return getRequest(id, tx);
    },
    { timeout: 30_000 },
  );
}
