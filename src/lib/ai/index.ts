import "server-only";
import type { ReasoningEffort } from "openai/resources/shared";
import type { NormalizedMessage } from "@/lib/ingestion";
import { AiError } from "./errors";
import { finalizeAnalysis, type AnalysisDecision } from "./postprocess";
import { MockProvider } from "./providers/mock";
import { OpenAIProvider } from "./providers/openai";
import type { AiProvider, AnalyzeOptions, ProviderName } from "./providers/types";

const DEFAULT_MODEL = "gpt-6-sol";
const EFFORTS: ReasoningEffort[] = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];

export type AiInfo = { provider: ProviderName; model: string; configured: boolean };

function readConfig() {
  const provider: ProviderName = process.env.AI_PROVIDER === "mock" ? "mock" : "openai";
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const rawEffort = process.env.OPENAI_REASONING_EFFORT?.trim();
  const effort = rawEffort === "" ? undefined : ((EFFORTS.find((e) => e === rawEffort) ?? "low") as ReasoningEffort);
  return { provider, apiKey, model, effort };
}

/** 画面に表示する AI の構成（キーの値そのものは返さない） */
export function getAiInfo(): AiInfo {
  const { provider, apiKey, model } = readConfig();
  return provider === "mock"
    ? { provider, model: new MockProvider().model, configured: true }
    : { provider, model, configured: apiKey.length > 0 };
}

function createProvider(): AiProvider {
  const { provider, apiKey, model, effort } = readConfig();
  if (provider === "mock") return new MockProvider();
  if (!apiKey) throw new AiError("missing_api_key");
  return new OpenAIProvider(apiKey, model, effort);
}

export type PipelineResult = {
  decision: AnalysisDecision;
  raw: unknown;
  provider: ProviderName;
  model: string;
  latencyMs: number;
};

/** AI Pipeline: 正規化済みの依頼 → 構造化出力 → 業務ルールで検証済みの判断 */
export async function runAnalysisPipeline(
  message: NormalizedMessage,
  options: AnalyzeOptions,
): Promise<PipelineResult> {
  const provider = createProvider();
  const startedAt = Date.now();
  const raw = await provider.analyze(message, options);
  const candidate = (ref: string) => {
    const index = /^H(\d+)$/i.exec(ref)?.[1];
    return index ? options.history[Number(index) - 1] : undefined;
  };
  const decision = finalizeAnalysis(raw, {
    resolve: (ref) => candidate(ref)?.id ?? null,
    label: (ref) => candidate(ref)?.title ?? null,
  });
  return { decision, raw, provider: provider.name, model: provider.model, latencyMs: Date.now() - startedAt };
}
