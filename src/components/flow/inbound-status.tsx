"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AI_ERROR_INFO, AI_ERROR_CODES, type AiErrorCode } from "@/lib/ai/errors";
import { ApiError, retryInbound } from "@/lib/client/api";
import { formatDateTime } from "@/lib/dates";
import type { InboundIssueDTO } from "@/lib/types";
import { SourceIcon } from "./badges";
import { useWorkspace } from "./workspace-context";

const errorTitle = (code: string | null) =>
  code && (AI_ERROR_CODES as readonly string[]).includes(code) ? AI_ERROR_INFO[code as AiErrorCode].title : "AIによる分析に失敗しました";

/** まだ依頼になっていない受信（AI が分析中 / 分析に失敗）の一覧 */
export function InboundStatusList({ items, onRetried }: { items: InboundIssueDTO[]; onRetried: () => void }) {
  const { upsertRequest, selectRequest } = useWorkspace();
  const [retrying, setRetrying] = useState<string | null>(null);
  if (items.length === 0) return null;

  const retry = async (id: string) => {
    setRetrying(id);
    try {
      const request = await retryInbound(id);
      upsertRequest(request);
      selectRequest(request.id);
      toast.success("再分析して、依頼として登録しました");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "再分析に失敗しました");
    } finally {
      setRetrying(null);
      onRetried();
    }
  };

  return (
    <ul className="grid gap-2" aria-label="処理中の受信">
      {items.map((item) => {
        const failed = item.status === "failed";
        return (
          <li
            key={item.id}
            className={
              failed
                ? "flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3"
                : "flex items-center gap-3 rounded-xl border border-ai/20 bg-ai-soft/50 p-3"
            }
          >
            <SourceIcon source={item.source} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {item.requesterName}
                <span className="ml-2 text-xs font-normal text-muted-foreground">{formatDateTime(item.receivedAt)} 受信</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">{item.preview}</p>
            </div>
            {failed ? (
              <>
                <span className="hidden items-center gap-1 text-xs font-medium text-destructive sm:inline-flex">
                  <AlertTriangle className="size-3.5" aria-hidden />
                  {errorTitle(item.error)}
                </span>
                <Button size="sm" variant="outline" onClick={() => retry(item.id)} disabled={retrying !== null}>
                  <RotateCw data-icon="inline-start" className={retrying === item.id ? "animate-spin" : undefined} />
                  再分析
                </Button>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ai">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                AIが分析中…
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
