import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getAiInfo, runAnalysisPipeline } from "@/lib/ai";
import { AiError } from "@/lib/ai/errors";
import type { AnalysisStepKey } from "@/lib/ai/steps";
import { todayISO } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { deserializeMessage, serializeMessage, type NormalizedMessage, type SerializedMessage } from "@/lib/ingestion";
import { consume, envLimit, RateLimitError } from "@/lib/rate-limit";
import { findHistoryCandidates } from "@/lib/services/history";
import { createRequestFromAnalysis } from "@/lib/services/requests";

// 受信 → AI 分析 → 依頼の登録。
// Webhook は recordInbound で保存したらすぐ応答し、processInbound は after() などで後から実行する。

/** 処理中のまま止まった（関数のタイムアウトなど）とみなすまでの時間 */
const STALE_PROCESSING_MS = 5 * 60_000;

export class AlreadyHandledError extends Error {}

/** 受信を保存する。同じ受付元・外部 ID のものは二重に保存しない */
export async function recordInbound(message: NormalizedMessage, externalId: string): Promise<{ id: string; duplicate: boolean }> {
  try {
    const row = await prisma.inboundMessage.create({
      data: {
        source: message.sourceType,
        externalId,
        payload: serializeMessage(message),
        receivedAt: message.receivedAt,
      },
    });
    return { id: row.id, duplicate: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.inboundMessage.findUniqueOrThrow({
        where: { source_externalId: { source: message.sourceType, externalId } },
      });
      return { id: existing.id, duplicate: true };
    }
    throw error;
  }
}

/**
 * 受信を AI で分析して依頼として登録し、依頼の ID を返す。
 * 同じ受信を同時に 2 回処理しないよう、状態を「processing」にできたときだけ実行する。
 */
export async function processInbound(inboundId: string, options: { onStep?: (step: AnalysisStepKey) => void } = {}): Promise<string> {
  const claimed = await prisma.inboundMessage.updateMany({
    where: {
      id: inboundId,
      OR: [
        { status: { in: ["received", "failed"] } },
        { status: "processing", updatedAt: { lt: new Date(Date.now() - STALE_PROCESSING_MS) } },
      ],
    },
    data: { status: "processing", error: null, attempts: { increment: 1 } },
  });
  if (claimed.count === 0) throw new AlreadyHandledError(inboundId);

  const inbound = await prisma.inboundMessage.findUniqueOrThrow({ where: { id: inboundId } });
  const message = deserializeMessage(inbound.payload as SerializedMessage);

  try {
    if (getAiInfo().provider === "openai") {
      await consume("ai", envLimit("AI_LIMIT_PER_DAY", 200), 24 * 60 * 60 * 1000).catch((e) => {
        throw e instanceof RateLimitError ? new AiError("ai_quota") : e;
      });
    }
    const history = await findHistoryCandidates(prisma, message);
    const result = await runAnalysisPipeline(message, { today: todayISO(message.receivedAt), history, onStep: options.onStep });

    return await prisma.$transaction(async (tx) => {
      const requestId = await createRequestFromAnalysis(tx, inboundId, message, result, history);
      await tx.inboundMessage.update({ where: { id: inboundId }, data: { status: "processed", error: null } });
      return requestId;
    });
  } catch (error) {
    const code = error instanceof AiError ? error.code : "internal";
    console.error(`[pipeline] inbound ${inboundId} failed: ${code}`, error instanceof AiError ? error.message : error);
    await prisma.inboundMessage.update({ where: { id: inboundId }, data: { status: "failed", error: code } });
    throw error;
  }
}

/** Webhook の after() から呼ぶ用。失敗は記録済みなので、ここでは握りつぶす */
export async function processInboundInBackground(inboundId: string) {
  await processInbound(inboundId).catch((error) => {
    if (!(error instanceof AlreadyHandledError)) console.error("[pipeline] background processing failed", inboundId);
  });
}
