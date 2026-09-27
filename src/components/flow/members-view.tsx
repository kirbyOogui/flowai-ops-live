"use client";

import type { ReactNode } from "react";
import { Sparkles, UserRoundSearch } from "lucide-react";
import { STATUSES, STATUS_LABEL } from "@/lib/domain";
import type { MemberDTO, RequestDTO } from "@/lib/types";
import { DueLabel, MemberAvatar, PriorityBadge, STATUS_ICON } from "./badges";
import { sortByAttention, ViewHeader } from "./views";
import { useWorkspace } from "./workspace-context";

const MAX_OPEN_ITEMS = 3;

function OpenRequestItem({ request }: { request: RequestDTO }) {
  const { today, selectRequest } = useWorkspace();
  return (
    <li>
      <button
        type="button"
        onClick={() => selectRequest(request.id)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
      >
        <PriorityBadge priority={request.priority} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate text-[13px]">{request.title}</span>
        <DueLabel dueDate={request.dueDate} today={today} className="shrink-0 whitespace-nowrap" />
      </button>
    </li>
  );
}

function MemberCard({ member, requests }: { member: MemberDTO; requests: RequestDTO[] }) {
  const { members } = useWorkspace();
  const mine = requests.filter((r) => r.assigneeId === member.id);
  const open = sortByAttention(mine.filter((r) => r.status !== "done"));
  const aiAssigned = requests.filter((r) => r.analysis?.suggestedAssigneeId === member.id).length;

  return (
    <article className="flex flex-col rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-start gap-3">
        <MemberAvatar member={member} members={members} size="md" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{member.name}</h2>
          <p className="text-xs text-muted-foreground">
            {member.department}・{member.role}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-ai-soft px-1.5 py-0.5 text-[11px] font-medium text-ai" title="AIがこのメンバーを担当者に選んだ依頼の数"
          aria-label={`AIが担当者に選んだ依頼 ${aiAssigned}件`}
        >
          <Sparkles className="size-3" aria-hidden />
          {aiAssigned}件
        </span>
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">担当業務</p>
        <ul className="flex flex-wrap gap-1">
          {member.responsibilities.map((r) => (
            <li key={r} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-foreground/80">
              {r}
            </li>
          ))}
        </ul>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2">
        {STATUSES.map((status) => {
          const Icon = STATUS_ICON[status];
          return (
            <div key={status} className="rounded-lg bg-muted/60 px-2 py-1.5">
              <dt className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Icon className="size-3" aria-hidden />
                {STATUS_LABEL[status]}
              </dt>
              <dd className="text-base font-bold tabular-nums">{mine.filter((r) => r.status === status).length}</dd>
            </div>
          );
        })}
      </dl>

      <div className="mt-3 flex-1 border-t border-dashed pt-2">
        {open.length ? (
          <ul className="-mx-2">
            {open.slice(0, MAX_OPEN_ITEMS).map((r) => (
              <OpenRequestItem key={r.id} request={r} />
            ))}
            {open.length > MAX_OPEN_ITEMS && (
              <li className="px-2 pt-1 text-[11px] text-muted-foreground">ほか {open.length - MAX_OPEN_ITEMS}件</li>
            )}
          </ul>
        ) : (
          <p className="py-2 text-xs text-muted-foreground">未完了の仕事はありません</p>
        )}
      </div>
    </article>
  );
}

export function MembersView({ requests, actions }: { requests: RequestDTO[]; actions?: ReactNode }) {
  const { members } = useWorkspace();
  const pending = sortByAttention(requests.filter((r) => r.reviewState === "needs_review"));

  return (
    <div className="space-y-5">
      <ViewHeader
        title="メンバー"
        description="NEXORA株式会社のメンバーと担当業務。AIはこの情報をもとに、依頼ごとに担当者を決めています。"
        actions={actions}
      />

      {pending.length > 0 && (
        <section aria-labelledby="pending-title" className="rounded-xl border border-amber-300 bg-amber-50/60 p-4">
          <h2 id="pending-title" className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
            <UserRoundSearch className="size-4" aria-hidden />
            担当者の確認待ち（{pending.length}件）
          </h2>
          <p className="mt-0.5 text-xs text-amber-800">AIが担当者を判断できず、人に判断を戻した依頼です。</p>
          <ul className="-mx-2 mt-2">
            {pending.map((r) => (
              <OpenRequestItem key={r.id} request={r} />
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {members.map((m) => (
          <MemberCard key={m.id} member={m} requests={requests} />
        ))}
      </div>
    </div>
  );
}
