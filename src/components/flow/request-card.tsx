"use client";

import { motion } from "motion/react";
import { UserRoundSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_LABEL } from "@/lib/domain";
import { formatDateTime } from "@/lib/dates";
import type { RequestDTO } from "@/lib/types";
import { DueLabel, MemberAvatar, PriorityBadge, SourceBadge, StatusBadge } from "./badges";
import { useWorkspace } from "./workspace-context";

export function RequestCard({
  request,
  selected,
  isNew,
}: {
  request: RequestDTO;
  selected: boolean;
  isNew?: boolean;
}) {
  const { members, memberById, today, selectRequest } = useWorkspace();
  const assignee = memberById(request.assigneeId);
  const needsReview = request.reviewState === "needs_review";
  const done = request.status === "done";

  return (
    <motion.button
      type="button"
      layout="position"
      initial={isNew ? { opacity: 0, y: -12, scale: 0.98 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      onClick={() => selectRequest(request.id)}
      aria-pressed={selected}
      className={cn(
        "group relative w-full rounded-xl border bg-card p-4 text-left shadow-xs transition-[box-shadow,border-color] duration-150",
        "hover:border-primary/30 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
        selected && "border-primary/60 shadow-md ring-1 ring-primary/30",
        needsReview && !selected && "border-amber-300 bg-amber-50/40",
        isNew && "ring-2 ring-ai/30",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <SourceBadge source={request.sourceType} />
        <PriorityBadge priority={request.priority} />
        <span className="text-[11px] text-muted-foreground">{CATEGORY_LABEL[request.category]}</span>
        {needsReview && (
          <span className="inline-flex h-5 items-center gap-1 rounded-md bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">
            <UserRoundSearch className="size-3" aria-hidden />
            担当者の確認待ち
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">{formatDateTime(request.receivedAt)}</span>
      </div>

      <h3 className={cn("mt-2 line-clamp-1 text-sm font-semibold", done && "text-muted-foreground line-through decoration-muted-foreground/40")}>
        {request.title}
      </h3>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{request.summary}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-dashed pt-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <MemberAvatar member={assignee} members={members} />
          <span className={cn("truncate text-xs whitespace-nowrap", assignee ? "font-medium" : "font-medium text-amber-700")}>
            {assignee?.name ?? "未割り当て"}
          </span>
        </div>
        <DueLabel dueDate={request.dueDate} today={today} className="whitespace-nowrap" />
        <StatusBadge status={request.status} className="ml-auto whitespace-nowrap" />
      </div>
    </motion.button>
  );
}
