"use client";

import { useState, type ReactNode } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// インライン編集用の小さな部品。AI の判断を「見る → 必要なら直す」を 1 クリックで行えるようにする。

export type SelectOption = { value: string; label: string; hint?: string; icon?: ReactNode };

export function SimpleSelect({
  options,
  value,
  onChange,
  placeholder = "選択してください",
  disabled,
  className,
  ariaLabel,
}: {
  options: SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <Select
      items={options.map((o) => ({ value: o.value, label: o.label }))}
      value={value}
      onValueChange={(v) => {
        if (typeof v === "string") onChange(v);
      }}
      disabled={disabled}
    >
      <SelectTrigger size="sm" className={cn("min-w-36 bg-card", className)} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.icon}
            <span>{o.label}</span>
            {o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function FieldRow({
  label,
  icon,
  children,
  aside,
  className,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5 py-3 sm:grid-cols-[7.5rem_1fr] sm:gap-3", className)}>
      <div className="flex items-center gap-1.5 pt-0.5 text-xs font-medium text-muted-foreground sm:items-start">
        {icon}
        {label}
      </div>
      <div className="min-w-0">
        {children}
        {aside && <div className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{aside}</div>}
      </div>
    </div>
  );
}

export function InlineTextEditor({
  value,
  onSave,
  label,
  multiline = true,
  rows = 3,
  className,
  textClassName,
  disabled,
}: {
  value: string;
  onSave: (value: string) => Promise<boolean>;
  label: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
  textClassName?: string;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const start = () => {
    setDraft(value);
    setEditing(true);
  };
  const save = async () => {
    if (!draft.trim()) return;
    if (draft === value) return setEditing(false);
    setSaving(true);
    const ok = await onSave(draft.trim());
    setSaving(false);
    if (ok) setEditing(false);
  };

  if (!editing) {
    return (
      <div className={cn("group/edit flex items-start gap-2", className)}>
        <p className={cn("min-w-0 flex-1 text-sm leading-relaxed whitespace-pre-wrap", textClassName)}>{value}</p>
        {!disabled && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={start}
            aria-label={`${label}を編集`}
            className="text-muted-foreground opacity-60 group-hover/edit:opacity-100 focus-visible:opacity-100"
          >
            <Pencil />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {multiline ? (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={rows}
          autoFocus
          aria-label={label}
          className="bg-card text-sm"
        />
      ) : (
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus aria-label={label} className="bg-card" />
      )}
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
          <X data-icon="inline-start" />
          キャンセル
        </Button>
        <Button size="sm" onClick={save} disabled={saving || !draft.trim()}>
          <Check data-icon="inline-start" />
          {saving ? "保存中…" : "保存"}
        </Button>
      </div>
    </div>
  );
}
