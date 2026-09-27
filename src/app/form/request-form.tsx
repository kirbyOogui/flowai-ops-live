"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, CircleAlert, RotateCcw, Send } from "lucide-react";
import { AnalysisProgress } from "@/components/flow/composer/analysis-progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AnalysisStepKey } from "@/lib/ai/steps";
import { FormSubmitError, submitForm } from "@/lib/client/api";
import { describeDue, todayISO } from "@/lib/dates";
import type { FormResultDTO } from "@/lib/types";

type Values = { name: string; email: string; company: string; subject: string; content: string; website: string };
const EMPTY: Values = { name: "", email: "", company: "", subject: "", content: "", website: "" };

type Phase =
  | { name: "input" }
  | { name: "analyzing"; step: AnalysisStepKey | null }
  | { name: "done"; result: FormResultDTO }
  | { name: "accepted_without_ai" }
  | { name: "error"; message: string };

const FIELDS: { key: keyof Values; label: string; placeholder: string; required: boolean; type?: string; multiline?: boolean }[] = [
  { key: "name", label: "お名前", placeholder: "山田 太郎", required: true },
  { key: "email", label: "返信先メールアドレス", placeholder: "you@example.com", required: true, type: "email" },
  { key: "company", label: "会社名", placeholder: "株式会社サンプル（任意）", required: false },
  { key: "subject", label: "件名", placeholder: "例：Proプランの見積もりのお願い", required: true },
  { key: "content", label: "依頼内容", placeholder: "例：来月から50名で利用したいので、今週中に見積書をいただけますか。", required: true, multiline: true },
];

export function RequestForm() {
  const [values, setValues] = useState<Values>(EMPTY);
  const [phase, setPhase] = useState<Phase>({ name: "input" });
  const complete = FIELDS.every((f) => !f.required || values[f.key].trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complete) return;
    setPhase({ name: "analyzing", step: null });
    try {
      const result = await submitForm(values, (step) => setPhase({ name: "analyzing", step }));
      setPhase({ name: "done", result });
    } catch (error) {
      const code = error instanceof FormSubmitError ? error.code : "network";
      if (code === "validation") setPhase({ name: "error", message: (error as FormSubmitError).detail ?? "入力内容を確認してください" });
      else if (code === "rate_limited") setPhase({ name: "error", message: "送信回数の上限に達しました。しばらく時間をおいてからお試しください。" });
      else if (code === "network") setPhase({ name: "error", message: "送信できませんでした。通信状況を確認して、もう一度お試しください。" });
      // 受信は保存済みで、AI の分析だけが失敗した場合
      else setPhase({ name: "accepted_without_ai" });
    }
  };

  const reset = () => {
    setValues(EMPTY);
    setPhase({ name: "input" });
  };

  return (
    <div className="mt-6 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <AnimatePresence mode="wait" initial={false}>
        {(phase.name === "input" || phase.name === "error") && (
          <motion.form key="form" onSubmit={submit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-4">
            {FIELDS.map((f) => (
              <div key={f.key} className="grid gap-1.5">
                <Label htmlFor={`f-${f.key}`}>
                  {f.label}
                  {f.required && (
                    <span className="text-destructive" aria-hidden>
                      *
                    </span>
                  )}
                </Label>
                {f.multiline ? (
                  <Textarea
                    id={`f-${f.key}`}
                    rows={7}
                    maxLength={4000}
                    placeholder={f.placeholder}
                    value={values[f.key]}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    required={f.required}
                  />
                ) : (
                  <Input
                    id={`f-${f.key}`}
                    type={f.type ?? "text"}
                    maxLength={200}
                    placeholder={f.placeholder}
                    value={values[f.key]}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    required={f.required}
                  />
                )}
              </div>
            ))}
            {/* ボット対策：人には見えない項目（入力があれば送信を破棄する） */}
            <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                Website
                <input tabIndex={-1} autoComplete="off" value={values.website} onChange={(e) => setValues((v) => ({ ...v, website: e.target.value }))} />
              </label>
            </div>
            {phase.name === "error" && (
              <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {phase.message}
              </p>
            )}
            <Button type="submit" size="lg" disabled={!complete} className="justify-self-end">
              <Send data-icon="inline-start" />
              送信する
            </Button>
          </motion.form>
        )}

        {phase.name === "analyzing" && (
          <motion.div key="analyzing" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <AnalysisProgress active={phase.step} phase="running" />
          </motion.div>
        )}

        {phase.name === "done" && (
          <motion.div key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="size-5" aria-hidden />
              <p className="font-semibold">依頼を受け付けました</p>
            </div>
            <dl className="grid gap-3 rounded-xl bg-muted/50 p-4 text-sm sm:grid-cols-[7rem_1fr]">
              <dt className="text-muted-foreground">担当部署</dt>
              <dd>{phase.result.department ?? `${phase.result.categoryLabel}（担当者を社内で確認します）`}</dd>
              <dt className="text-muted-foreground">重要度</dt>
              <dd>{phase.result.priorityLabel}</dd>
              <dt className="text-muted-foreground">期限</dt>
              <dd>{describeDue(phase.result.dueDate, todayISO()).label}</dd>
            </dl>
            <p className="text-sm text-muted-foreground">担当者が内容を確認のうえ、入力したメールアドレスへ返信します。</p>
            <Button variant="outline" onClick={reset} className="justify-self-start">
              <RotateCcw data-icon="inline-start" />
              別の依頼を送る
            </Button>
          </motion.div>
        )}

        {phase.name === "accepted_without_ai" && (
          <motion.div key="accepted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-3">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="size-5" aria-hidden />
              <p className="font-semibold">依頼を受け付けました</p>
            </div>
            <p className="text-sm text-muted-foreground">AIによる自動の振り分けを完了できなかったため、担当者が内容を確認して返信します。</p>
            <Button variant="outline" onClick={reset} className="justify-self-start">
              <RotateCcw data-icon="inline-start" />
              別の依頼を送る
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
