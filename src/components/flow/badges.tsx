"use client";

import {
  CalendarClock,
  CheckCircle2,
  Circle,
  CircleDot,
  ClipboardList,
  Mail,
  MessagesSquare,
  Sparkles,
  UserRoundSearch,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PRIORITY_LABEL,
  SOURCE_LABEL,
  STATUS_LABEL,
  type Priority,
  type RequestStatus,
  type SourceType,
} from "@/lib/domain";
import { describeDue, type DueTone } from "@/lib/dates";
import type { MemberDTO } from "@/lib/types";

export const SOURCE_ICON: Record<SourceType, LucideIcon> = {
  email: Mail,
  slack: MessagesSquare,
  form: ClipboardList,
};

const SOURCE_STYLE: Record<SourceType, string> = {
  email: "bg-sky-50 text-sky-700 ring-sky-200",
  slack: "bg-violet-50 text-violet-700 ring-violet-200",
  form: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export function SourceBadge({ source, className }: { source: SourceType; className?: string }) {
  const Icon = SOURCE_ICON[source];
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium ring-1 ring-inset",
        SOURCE_STYLE[source],
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {SOURCE_LABEL[source]}
    </span>
  );
}

export function SourceIcon({ source, className }: { source: SourceType; className?: string }) {
  const Icon = SOURCE_ICON[source];
  return (
    <span
      className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset", SOURCE_STYLE[source], className)}
      aria-label={SOURCE_LABEL[source]}
    >
      <Icon className="size-4" aria-hidden />
    </span>
  );
}

const PRIORITY_STYLE: Record<Priority, { badge: string; dot: string }> = {
  urgent: { badge: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500" },
  high: { badge: "bg-orange-50 text-orange-700 ring-orange-200", dot: "bg-orange-500" },
  medium: { badge: "bg-blue-50 text-blue-700 ring-blue-200", dot: "bg-blue-500" },
  low: { badge: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" },
};

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const style = PRIORITY_STYLE[priority];
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-md px-1.5 text-[11px] font-semibold ring-1 ring-inset",
        style.badge,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot, priority === "urgent" && "animate-pulse")} aria-hidden />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export const STATUS_ICON: Record<RequestStatus, LucideIcon> = {
  todo: Circle,
  in_progress: CircleDot,
  done: CheckCircle2,
};

const STATUS_STYLE: Record<RequestStatus, string> = {
  todo: "bg-slate-100 text-slate-600",
  in_progress: "bg-blue-50 text-blue-700",
  done: "bg-emerald-50 text-emerald-700",
};

export function StatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium", STATUS_STYLE[status], className)}>
      <Icon className="size-3" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

const DUE_STYLE: Record<DueTone, string> = {
  overdue: "text-red-600 font-semibold",
  today: "text-orange-600 font-semibold",
  soon: "text-amber-700",
  normal: "text-muted-foreground",
  none: "text-muted-foreground/70",
};

export function DueLabel({ dueDate, today, className }: { dueDate: string | null; today: string; className?: string }) {
  const { label, tone } = describeDue(dueDate, today);
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", DUE_STYLE[tone], className)}>
      <CalendarClock className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-pink-100 text-pink-700",
  "bg-cyan-100 text-cyan-700",
  "bg-amber-100 text-amber-800",
  "bg-orange-100 text-orange-700",
  "bg-rose-100 text-rose-700",
  "bg-teal-100 text-teal-700",
  "bg-indigo-100 text-indigo-700",
];

export function MemberAvatar({
  member,
  members,
  size = "sm",
  className,
}: {
  member: MemberDTO | undefined;
  members: MemberDTO[];
  size?: "sm" | "md";
  className?: string;
}) {
  const dimension = size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs";
  if (!member) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-amber-400 bg-amber-50 text-amber-700",
          dimension,
          className,
        )}
        aria-label="担当者未定"
      >
        <UserRoundSearch className={size === "sm" ? "size-3" : "size-4"} aria-hidden />
      </span>
    );
  }
  const index = Math.max(0, members.findIndex((m) => m.id === member.id));
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        AVATAR_COLORS[index % AVATAR_COLORS.length],
        dimension,
        className,
      )}
      aria-hidden
    >
      {member.name.slice(0, 1)}
    </span>
  );
}

export function AiMark({ className, label = "AI" }: { className?: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-md bg-ai-soft px-1.5 text-[11px] font-semibold text-ai ring-1 ring-inset ring-ai/15",
        className,
      )}
    >
      <Sparkles className="size-3" aria-hidden />
      {label}
    </span>
  );
}
