"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Loader2, X } from "lucide-react";
import { ANALYSIS_STEPS, STEP_INDEX, type AnalysisStepKey } from "@/lib/ai/steps";
import { cn } from "@/lib/utils";

export type StepState = "pending" | "active" | "done" | "failed";

export function stepStates(active: AnalysisStepKey | null, phase: "running" | "done" | "failed"): StepState[] {
  const current = active ? STEP_INDEX[active] : -1;
  return ANALYSIS_STEPS.map((_, i) => {
    if (phase === "done") return "done";
    if (i < current) return "done";
    if (i === current) return phase === "failed" ? "failed" : "active";
    return "pending";
  });
}

/** AI 処理のステップと進捗バー。進み具合は実際のストリーミング出力に連動する */
export function AnalysisProgress({
  active,
  phase,
}: {
  active: AnalysisStepKey | null;
  phase: "running" | "done" | "failed";
}) {
  const states = stepStates(active, phase);
  const total = ANALYSIS_STEPS.length;
  const doneCount = states.filter((s) => s === "done").length;
  // 処理中のステップは半分進んだものとして表示する
  const percent = phase === "done" ? 100 : Math.round(((doneCount + (phase === "running" ? 0.5 : 0)) / total) * 100);

  return (
    <div className="space-y-5" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="relative flex size-9 items-center justify-center rounded-xl bg-ai-soft text-ai">
          {phase === "running" && <span className="absolute inset-0 animate-ping rounded-xl bg-ai/15" aria-hidden />}
          {phase === "failed" ? <X className="size-5 text-destructive" /> : phase === "done" ? <Check className="size-5" /> : <Loader2 className="size-5 animate-spin" />}
        </span>
        <div>
          <p className="text-sm font-semibold">
            {phase === "failed" ? "AIによる分析を完了できませんでした" : phase === "done" ? "分析が完了しました" : "AIが依頼を分析しています"}
          </p>
          <p className="text-xs text-muted-foreground">1回のAI呼び出しで構造化データを生成し、生成の進み具合に合わせて各ステップを表示しています</p>
        </div>
      </div>

      <ol className="grid gap-1.5 sm:grid-cols-2 sm:gap-x-6">
        {ANALYSIS_STEPS.map((step, i) => (
          <StepRow key={step.key} label={step.label} state={states[i]} />
        ))}
      </ol>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {doneCount} / {total} ステップ
          </span>
          <span className={cn("font-semibold tabular-nums", phase === "failed" ? "text-destructive" : "text-ai")}>{percent}%</span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="AI分析の進捗"
        >
          <motion.div
            className={cn("h-full rounded-full", phase === "failed" ? "bg-destructive/70" : "bg-gradient-to-r from-primary to-ai")}
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ type: "spring", stiffness: 90, damping: 20 }}
          />
        </div>
      </div>
    </div>
  );
}

function StepRow({ label, state }: { label: string; state: StepState }) {
  return (
    <li className="flex items-center gap-2.5 py-1">
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          state === "done" && "border-emerald-500 bg-emerald-500 text-white",
          state === "active" && "border-ai bg-ai-soft text-ai",
          state === "failed" && "border-destructive bg-destructive text-white",
          state === "pending" && "border-border bg-card",
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {state === "done" && (
            <motion.span key="done" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 22 }}>
              <Check className="size-3" strokeWidth={3} aria-hidden />
            </motion.span>
          )}
          {state === "active" && (
            <motion.span key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Loader2 className="size-3 animate-spin" aria-hidden />
            </motion.span>
          )}
          {state === "failed" && <X key="failed" className="size-3" strokeWidth={3} aria-hidden />}
        </AnimatePresence>
      </span>
      <span
        className={cn(
          "text-sm transition-colors",
          state === "pending" && "text-muted-foreground",
          state === "active" && "font-medium text-ai",
          state === "failed" && "font-medium text-destructive",
        )}
      >
        {label}
        {state === "active" && "…"}
        <span className="sr-only">
          {state === "done" ? "（完了）" : state === "active" ? "（処理中）" : state === "failed" ? "（失敗）" : "（未実行）"}
        </span>
      </span>
    </li>
  );
}
