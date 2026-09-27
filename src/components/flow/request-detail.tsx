"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Bot, CheckCircle2, ExternalLink, Inbox, Play, RotateCcw, Sparkles, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STATUSES, STATUS_LABEL, type RequestStatus } from "@/lib/domain";
import { formatDateTime, formatTime } from "@/lib/dates";
import type { ActivityDTO, RequestDTO } from "@/lib/types";
import { AnalysisFields } from "./analysis-fields";
import { AiMark, SourceBadge, STATUS_ICON } from "./badges";
import { ReplyPanel } from "./reply";
import { useWorkspace } from "./workspace-context";

export function RequestDetail({ request, onClose }: { request: RequestDTO; onClose?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <header className="border-b bg-card px-5 pt-4 pb-4">
        <div className="flex items-center gap-2">
          <SourceBadge source={request.sourceType} />
          <span className="text-xs text-muted-foreground">
            {request.requesterName}・{formatDateTime(request.receivedAt)} 受信
          </span>
          {onClose && (
            <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={onClose} aria-label="詳細を閉じる">
              <X />
            </Button>
          )}
        </div>
        <h2 className="mt-2 text-lg leading-snug font-semibold">{request.title}</h2>
        <StatusControl request={request} />
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto bg-muted/30 p-4 sm:p-5">
        <AnalysisCard request={request} />
        <ReplyPanel request={request} />
        <OriginalMessage request={request} />
        <ProcessingTrace activities={request.activities} />
      </div>
    </div>
  );
}

const NEXT_STATUS: Record<RequestStatus, { to: RequestStatus; label: string; icon: typeof Play } | null> = {
  todo: { to: "in_progress", label: "対応を開始", icon: Play },
  in_progress: { to: "done", label: "完了にする", icon: CheckCircle2 },
  done: null,
};

function StatusControl({ request }: { request: RequestDTO }) {
  const { updateRequest } = useWorkspace();
  const [pending, setPending] = useState<RequestStatus | null>(null);
  const next = NEXT_STATUS[request.status];

  const change = async (status: RequestStatus) => {
    if (status === request.status || pending) return;
    setPending(status);
    await updateRequest(request.id, { status });
    setPending(null);
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <div role="radiogroup" aria-label="状態" className="inline-flex rounded-lg bg-muted p-0.5">
        {STATUSES.map((status) => {
          const Icon = STATUS_ICON[status];
          const active = request.status === status;
          return (
            <button
              key={status}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => change(status)}
              disabled={pending !== null}
              className={cn(
                "relative inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId={`status-pill-${request.id}`}
                  className="absolute inset-0 rounded-md bg-card shadow-sm ring-1 ring-border"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <Icon
                className={cn(
                  "relative size-3.5",
                  active && status === "in_progress" && "text-blue-600",
                  active && status === "done" && "text-emerald-600",
                )}
                aria-hidden
              />
              <span className="relative">{STATUS_LABEL[status]}</span>
            </button>
          );
        })}
      </div>
      {next ? (
        <Button size="sm" onClick={() => change(next.to)} disabled={pending !== null} className="ml-auto">
          <next.icon data-icon="inline-start" />
          {next.label}
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => change("in_progress")} disabled={pending !== null} className="ml-auto">
          <RotateCcw data-icon="inline-start" />
          対応中に戻す
        </Button>
      )}
    </div>
  );
}

function providerLabel(request: RequestDTO) {
  const a = request.analysis;
  if (!a) return null;
  const seconds = a.latencyMs ? `${(a.latencyMs / 1000).toFixed(1)}秒` : null;
  if (a.provider === "mock") return `Mock AI（キーワード判定）${seconds ? `・${seconds}` : ""}`;
  return `OpenAI ${a.model}${seconds ? `・${seconds}` : ""}`;
}

function AnalysisCard({ request }: { request: RequestDTO }) {
  return (
    <section aria-labelledby={`analysis-${request.id}`} className="rounded-xl border border-ai/15 bg-card shadow-xs">
      <div className="flex flex-wrap items-center gap-2 rounded-t-xl border-b border-ai/10 bg-gradient-to-r from-ai-soft/80 to-transparent px-4 py-3">
        <Sparkles className="size-4 text-ai" aria-hidden />
        <h3 id={`analysis-${request.id}`} className="text-sm font-semibold">
          AI分析結果
        </h3>
        <span className="text-[11px] text-muted-foreground">{providerLabel(request)}</span>
        <span className="ml-auto text-[11px] text-muted-foreground">各項目は編集できます</span>
      </div>
      <div className="px-4">
        {request.analysis?.intent && (
          <p className="border-b py-3 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">依頼の意図：</span>
            {request.analysis.intent}
          </p>
        )}
        <AnalysisFields request={request} />
      </div>
    </section>
  );
}

function OriginalMessage({ request }: { request: RequestDTO }) {
  const meta = request.sourceMetadata;
  const rows: [string, string][] =
    meta.sourceType === "email"
      ? [
          ["差出人", `${meta.from} <${meta.fromEmail}>`],
          ["件名", meta.subject],
        ]
      : meta.sourceType === "slack"
        ? [
            ["チャンネル", meta.channel],
            ["投稿者", meta.author],
          ]
        : [
            ["フォーム", meta.formName],
            ["依頼者", meta.requester],
            ["メール", meta.email],
            ["件名", meta.subject],
          ];

  return (
    <section aria-labelledby={`original-${request.id}`} className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Inbox className="size-4 text-muted-foreground" aria-hidden />
        <h3 id={`original-${request.id}`} className="text-sm font-semibold">
          元の依頼
        </h3>
        <SourceBadge source={request.sourceType} className="ml-auto" />
      </div>
      <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1 px-4 pt-3 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="m-4 mt-3 rounded-lg bg-muted/60 p-3 text-[13px] leading-relaxed whitespace-pre-wrap">{request.originalMessage}</p>
      {meta.sourceType === "email" && (
        <a
          href={`https://mail.google.com/mail/u/0/#all/${meta.threadId}`}
          target="_blank"
          rel="noreferrer"
          className="mx-4 mb-4 -mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <ExternalLink className="size-3" aria-hidden />
          Gmail でスレッドを開く
        </a>
      )}
    </section>
  );
}

const ACTOR_STYLE: Record<ActivityDTO["actor"], { icon: typeof Bot; className: string; label: string }> = {
  ai: { icon: Sparkles, className: "bg-ai-soft text-ai ring-ai/20", label: "AI" },
  human: { icon: UserRound, className: "bg-blue-50 text-blue-700 ring-blue-200", label: "人" },
  system: { icon: ArrowRight, className: "bg-slate-100 text-slate-600 ring-slate-200", label: "システム" },
};

function ProcessingTrace({ activities }: { activities: ActivityDTO[] }) {
  return (
    <section aria-label="AI処理履歴" className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Bot className="size-4 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-semibold">AI処理履歴</h3>
        <AiMark label="Processing Trace" className="ml-auto" />
      </div>
      <ol className="relative px-4 py-3">
        {activities.map((a, i) => {
          const style = ACTOR_STYLE[a.actor];
          const Icon = style.icon;
          return (
            <li
              key={a.id}
              className="relative flex gap-3 pb-3 duration-300 animate-in fade-in slide-in-from-left-1 last:pb-0"
            >
              {i < activities.length - 1 && <span className="absolute top-6 bottom-0 left-[11px] w-px bg-border" aria-hidden />}
              <span
                className={cn("relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full ring-1 ring-inset", style.className)}
                title={style.label}
              >
                <Icon className="size-3" aria-hidden />
                <span className="sr-only">{style.label}</span>
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[13px] leading-snug">{a.description}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">{formatTime(a.createdAt)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
