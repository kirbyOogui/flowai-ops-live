import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ReasoningEffort } from "openai/resources/shared";
import type { NormalizedMessage } from "@/lib/ingestion";
import { AiError } from "../errors";
import { buildDeveloperPrompt, buildSystemPrompt, buildUserPrompt } from "../prompt";
import { analysisSchema } from "../schema";
import { createStepTracker } from "../steps";
import type { AiProvider, AnalyzeOptions } from "./types";

const REQUEST_TIMEOUT_MS = 60_000;

export class OpenAIProvider implements AiProvider {
  readonly name = "openai" as const;
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    readonly model: string,
    private readonly reasoningEffort: ReasoningEffort | undefined,
  ) {
    this.client = new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });
  }

  async analyze(message: NormalizedMessage, { today, history, onStep, signal }: AnalyzeOptions) {
    const tracker = createStepTracker(onStep);
    tracker.start();

    // SDK のタイムアウトは接続単位なので、ストリーム全体にも上限をかける
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

    try {
      const stream = this.client.responses.stream(
        {
          model: this.model,
          input: [
            { role: "system", content: buildSystemPrompt() },
            { role: "developer", content: buildDeveloperPrompt(today) },
            { role: "user", content: buildUserPrompt(message, history) },
          ],
          text: { format: zodTextFormat(analysisSchema, "request_analysis") },
          ...(this.reasoningEffort ? { reasoning: { effort: this.reasoningEffort } } : {}),
          max_output_tokens: 6000,
          store: false,
        },
        { signal: combined },
      );

      let jsonSoFar = "";
      for await (const event of stream) {
        if (event.type === "response.output_text.delta") {
          jsonSoFar += event.delta;
          tracker.feed(jsonSoFar);
        }
      }

      const response = await stream.finalResponse();

      if (response.status === "incomplete") {
        throw new AiError("incomplete", response.incomplete_details?.reason ?? undefined);
      }
      const refused = response.output.some(
        (item) => item.type === "message" && item.content.some((c) => c.type === "refusal"),
      );
      if (refused) throw new AiError("refusal");
      if (response.output_parsed == null) throw new AiError("invalid_output", "output_parsed is empty");

      return response.output_parsed;
    } catch (error) {
      throw toAiError(error, timeout.aborted);
    }
  }
}

function toAiError(error: unknown, timedOut: boolean): AiError {
  if (error instanceof AiError) return error;
  if (timedOut || error instanceof OpenAI.APIConnectionTimeoutError) return new AiError("timeout");
  if (error instanceof OpenAI.AuthenticationError) return new AiError("auth");
  if (error instanceof OpenAI.RateLimitError) return new AiError("rate_limit", error.message);
  if (error instanceof OpenAI.APIError) return new AiError("api_error", error.message);
  // JSON の解析失敗・スキーマ不一致など、SDK 内部で起きた例外
  return new AiError("invalid_output", error instanceof Error ? error.message : String(error));
}
