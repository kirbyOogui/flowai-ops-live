import type { NormalizedMessage } from "@/lib/ingestion";
import type { HistoryCandidate } from "../history";
import type { AnalysisStepKey } from "../steps";

export type AnalyzeOptions = {
  today: string;
  /** 同じ依頼者の過去の依頼（関連する依頼を特定するための候補） */
  history: HistoryCandidate[];
  /** 処理中のステップが進んだときに呼ばれる（UI の進捗表示用） */
  onStep?: (step: AnalysisStepKey) => void;
  signal?: AbortSignal;
};

export type ProviderName = "openai" | "mock";

export interface AiProvider {
  readonly name: ProviderName;
  readonly model: string;
  /** 検証前の生の構造化出力を返す（検証は postprocess で行う） */
  analyze(message: NormalizedMessage, options: AnalyzeOptions): Promise<unknown>;
}
