"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { motion } from "motion/react";
import { CalendarCheck2, Timer, UserCheck, UserRoundPen } from "lucide-react";
import { CATEGORIES, CATEGORY_LABEL, PRIORITIES, PRIORITY_LABEL, SOURCE_LABEL, SOURCE_TYPES } from "@/lib/domain";
import type { RequestDTO } from "@/lib/types";
import { ViewHeader } from "./views";
import { useWorkspace } from "./workspace-context";

type Row = { key: string; label: string; value: number };

/** 横棒グラフ（単一系列）。値はバーの先端に表示し、ホバーで割合を表示する */
function HBarChart({ rows, unit = "件", emptyText }: { rows: Row[]; unit?: string; emptyText: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (total === 0) return <p className="py-6 text-center text-xs text-muted-foreground">{emptyText}</p>;

  return (
    <ul className="space-y-1">
      {rows.map((r) => {
        const share = Math.round((r.value / total) * 100);
        return (
          <li
            key={r.key}
            className="group relative grid grid-cols-[6.5rem_1fr] items-center gap-3 rounded-md px-1 py-1.5 hover:bg-muted/60"
            onMouseEnter={() => setHover(r.key)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="truncate text-xs text-muted-foreground" title={r.label}>
              {r.label}
            </span>
            {/* 値ラベルをバーの先端に置くため、バーの最大幅は行の 75% に抑える */}
            <div className="flex min-w-0 items-center gap-2">
              <motion.span
                className="block h-3 shrink-0 rounded-r-[4px] bg-chart-1"
                initial={{ width: 0 }}
                animate={{ width: `${(r.value / max) * 75}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
                style={{ minWidth: r.value > 0 ? 3 : 0 }}
                aria-hidden
              />
              <span className="shrink-0 text-xs font-semibold whitespace-nowrap tabular-nums">
                {r.value}
                <span className="font-normal text-muted-foreground">{unit}</span>
              </span>
            </div>
            {hover === r.key && (
              <span
                role="tooltip"
                className="pointer-events-none absolute -top-8 left-28 z-10 rounded-md bg-foreground px-2 py-1 text-[11px] whitespace-nowrap text-background shadow-md"
              >
                {r.label}：{r.value}
                {unit}（全体の{share}%）
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-xs">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mb-3 text-xs text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}

function Kpi({ icon: Icon, label, value, caption }: { icon: typeof Timer; label: string; value: string; caption: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="size-4 text-ai" aria-hidden />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{caption}</p>
    </div>
  );
}

export function AnalyticsView({ requests, actions }: { requests: RequestDTO[]; actions?: ReactNode }) {
  const { members } = useWorkspace();
  const analyzed = requests.filter((r) => r.analysis);
  const aiDecided = analyzed.filter((r) => r.analysis?.suggestedAssigneeId);
  const kept = aiDecided.filter((r) => r.assigneeId === r.analysis?.suggestedAssigneeId);
  const corrected = aiDecided.length - kept.length;
  const handedBack = analyzed.filter((r) => !r.analysis?.suggestedAssigneeId).length;
  const withDue = analyzed.filter((r) => r.analysis?.dueSourceText).length;
  const latencies = analyzed.map((r) => r.analysis?.latencyMs).filter((v): v is number => typeof v === "number");
  const avgLatency = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length / 1000 : 0;
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

  const open = requests.filter((r) => r.status !== "done");
  const byCategory = CATEGORIES.map((c) => ({ key: c, label: CATEGORY_LABEL[c], value: requests.filter((r) => r.category === c).length }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  const byMember = members
    .map((m) => ({ key: m.id, label: m.name, value: open.filter((r) => r.assigneeId === m.id).length }))
    .sort((a, b) => b.value - a.value);
  const unassigned = open.filter((r) => !r.assigneeId).length;
  const bySource = SOURCE_TYPES.map((s) => ({ key: s, label: SOURCE_LABEL[s], value: requests.filter((r) => r.sourceType === s).length }));
  const byPriority = PRIORITIES.map((p) => ({ key: p, label: PRIORITY_LABEL[p], value: open.filter((r) => r.priority === p).length }));

  return (
    <div className="space-y-6">
      <ViewHeader title="分析" description="AIによる振り分けの状況と、チームの負荷。" actions={actions} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={UserCheck} label="AI自動割り当て率" value={pct(aiDecided.length, analyzed.length)} caption={`${analyzed.length}件中 ${aiDecided.length}件をAIが担当者まで決定`} />
        <Kpi icon={UserRoundPen} label="人が判断した件数" value={`${corrected + handedBack}件`} caption={`AIが判断を戻した ${handedBack}件・人が修正 ${corrected}件`} />
        <Kpi icon={CalendarCheck2} label="期限の抽出率" value={pct(withDue, analyzed.length)} caption="期限の記載がない依頼は期限なしで登録" />
        <Kpi icon={Timer} label="平均AI処理時間" value={latencies.length ? `${avgLatency.toFixed(1)}秒` : "—"} caption="受信から仕事として登録するまで" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="担当者別の未完了の仕事" description={`AIの振り分けで偏りが出ていないかを確認します${unassigned ? `（担当者の確認待ち ${unassigned}件）` : ""}`}>
          <HBarChart rows={byMember} emptyText="未完了の仕事はありません" />
        </Panel>
        <Panel title="カテゴリ別の依頼数" description="AIが判定したカテゴリの内訳（全期間）">
          <HBarChart rows={byCategory} emptyText="依頼がありません" />
        </Panel>
        <Panel title="重要度別の未完了の仕事" description="緊急・高の仕事が溜まっていないか">
          <HBarChart rows={byPriority} emptyText="未完了の仕事はありません" />
        </Panel>
        <Panel title="受付元別の依頼数" description="どのチャネルから依頼が届いているか">
          <HBarChart rows={bySource} emptyText="依頼がありません" />
        </Panel>
      </div>
    </div>
  );
}
