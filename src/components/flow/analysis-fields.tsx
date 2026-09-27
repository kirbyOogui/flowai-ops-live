"use client";

import { useState } from "react";
import {
  CalendarClock,
  CircleAlert,
  Flag,
  History,
  Link2,
  ListChecks,
  Tag,
  TextQuote,
  UserRound,
  UserRoundSearch,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORIES, CATEGORY_LABEL, CONFIDENCE_LABEL, PRIORITIES, PRIORITY_LABEL } from "@/lib/domain";
import { describeDue, formatDateTime } from "@/lib/dates";
import type { RequestDTO, RequestLinkDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MemberAvatar, StatusBadge } from "./badges";
import { FieldRow, InlineTextEditor, SimpleSelect } from "./fields";
import { useWorkspace } from "./workspace-context";

const categoryOptions = CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }));
const priorityOptions = PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }));

/** AI が決めた各項目。すべて人が編集できる */
export function AnalysisFields({ request }: { request: RequestDTO }) {
  const { updateRequest, today } = useWorkspace();
  const analysis = request.analysis;
  const save = async (patch: Parameters<typeof updateRequest>[1]) => (await updateRequest(request.id, patch)) !== null;
  const due = describeDue(request.dueDate, today);

  return (
    <div className="divide-y">
      <RelatedRequestsRow request={request} />

      <FieldRow label="要約" icon={<TextQuote className="size-3.5" />}>
        <InlineTextEditor label="要約" value={request.summary} onSave={(summary) => save({ summary })} />
      </FieldRow>

      <FieldRow label="分類" icon={<Tag className="size-3.5" />}>
        <SimpleSelect
          ariaLabel="分類"
          options={categoryOptions}
          value={request.category}
          onChange={(category) => save({ category: category as RequestDTO["category"] })}
        />
      </FieldRow>

      <FieldRow label="重要度" icon={<Flag className="size-3.5" />} aside={analysis?.priorityReason && `AIの判断：${analysis.priorityReason}`}>
        <SimpleSelect
          ariaLabel="重要度"
          options={priorityOptions}
          value={request.priority}
          onChange={(priority) => save({ priority: priority as RequestDTO["priority"] })}
          className="min-w-24"
        />
      </FieldRow>

      <FieldRow
        label="担当者"
        icon={<UserRound className="size-3.5" />}
        aside={
          request.reviewState !== "needs_review" && analysis?.assigneeReasoning ? (
            <>
              AIの判断：{analysis.assigneeReasoning}
              {analysis.suggestedAssigneeId && `（確信度 ${CONFIDENCE_LABEL[analysis.assigneeConfidence]}）`}
            </>
          ) : undefined
        }
      >
        {request.reviewState === "needs_review" ? <AssigneeReviewPanel request={request} /> : <AssigneeSelect request={request} />}
      </FieldRow>

      <FieldRow
        label="期限"
        icon={<CalendarClock className="size-3.5" />}
        aside={
          analysis?.dueSourceText
            ? `依頼文の表現：「${analysis.dueSourceText}」`
            : analysis
              ? "依頼文に期限の記載がないため、AIは期限を設定していません"
              : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            aria-label="期限"
            value={request.dueDate ?? ""}
            onChange={(e) => save({ dueDate: e.target.value || null })}
            className="h-7 w-40 bg-card text-sm"
          />
          <span
            className={cn(
              "text-xs",
              due.tone === "overdue" || due.tone === "today" ? "font-semibold text-orange-600" : "text-muted-foreground",
            )}
          >
            {due.label}
          </span>
          {request.dueDate && (
            <Button variant="ghost" size="xs" onClick={() => save({ dueDate: null })} className="text-muted-foreground">
              <X data-icon="inline-start" />
              期限なしにする
            </Button>
          )}
        </div>
      </FieldRow>

      <FieldRow label="次にやること" icon={<ListChecks className="size-3.5" />}>
        <InlineTextEditor
          label="次のアクション"
          value={request.nextAction}
          onSave={(nextAction) => save({ nextAction })}
          textClassName="font-medium"
        />
      </FieldRow>

      {analysis && analysis.missingInformation.length > 0 && (
        <FieldRow label="不足情報" icon={<CircleAlert className="size-3.5" />}>
          <ul className="space-y-1 text-sm">
            {analysis.missingInformation.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </FieldRow>
      )}
    </div>
  );
}

function RequestLink({ link, label }: { link: RequestLinkDTO; label: string }) {
  const { members, memberById, selectRequest } = useWorkspace();
  return (
    <button
      type="button"
      onClick={() => selectRequest(link.id)}
      className="group flex w-full items-center gap-2.5 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-accent/50"
    >
      <Link2 className="size-3.5 shrink-0 text-ai" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-muted-foreground">
          {label}・{formatDateTime(link.receivedAt)} 受信
        </span>
        <span className="block truncate text-sm font-medium group-hover:text-primary">{link.title}</span>
      </span>
      <MemberAvatar member={memberById(link.assigneeId)} members={members} className="size-5 text-[9px]" />
      <StatusBadge status={link.status} className="shrink-0" />
    </button>
  );
}

/** AI が過去の依頼と照合した結果（元の依頼 / 後から届いた続報） */
function RelatedRequestsRow({ request }: { request: RequestDTO }) {
  const { requests } = useWorkspace();
  const reasoning = request.analysis?.relationReasoning;
  // 状態や担当者の変更がすぐ反映されるよう、リンク先は画面上の最新の依頼から引く
  const toLink = (r: RequestDTO): RequestLinkDTO => ({ id: r.id, title: r.title, receivedAt: r.receivedAt, assigneeId: r.assigneeId, status: r.status });
  const origin = request.relatedRequest;
  const live = origin ? requests.find((r) => r.id === origin.id) : undefined;
  const related = live ? toLink(live) : origin;
  const followUps = requests.filter((r) => r.relatedRequest?.id === request.id).map(toLink);
  if (!related && followUps.length === 0 && !reasoning) return null;
  return (
    <FieldRow
      label="関連する依頼"
      icon={<History className="size-3.5" />}
      aside={reasoning ? `AIの照合：${reasoning}` : undefined}
    >
      <div className="space-y-1.5">
        {related && <RequestLink link={related} label="元の依頼" />}
        {followUps.map((f) => (
          <RequestLink key={f.id} link={f} label="続報" />
        ))}
        {!related && followUps.length === 0 && (
          <p className="text-sm text-muted-foreground">関連付けた過去の依頼はありません</p>
        )}
      </div>
    </FieldRow>
  );
}

function useMemberOptions() {
  const { members } = useWorkspace();
  return members.map((m) => ({
    value: m.id,
    label: m.name,
    hint: m.department,
    icon: <MemberAvatar member={m} members={members} className="size-5 text-[9px]" />,
  }));
}

function AssigneeSelect({ request }: { request: RequestDTO }) {
  const { updateRequest } = useWorkspace();
  const options = useMemberOptions();
  return (
    <SimpleSelect
      ariaLabel="担当者"
      options={options}
      value={request.assigneeId}
      placeholder="担当者を選択"
      onChange={(assigneeId) => updateRequest(request.id, { assigneeId })}
      className="min-w-52"
    />
  );
}

/** AI が担当者を決められなかったときに、人に判断を戻すパネル */
export function AssigneeReviewPanel({ request }: { request: RequestDTO }) {
  const { updateRequest } = useWorkspace();
  const options = useMemberOptions();
  const [choice, setChoice] = useState<string | null>(request.assigneeId);
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    if (!choice) return;
    setSaving(true);
    await updateRequest(request.id, { assigneeId: choice, confirmAssignee: true });
    setSaving(false);
  };

  return (
    <div
      className="rounded-lg border border-amber-300 bg-amber-50 p-3 duration-300 animate-in fade-in slide-in-from-bottom-1"
      role="alert"
    >
      <div className="flex items-start gap-2">
        <UserRoundSearch className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-900">AIによる担当者の判断ができませんでした。</p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
            {request.analysis?.assigneeReasoning ?? "この依頼だけでは適切な担当者を特定できません。"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <SimpleSelect
          ariaLabel="担当者を選択"
          options={options}
          value={choice}
          placeholder="担当者を選択"
          onChange={setChoice}
          className="min-w-52"
        />
        <Button size="sm" onClick={confirm} disabled={!choice || saving}>
          {saving ? "保存中…" : "確認して続行"}
        </Button>
      </div>
    </div>
  );
}
