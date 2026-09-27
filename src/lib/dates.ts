// 日付はすべて Asia/Tokyo の暦日（YYYY-MM-DD 文字列）で扱う。
// DB の @db.Date 列は UTC 0時の Date として返るため、toISODate で相互変換する。

export const TIME_ZONE = "Asia/Tokyo";

const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"] as const;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayISO(now: Date = new Date()): string {
  // en-CA は YYYY-MM-DD 形式で出力される
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isValidISODate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDaysISO(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function weekdayJa(iso: string): string {
  return WEEKDAYS_JA[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

/** DB の Date（UTC 0時）→ YYYY-MM-DD */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** YYYY-MM-DD → DB 保存用の Date（UTC 0時） */
export function fromISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export type DueTone = "overdue" | "today" | "soon" | "normal" | "none";

export function describeDue(
  dueISO: string | null,
  today: string,
): { label: string; tone: DueTone } {
  if (!dueISO) return { label: "期限なし", tone: "none" };
  const diff = diffDaysISO(today, dueISO);
  const [, m, d] = dueISO.split("-").map(Number);
  const md = `${m}/${d}(${weekdayJa(dueISO)})`;
  if (diff < 0) return { label: `${md} 期限切れ`, tone: "overdue" };
  if (diff === 0) return { label: "今日", tone: "today" };
  if (diff === 1) return { label: "明日", tone: "soon" };
  if (diff <= 3) return { label: md, tone: "soon" };
  return { label: md, tone: "normal" };
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: TIME_ZONE,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** 処理履歴用（秒まで） */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: TIME_ZONE,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}
