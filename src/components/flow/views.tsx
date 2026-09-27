"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CheckCircle2, Inbox, Layers, Siren, Sparkles, UserRoundSearch, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRIORITIES, SOURCE_LABEL, SOURCE_TYPES, STATUSES, STATUS_LABEL, type SourceType } from "@/lib/domain";
import { formatDateTime, weekdayJa } from "@/lib/dates";
import type { RequestDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MemberAvatar, PriorityBadge, SourceIcon, STATUS_ICON } from "./badges";
import { RequestCard } from "./request-card";
import { useWorkspace } from "./workspace-context";

export type ListProps = {
  requests: RequestDTO[];
  selectedId: string | null;
  recentIds: Set<string>;
  /** 見出しの右側に置く操作（今すぐ受信など） */
  actions?: ReactNode;
  /** 見出しの下に置く内容（分析中の受信など） */
  top?: ReactNode;
};

// ─── 並び順 ───────────────────────────────────────────

const priorityRank = (r: RequestDTO) => PRIORITIES.indexOf(r.priority);

/** 要対応順：未完了 → 担当者確認待ち → 重要度 → 期限が近い → 新しい */
export function sortByAttention(requests: RequestDTO[]) {
  return [...requests].sort(
    (a, b) =>
      Number(a.status === "done") - Number(b.status === "done") ||
      Number(b.reviewState === "needs_review") - Number(a.reviewState === "needs_review") ||
      priorityRank(a) - priorityRank(b) ||
      (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
      b.receivedAt.localeCompare(a.receivedAt),
  );
}

// ─── 共通パーツ ─────────────────────────────────────────

export function ViewHeader({ title, description, actions }: { title: string; description: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-card/60 px-6 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function CardList({ requests, selectedId, recentIds }: Pick<ListProps, "requests" | "selectedId" | "recentIds">) {
  return (
    <motion.ul layout className="grid gap-2.5">
      <AnimatePresence initial={false}>
        {requests.map((r) => (
          <motion.li key={r.id} layout exit={{ opacity: 0, scale: 0.97 }}>
            <RequestCard request={r} selected={r.id === selectedId} isNew={recentIds.has(r.id)} />
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}

// ─── ホーム ──────────────────────────────────────────

type HomeFilter = "all" | "needs_review" | "urgent" | "done";

const STAT_CARDS: { key: HomeFilter; label: string; icon: LucideIcon; tone: string; filter: (r: RequestDTO) => boolean }[] = [
  { key: "all", label: "全ての依頼", icon: Layers, tone: "text-primary bg-accent", filter: () => true },
  {
    key: "needs_review",
    label: "AI確認待ち",
    icon: UserRoundSearch,
    tone: "text-amber-700 bg-amber-100",
    filter: (r) => r.reviewState === "needs_review",
  },
  { key: "urgent", label: "緊急", icon: Siren, tone: "text-red-600 bg-red-50", filter: (r) => r.priority === "urgent" && r.status !== "done" },
  { key: "done", label: "完了", icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-50", filter: (r) => r.status === "done" },
];

function statCaption(key: HomeFilter, requests: RequestDTO[]) {
  const open = requests.filter((r) => r.status !== "done").length;
  switch (key) {
    case "all":
      return `未完了 ${open}件`;
    case "needs_review":
      return "AIが人に判断を戻した依頼";
    case "urgent":
      return "今日中の対応が必要";
    case "done": {
      const rate = requests.length ? Math.round(((requests.length - open) / requests.length) * 100) : 0;
      return `完了率 ${rate}%`;
    }
  }
}

export function HomeView(props: ListProps) {
  const { today } = useWorkspace();
  const [filter, setFilter] = useState<HomeFilter>("all");
  const active = STAT_CARDS.find((c) => c.key === filter)!;
  const list = useMemo(() => sortByAttention(props.requests.filter(active.filter)), [props.requests, active]);
  const [, m, d] = today.split("-").map(Number);

  return (
    <div className="space-y-6">
      <ViewHeader
        title="ホーム"
        description={`${m}月${d}日（${weekdayJa(today)}）の業務状況。届いた依頼はAIが自動で振り分けています。`}
        actions={props.actions}
      />

      {props.top}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STAT_CARDS.map((card) => {
          const count = props.requests.filter(card.filter).length;
          const selected = filter === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => setFilter(selected ? "all" : card.key)}
              aria-pressed={selected}
              className={cn(
                "rounded-xl border bg-card p-4 text-left shadow-xs transition-all hover:shadow-md",
                selected && card.key !== "all" && "border-primary/50 ring-1 ring-primary/30",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
                <span className={cn("flex size-7 items-center justify-center rounded-lg", card.tone)}>
                  <card.icon className="size-4" aria-hidden />
                </span>
              </div>
              <p key={count} className="mt-2 text-2xl font-bold tabular-nums duration-300 animate-in fade-in slide-in-from-top-1">
                {count}
                <span className="ml-0.5 text-sm font-medium text-muted-foreground">件</span>
              </p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{statCaption(card.key, props.requests)}</p>
            </button>
          );
        })}
      </div>

      <section aria-labelledby="home-list">
        <div className="mb-3 flex items-center gap-2">
          <h2 id="home-list" className="text-sm font-semibold">
            {filter === "all" ? "要対応順の仕事" : active.label}
          </h2>
          <span className="text-xs text-muted-foreground">{list.length}件</span>
          {filter !== "all" && (
            <Button variant="ghost" size="xs" onClick={() => setFilter("all")} className="ml-auto">
              すべて表示
            </Button>
          )}
        </div>
        {list.length ? (
          <CardList {...props} requests={list} />
        ) : (
          <EmptyState icon={Sparkles} title="該当する依頼はありません" description="Gmail・Slack・フォームに依頼が届くと、AIが分析してここに表示します。" />
        )}
      </section>
    </div>
  );
}

// ─── 受信箱 ──────────────────────────────────────────

export function InboxView(props: ListProps) {
  const { members, memberById, selectRequest } = useWorkspace();
  const [source, setSource] = useState<SourceType | "all">("all");
  const list = props.requests
    .filter((r) => source === "all" || r.sourceType === source)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  const tabs: { key: SourceType | "all"; label: string }[] = [
    { key: "all", label: "すべて" },
    ...SOURCE_TYPES.map((s) => ({ key: s, label: SOURCE_LABEL[s] })),
  ];

  return (
    <div className="space-y-5">
      <ViewHeader
        title="受信箱"
        description="メール・Slack・フォームから届いた依頼。受信と同時にAIが分析し、担当者へ振り分けます。"
        actions={props.actions}
      />
      {props.top}
      <div role="tablist" aria-label="受付元" className="flex gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const count = props.requests.filter((r) => t.key === "all" || r.sourceType === t.key).length;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={source === t.key}
              onClick={() => setSource(t.key)}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                source === t.key ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span className="tabular-nums opacity-80">{count}</span>
            </button>
          );
        })}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Inbox} title="受信した依頼はありません" description="Gmail・Slack・フォームに依頼が届くと、AIが分析してここに表示します。" />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
          <AnimatePresence initial={false}>
            {list.map((r) => {
              const assignee = memberById(r.assigneeId);
              const meta = r.sourceMetadata;
              const heading = meta.sourceType === "slack" ? `${meta.channel}` : meta.subject;
              return (
                <motion.li key={r.id} layout initial={props.recentIds.has(r.id) ? { opacity: 0, height: 0 } : false} animate={{ opacity: 1, height: "auto" }}>
                  <button
                    type="button"
                    onClick={() => selectRequest(r.id)}
                    aria-pressed={r.id === props.selectedId}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      r.id === props.selectedId && "bg-accent/70",
                      props.recentIds.has(r.id) && "bg-ai-soft/60",
                    )}
                  >
                    <SourceIcon source={r.sourceType} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-semibold">{r.requesterName}</span>
                        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground tabular-nums">{formatDateTime(r.receivedAt)}</span>
                      </div>
                      <p className="truncate text-[13px] font-medium">{heading}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.originalMessage.replace(/\s+/g, " ")}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="inline-flex items-center gap-1 font-medium text-ai">
                          <Sparkles className="size-3" aria-hidden />
                          AI
                          <ArrowRight className="size-3" aria-hidden />
                        </span>
                        <PriorityBadge priority={r.priority} />
                        <span className="inline-flex items-center gap-1">
                          <MemberAvatar member={assignee} members={members} className="size-4 text-[8px]" />
                          <span className={cn("font-medium", !assignee && "text-amber-700")}>{assignee?.name ?? "担当者の確認待ち"}</span>
                        </span>
                        <span className="text-muted-foreground">・{STATUS_LABEL[r.status]}</span>
                      </div>
                    </div>
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

// ─── 仕事一覧（状態別） ────────────────────────────────

export function TasksView(props: ListProps) {
  return (
    <div className="space-y-5">
      <ViewHeader title="仕事一覧" description="状態ごとの仕事。カードを選ぶと、右側で状態の変更や返信ができます。" actions={props.actions} />
      {/* 詳細パネルと並んでも潰れないよう、列は最小幅を保って横スクロールさせる */}
      <div className="-mx-4 grid snap-x auto-cols-[minmax(17.5rem,1fr)] grid-flow-col gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
        {STATUSES.map((status) => {
          const Icon = STATUS_ICON[status];
          const items = sortByAttention(props.requests.filter((r) => r.status === status));
          return (
            <section key={status} aria-labelledby={`col-${status}`} className="snap-start rounded-xl bg-muted/50 p-2.5">
              <div className="mb-2.5 flex items-center gap-2 px-1.5 pt-1">
                <Icon
                  className={cn("size-4", status === "done" ? "text-emerald-600" : status === "in_progress" ? "text-blue-600" : "text-muted-foreground")}
                  aria-hidden
                />
                <h2 id={`col-${status}`} className="text-sm font-semibold">
                  {STATUS_LABEL[status]}
                </h2>
                <span className="rounded-full bg-card px-1.5 text-[11px] font-semibold text-muted-foreground tabular-nums">{items.length}</span>
              </div>
              {items.length ? (
                <CardList {...props} requests={items} />
              ) : (
                <p className="rounded-lg border border-dashed bg-card/60 px-3 py-8 text-center text-xs text-muted-foreground">
                  {status === "done" ? "完了した仕事はまだありません" : "該当する仕事はありません"}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
