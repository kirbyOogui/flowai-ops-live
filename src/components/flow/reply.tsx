"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Loader2, Pencil, Send, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, sendReply } from "@/lib/client/api";
import { formatDateTime } from "@/lib/dates";
import { replyRecipient } from "@/lib/ingestion";
import type { RequestDTO } from "@/lib/types";
import { AiMark } from "./badges";
import { useWorkspace } from "./workspace-context";

const channelWord = (request: RequestDTO) => (request.sourceType === "slack" ? "Slackメッセージ" : "メール");

/** 送信先のサービスの説明（確認画面と完了画面で使う） */
const deliveryText = (request: RequestDTO) =>
  request.sourceType === "slack"
    ? "Slack の元の投稿のスレッドに投稿します"
    : request.sourceType === "email"
      ? "Gmail から送信します（元のメールへの返信として同じスレッドに入ります）"
      : "Gmail から、フォームに入力された返信先へ送信します";

const sentText = (request: RequestDTO) =>
  request.sourceType === "slack" ? "Slack のスレッドに投稿しました。" : "Gmail から送信しました。";

/** 詳細パネル内の返信案カード */
export function ReplyPanel({ request }: { request: RequestDTO }) {
  const [open, setOpen] = useState(false);
  const sent = Boolean(request.replySentAt);

  return (
    <section aria-labelledby={`reply-${request.id}`} className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <h3 id={`reply-${request.id}`} className="text-sm font-semibold">
          返信案
        </h3>
        <AiMark label="AIが作成" />
        {sent ? (
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="size-3.5" aria-hidden />
            送信済み（{formatDateTime(request.replySentAt!)}）
          </span>
        ) : (
          <span className="ml-auto text-xs text-muted-foreground">送信前に内容を確認します</span>
        )}
      </div>
      <div className="space-y-2 px-4 py-3 text-sm">
        <p className="text-xs text-muted-foreground">
          宛先：<span className="text-foreground">{replyRecipient(request.sourceMetadata)}</span>
        </p>
        {request.replySubject && (
          <p className="text-xs text-muted-foreground">
            件名：<span className="text-foreground">{request.replySubject}</span>
          </p>
        )}
        <p className="line-clamp-6 rounded-lg bg-muted/60 p-3 text-[13px] leading-relaxed whitespace-pre-wrap">{request.replyDraft}</p>
      </div>
      {!sent && (
        <div className="flex justify-end border-t px-4 py-3">
          <Button onClick={() => setOpen(true)}>
            <Send data-icon="inline-start" />
            返信を確認して送信
          </Button>
        </div>
      )}
      {/* 開くたびに下書きを最新の返信案で初期化する */}
      <ReplySendDialog key={open ? "open" : "closed"} request={request} open={open} onOpenChange={setOpen} />
    </section>
  );
}

type Phase = "review" | "sending" | "sent";

/** 外部アクション直前の最終確認。「送信する」を押すと、受付元（Gmail / Slack）へ実際に送る */
export function ReplySendDialog({
  request,
  open,
  onOpenChange,
}: {
  request: RequestDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { upsertRequest } = useWorkspace();
  const [phase, setPhase] = useState<Phase>(request.replySentAt ? "sent" : "review");
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(request.replySubject);
  const [body, setBody] = useState(request.replyDraft);
  const isSlack = request.sourceType === "slack";

  const handleOpenChange = (next: boolean) => {
    if (phase === "sending") return;
    onOpenChange(next);
  };

  const send = async () => {
    if (!body.trim()) return;
    setPhase("sending");
    try {
      const updated = await sendReply(request.id, { subject, body });
      upsertRequest(updated);
      setPhase("sent");
    } catch (error) {
      setPhase("review");
      toast.error(error instanceof ApiError ? error.message : "送信に失敗しました");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl" showCloseButton={phase !== "sending"}>
        <AnimatePresence mode="wait" initial={false}>
          {phase === "sent" ? (
            <motion.div
              key="sent"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center px-2 py-6 text-center"
            >
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 18, delay: 0.05 }}
                className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
              >
                <CheckCircle2 className="size-8" aria-hidden />
              </motion.span>
              <DialogTitle className="mt-4 text-lg">送信しました</DialogTitle>
              <DialogDescription className="mt-2 leading-relaxed">
                {sentText(request)}
                <br />
                送信の記録は AI 処理履歴に残ります。
              </DialogDescription>
              <Button className="mt-6" variant="outline" onClick={() => handleOpenChange(false)}>
                閉じる
              </Button>
            </motion.div>
          ) : (
            <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-4">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <AiMark />
                </div>
                <DialogTitle className="text-base">AIが返信{channelWord(request)}を作成しました</DialogTitle>
                <DialogDescription>送信は外部へのアクションのため、最後に人が内容を確認します。</DialogDescription>
              </DialogHeader>

              <dl className="grid gap-3 text-sm">
                <div className="grid gap-1">
                  <dt className="text-xs font-medium text-muted-foreground">宛先</dt>
                  <dd>{replyRecipient(request.sourceMetadata)}</dd>
                </div>
                {!isSlack && (
                  <div className="grid gap-1">
                    <dt className="text-xs font-medium text-muted-foreground">件名</dt>
                    <dd>
                      {editing ? (
                        <Input value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="件名" />
                      ) : (
                        subject
                      )}
                    </dd>
                  </div>
                )}
                <div className="grid gap-1">
                  <dt className="text-xs font-medium text-muted-foreground">本文</dt>
                  <dd>
                    {editing ? (
                      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} aria-label="本文" autoFocus />
                    ) : (
                      <p className="max-h-72 overflow-y-auto rounded-lg border bg-muted/40 p-3 text-[13px] leading-relaxed whitespace-pre-wrap">
                        {body}
                      </p>
                    )}
                  </dd>
                </div>
              </dl>

              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TriangleAlert className="size-3.5 text-amber-600" aria-hidden />
                {deliveryText(request)}。送信後は取り消せません。
              </p>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditing((v) => !v)} disabled={phase === "sending"}>
                  <Pencil data-icon="inline-start" />
                  {editing ? "編集を終える" : "編集"}
                </Button>
                <Button onClick={send} disabled={phase === "sending" || !body.trim()}>
                  {phase === "sending" ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Send data-icon="inline-start" />}
                  {phase === "sending" ? "送信中…" : "送信する"}
                </Button>
              </DialogFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
