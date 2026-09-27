"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, MousePointerClick, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ApiError, fetchIntegrations, fetchWorkspace, patchRequest, syncGmail, type IntegrationStatus } from "@/lib/client/api";
import { todayISO } from "@/lib/dates";
import { SOURCE_LABEL } from "@/lib/domain";
import type { RequestPatch } from "@/lib/services/requests";
import type { InboundIssueDTO, MemberDTO, RequestDTO } from "@/lib/types";
import { AnalyticsView } from "./analytics-view";
import { InboundStatusList } from "./inbound-status";
import { IntegrationsView } from "./integrations-view";
import { MembersView } from "./members-view";
import { RequestDetail } from "./request-detail";
import { AppHeader, MobileNav, SideNav, type View } from "./shell";
import { HomeView, InboxView, sortByAttention, TasksView } from "./views";
import { WorkspaceContext, type AiInfo, type WorkspaceContextValue } from "./workspace-context";

const DESKTOP_QUERY = "(min-width: 1280px)";
/** 新着の確認間隔（画面を開いている間だけ） */
const POLL_INTERVAL_MS = 5_000;
/** Pub/Sub を使わない場合の、Gmail の自動同期の間隔 */
const GMAIL_SYNC_INTERVAL_MS = 60_000;

function useIsDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(DESKTOP_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

/** 画面が表示されている間だけ、一定間隔で callback を呼ぶ */
function useVisibleInterval(callback: () => void, ms: number, enabled = true) {
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  }, [callback]);
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") saved.current();
    }, ms);
    return () => clearInterval(timer);
  }, [ms, enabled]);
}

export function Workspace({
  initialRequests,
  initialInbound,
  initialIntegrations,
  initialView,
  members,
  today: initialToday,
  aiInfo,
}: {
  initialRequests: RequestDTO[];
  initialInbound: InboundIssueDTO[];
  initialIntegrations: IntegrationStatus;
  initialView: View;
  members: MemberDTO[];
  today: string;
  aiInfo: AiInfo;
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [inbound, setInbound] = useState(initialInbound);
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(initialIntegrations);
  const [view, setView] = useState<View>(initialView);
  // undefined = まだ誰も選んでいない（PC では要対応順の先頭を自動で表示する）
  const [chosenId, setSelectedId] = useState<string | null | undefined>(undefined);
  const [recentIds, setRecentIds] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [today, setToday] = useState(initialToday);
  const knownIds = useRef(new Set(initialRequests.map((r) => r.id)));
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const selectedId = chosenId !== undefined ? chosenId : isDesktop ? (sortByAttention(requests)[0]?.id ?? null) : null;

  useVisibleInterval(() => setToday(todayISO()), 60_000);

  // Gmail の接続結果（OAuth から戻ってきたとき）を一度だけ知らせ、URL を元に戻す
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gmail = params.get("gmail");
    if (gmail === "connected") toast.success(`Gmail（${params.get("email") ?? ""}）を接続しました`);
    if (gmail === "error") toast.error(`Gmail の接続に失敗しました：${params.get("reason") ?? ""}`);
    if (params.size > 0) window.history.replaceState(null, "", "/app");
  }, []);

  const markRecent = useCallback((id: string) => {
    setRecentIds((s) => new Set(s).add(id));
    setTimeout(() => {
      setRecentIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }, 8000);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchWorkspace();
      for (const r of data.requests) {
        if (knownIds.current.has(r.id)) continue;
        knownIds.current.add(r.id);
        markRecent(r.id);
        toast.info(`${SOURCE_LABEL[r.sourceType]}から新しい依頼：${r.title}`, { description: "AIが分析して登録しました" });
      }
      setRequests(data.requests);
      setInbound(data.inbound);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) router.replace("/login?next=/app");
    }
  }, [markRecent, router]);

  const refreshIntegrations = useCallback(() => {
    fetchIntegrations().then(setIntegrations, () => undefined);
  }, []);

  useVisibleInterval(refresh, POLL_INTERVAL_MS);

  const gmailConnected = Boolean(integrations?.gmail.connected);
  const runGmailSync = useCallback(
    async (silent: boolean) => {
      if (!silent) setSyncing(true);
      try {
        const result = await syncGmail();
        if (!silent) toast.success(result.imported ? `${result.imported}件の新着メールを取り込みました。AIが分析しています` : "新着メールはありません");
        await refresh();
      } catch (error) {
        if (!silent) toast.error(error instanceof ApiError ? error.message : "受信に失敗しました");
      } finally {
        if (!silent) setSyncing(false);
      }
    },
    [refresh],
  );
  useVisibleInterval(() => runGmailSync(true), GMAIL_SYNC_INTERVAL_MS, gmailConnected && !integrations?.gmail.realtime);

  const upsertRequest = useCallback((request: RequestDTO) => {
    knownIds.current.add(request.id);
    setRequests((list) => {
      const exists = list.some((r) => r.id === request.id);
      return exists ? list.map((r) => (r.id === request.id ? request : r)) : [request, ...list];
    });
  }, []);

  const updateRequest = useCallback(
    async (id: string, patch: RequestPatch) => {
      try {
        const updated = await patchRequest(id, patch);
        upsertRequest(updated);
        return updated;
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : "更新に失敗しました");
        return null;
      }
    },
    [upsertRequest],
  );

  const memberById = useCallback((id: string | null) => members.find((m) => m.id === id), [members]);

  const ctx = useMemo<WorkspaceContextValue>(
    () => ({ requests, members, memberById, today, aiInfo, updateRequest, upsertRequest, selectRequest: setSelectedId }),
    [requests, members, memberById, today, aiInfo, updateRequest, upsertRequest],
  );

  const selected = requests.find((r) => r.id === selectedId) ?? null;
  const headerActions = (
    <>
      {gmailConnected && (
        <Button variant="outline" onClick={() => runGmailSync(false)} disabled={syncing}>
          <RefreshCw data-icon="inline-start" className={syncing ? "animate-spin" : undefined} />
          今すぐ受信
        </Button>
      )}
      <Button variant="outline" nativeButton={false} render={<a href="/form" target="_blank" rel="noreferrer" />}>
        <ExternalLink data-icon="inline-start" />
        依頼フォーム
      </Button>
    </>
  );
  const listProps = { requests, selectedId, recentIds, actions: headerActions };
  const counts = {
    home: requests.filter((r) => r.reviewState === "needs_review").length + inbound.filter((i) => i.status === "failed").length,
    inbox: requests.length,
    tasks: requests.filter((r) => r.status !== "done").length,
  };
  const inboundList = <InboundStatusList items={inbound} onRetried={refresh} />;

  return (
    <WorkspaceContext.Provider value={ctx}>
      <div className="flex h-dvh flex-col">
        <AppHeader aiInfo={aiInfo} />
        <div className="flex min-h-0 flex-1">
          <SideNav view={view} onChange={setView} counts={counts} integrations={integrations} />

          <main className="min-w-0 flex-1 overflow-y-auto px-4 pt-5 pb-24 sm:px-6 md:pb-8">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
                className="mx-auto max-w-5xl"
              >
                {view === "home" && <HomeView {...listProps} top={inboundList} />}
                {view === "inbox" && <InboxView {...listProps} top={inboundList} />}
                {view === "tasks" && <TasksView {...listProps} />}
                {view === "members" && <MembersView requests={requests} actions={headerActions} />}
                {view === "analytics" && <AnalyticsView requests={requests} actions={headerActions} />}
                {view === "integrations" && (
                  <IntegrationsView status={integrations} onChanged={refreshIntegrations} onSync={() => runGmailSync(false)} syncing={syncing} />
                )}
              </motion.div>
            </AnimatePresence>
          </main>

          {isDesktop && (
            <aside aria-label="仕事の詳細" className="w-[460px] shrink-0 overflow-hidden border-l bg-card 2xl:w-[520px]">
              {/* 初回表示はアニメーションさせない（SSR の HTML をそのまま見せる） */}
              <AnimatePresence mode="wait" initial={false}>
                {selected ? (
                  <motion.div key={selected.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }} className="h-full">
                    <RequestDetail request={selected} />
                  </motion.div>
                ) : (
                  <DetailEmptyState key="empty" />
                )}
              </AnimatePresence>
            </aside>
          )}
        </div>
        <MobileNav view={view} onChange={setView} />
      </div>

      {!isDesktop && (
        <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
          <SheetContent side="right" showCloseButton={false} className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
            <SheetTitle className="sr-only">仕事の詳細</SheetTitle>
            {selected && <RequestDetail request={selected} onClose={() => setSelectedId(null)} />}
          </SheetContent>
        </Sheet>
      )}
    </WorkspaceContext.Provider>
  );
}

function DetailEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-primary">
        <MousePointerClick className="size-6" aria-hidden />
      </span>
      <p className="mt-4 text-sm font-semibold">仕事を選択してください</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Gmail・Slack・フォームに届いた依頼を AI が分析すると、ここに分析結果・返信案・処理履歴が表示されます。
      </p>
    </div>
  );
}

