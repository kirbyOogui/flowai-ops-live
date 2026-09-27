"use client";

import {
  BarChart3,
  Building2,
  CheckCircle2,
  CircleDashed,
  House,
  Inbox,
  KanbanSquare,
  LogOut,
  Plug,
  Sparkles,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { logout, type IntegrationStatus } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import type { AiInfo } from "./workspace-context";

export const VIEWS = ["home", "inbox", "tasks", "members", "analytics", "integrations"] as const;
export type View = (typeof VIEWS)[number];

export const NAV_ITEMS: { view: View; label: string; icon: LucideIcon }[] = [
  { view: "home", label: "ホーム", icon: House },
  { view: "inbox", label: "受信箱", icon: Inbox },
  { view: "tasks", label: "仕事一覧", icon: KanbanSquare },
  { view: "members", label: "メンバー", icon: Users },
  { view: "analytics", label: "分析", icon: BarChart3 },
  { view: "integrations", label: "連携", icon: Plug },
];

export function AppHeader({ aiInfo }: { aiInfo: AiInfo }) {
  const router = useRouter();
  const signOut = async () => {
    await logout().catch(() => undefined);
    router.replace("/");
    router.refresh();
  };
  const aiLabel = aiInfo.provider === "mock" ? "Mock AI" : aiInfo.configured ? `OpenAI ${aiInfo.model}` : "APIキー未設定";
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur sm:px-5">
      <Link href="/" className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Workflow className="size-4.5" aria-hidden />
        </span>
        <span className="text-[15px] font-bold tracking-tight">
          FlowAI <span className="text-primary">OPS</span>
        </span>
      </Link>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <span
          className={cn(
            "hidden h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset md:inline-flex",
            aiInfo.provider === "openai" && aiInfo.configured ? "bg-ai-soft text-ai ring-ai/20" : "bg-amber-50 text-amber-800 ring-amber-200",
          )}
        >
          <Sparkles className="size-3.5" aria-hidden />
          {aiLabel}
        </span>
        <span className="hidden items-center gap-1.5 text-sm font-medium text-muted-foreground sm:inline-flex">
          <Building2 className="size-4" aria-hidden />
          NEXORA株式会社
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="inline-flex h-6 items-center gap-1 rounded-md bg-emerald-50 px-2 text-[11px] font-bold tracking-wider text-emerald-700 ring-1 ring-emerald-200 ring-inset" />
            }
          >
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
            LIVE
          </TooltipTrigger>
          <TooltipContent className="max-w-64">Gmail・Slack・Webフォームと実際に連携して動作しています。返信は実際に送信されます。</TooltipContent>
        </Tooltip>
        <Button variant="ghost" size="icon-sm" onClick={signOut} aria-label="ログアウト">
          <LogOut />
        </Button>
      </div>
    </header>
  );
}

function ChannelStatus({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <li className="flex items-center gap-1.5">
      {ok ? <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden /> : <CircleDashed className="size-3.5 text-muted-foreground" aria-hidden />}
      <span className="font-medium text-foreground">{label}</span>
      <span className="truncate">{detail ?? (ok ? "接続済み" : "未接続")}</span>
    </li>
  );
}

export function SideNav({
  view,
  onChange,
  counts,
  integrations,
}: {
  view: View;
  onChange: (view: View) => void;
  counts: Partial<Record<View, number>>;
  integrations: IntegrationStatus | null;
}) {
  return (
    <nav aria-label="メインメニュー" className="hidden w-56 shrink-0 flex-col border-r bg-sidebar p-3 md:flex">
      <ul className="space-y-0.5">
        {NAV_ITEMS.map(({ view: v, label, icon: Icon }) => {
          const active = v === view;
          return (
            <li key={v}>
              <button
                type="button"
                onClick={() => onChange(v)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-muted",
                )}
              >
                <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
                {label}
                {counts[v] ? (
                  <span
                    className={cn(
                      "ml-auto rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {counts[v]}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="mb-2 font-semibold text-foreground">受付窓口</p>
        <ul className="space-y-1.5">
          <ChannelStatus
            label="Gmail"
            ok={Boolean(integrations?.gmail.connected && !integrations.gmail.error)}
            detail={integrations?.gmail.error ? "接続エラー" : integrations?.gmail.email}
          />
          <ChannelStatus label="Slack" ok={Boolean(integrations?.slack.connected)} detail={integrations?.slack.team} />
          <ChannelStatus label="フォーム" ok detail="公開中" />
        </ul>
      </div>
    </nav>
  );
}

export function MobileNav({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  return (
    <nav
      aria-label="メインメニュー"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {NAV_ITEMS.map(({ view: v, label, icon: Icon }) => {
        const active = v === view;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-current={active ? "page" : undefined}
            className={cn("flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium", active ? "text-primary" : "text-muted-foreground")}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
