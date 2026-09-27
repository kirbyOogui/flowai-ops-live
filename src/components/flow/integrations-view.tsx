"use client";

import { useState, type ReactNode } from "react";
import { CheckCircle2, CircleDashed, Copy, ExternalLink, Link2Off, Mail, MessagesSquare, ClipboardList, RefreshCw, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError, disconnectGmail, type IntegrationStatus } from "@/lib/client/api";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { ViewHeader } from "./views";

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium",
        ok ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-muted text-muted-foreground ring-1 ring-border",
      )}
    >
      {ok ? <CheckCircle2 className="size-3.5" aria-hidden /> : <CircleDashed className="size-3.5" aria-hidden />}
      {label}
    </span>
  );
}

function Card({ icon, title, status, children }: { icon: ReactNode; title: string; status: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground/80">{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="ml-auto">{status}</span>
      </div>
      <div className="mt-4 space-y-3 text-sm">{children}</div>
    </section>
  );
}

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid grid-cols-[7rem_1fr] gap-3 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="min-w-0 break-all">{children}</span>
  </div>
);

/** 受付元（Gmail / Slack / フォーム）との接続状況と設定 */
export function IntegrationsView({
  status,
  onChanged,
  onSync,
  syncing,
}: {
  status: IntegrationStatus | null;
  onChanged: () => void;
  onSync: () => void;
  syncing: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const gmail = status?.gmail;
  const slack = status?.slack;

  const disconnect = async () => {
    setBusy(true);
    try {
      await disconnectGmail();
      toast.success("Gmail との接続を解除しました");
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "接続の解除に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <ViewHeader title="連携" description="依頼を受け付ける窓口（Gmail・Slack・Webフォーム）との接続状況です。" />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card icon={<Mail className="size-4.5" />} title="Gmail" status={<StatusPill ok={Boolean(gmail?.connected)} label={gmail?.connected ? "接続済み" : "未接続"} />}>
          {!gmail?.configured ? (
            <p className="text-muted-foreground">
              環境変数 <code className="rounded bg-muted px-1">GOOGLE_CLIENT_ID</code> と <code className="rounded bg-muted px-1">GOOGLE_CLIENT_SECRET</code> を設定すると接続できます。
            </p>
          ) : gmail.connected ? (
            <>
              <Row label="アカウント">{gmail.email}</Row>
              <Row label="最終同期">{gmail.lastSyncAt ? formatDateTime(gmail.lastSyncAt) : "まだ同期していません"}</Row>
              <Row label="受信方法">
                {gmail.realtime ? (
                  <span className="inline-flex items-center gap-1">
                    <Zap className="size-3.5 text-amber-500" aria-hidden />
                    リアルタイム（Pub/Sub）
                    {gmail.watchExpiration && <span className="text-xs text-muted-foreground">・通知の有効期限 {formatDateTime(gmail.watchExpiration)}</span>}
                  </span>
                ) : (
                  "画面を開いている間の自動確認と、1日1回の定期同期"
                )}
              </Row>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" onClick={onSync} disabled={syncing}>
                  <RefreshCw data-icon="inline-start" className={syncing ? "animate-spin" : undefined} />
                  今すぐ受信
                </Button>
                <Button size="sm" variant="outline" onClick={disconnect} disabled={busy}>
                  <Link2Off data-icon="inline-start" />
                  接続を解除
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">依頼を受け付ける Gmail アカウントで接続してください。受信トレイの読み取りと、返信の送信の権限を使います。</p>
              <Button size="sm" nativeButton={false} render={<a href="/api/integrations/google/start" />}>
                <Mail data-icon="inline-start" />
                Gmail を接続
              </Button>
            </>
          )}
        </Card>

        <Card icon={<MessagesSquare className="size-4.5" />} title="Slack" status={<StatusPill ok={Boolean(slack?.connected)} label={slack?.connected ? "接続済み" : "未接続"} />}>
          {slack?.connected ? (
            <>
              <Row label="ワークスペース">{slack.team}</Row>
              <Row label="ボット">@{slack.bot}</Row>
              <Row label="対象チャンネル">{slack.channelId ?? "ボットが参加しているすべてのチャンネル"}</Row>
              <p className="text-xs text-muted-foreground">チャンネルへの新しい投稿を依頼として取り込み、返信は元の投稿のスレッドに送ります。</p>
            </>
          ) : (
            <p className="text-muted-foreground">
              {slack?.error ? `接続を確認できません（${slack.error}）。` : ""}
              環境変数 <code className="rounded bg-muted px-1">SLACK_BOT_TOKEN</code> と <code className="rounded bg-muted px-1">SLACK_SIGNING_SECRET</code> を設定し、Slack アプリの Event Subscriptions の Request URL を{" "}
              <code className="rounded bg-muted px-1">/api/webhooks/slack</code> にしてください。
            </p>
          )}
        </Card>

        <Card icon={<ClipboardList className="size-4.5" />} title="Webフォーム" status={<StatusPill ok label="公開中" />}>
          <Row label="URL">{status?.formUrl}</Row>
          <p className="text-xs text-muted-foreground">誰でも送信できる依頼フォームです。送信者の返信先メールアドレスには、Gmail から返信します。</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" nativeButton={false} render={<a href="/form" target="_blank" rel="noreferrer" />}>
              <ExternalLink data-icon="inline-start" />
              フォームを開く
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (status?.formUrl) navigator.clipboard.writeText(status.formUrl).then(() => toast.success("URLをコピーしました"));
              }}
            >
              <Copy data-icon="inline-start" />
              URLをコピー
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
