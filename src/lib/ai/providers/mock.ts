import type { Category, Priority } from "@/lib/domain";
import { addDaysISO, diffDaysISO, weekdayJa } from "@/lib/dates";
import type { NormalizedMessage } from "@/lib/ingestion";
import { COMPANY, MEMBERS } from "@/lib/nexora";
import { BACK_REFERENCE_RE } from "../history";
import type { AnalysisOutput } from "../schema";
import { ANALYSIS_STEPS, createStepTracker } from "../steps";
import type { AiProvider, AnalyzeOptions } from "./types";

// APIキーなしで UI を開発するための簡易モック。キーワード一致で判定するだけで、LLM ではない。
// 画面上にも「Mock AI」と表示される。

const STEP_DELAY_MS = 380;

const KEYWORDS: { memberId: string; category: Category; words: string[] }[] = [
  { memberId: "kobayashi", category: "legal", words: ["契約書", "規約", "法務", "NDA", "秘密保持", "リーガル"] },
  { memberId: "nakamura", category: "finance", words: ["請求", "支払", "入金", "経理", "インボイス", "領収書"] },
  { memberId: "tanaka", category: "sales", words: ["見積", "提案", "商談", "プラン変更", "導入検討", "価格"] },
  { memberId: "watanabe", category: "hr", words: ["採用", "面接", "候補者", "入社", "人事", "評価制度"] },
  { memberId: "mori", category: "marketing", words: ["展示会", "広告", "記事", "プレスリリース", "ウェビナー", "導入事例"] },
  { memberId: "suzuki", category: "design", words: ["バナー", "デザイン", "UI", "UX", "ロゴ", "クリエイティブ"] },
  { memberId: "ito", category: "engineering", words: ["バグ", "不具合", "表示崩れ", "画面", "実装", "フロント"] },
  { memberId: "kato", category: "product", words: ["新機能", "仕様", "要件", "リリース", "ロードマップ"] },
  { memberId: "sato", category: "customer_success", words: ["使い方", "CSV", "導入支援", "問い合わせ", "エクスポート", "設定方法"] },
  { memberId: "yamamoto", category: "general_affairs", words: ["備品", "オフィス", "会議室", "社内手続", "郵便", "入館"] },
];

const WEEKDAY_INDEX: Record<string, number> = { 日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6 };

function lastDayOfMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** 「今日中」「明日」「来週金曜」などの相対的な期限表現を日付に変換する（モックと初期データで使用） */
export function extractDueDate(text: string, today: string): { sourceText: string | null; date: string | null } {
  const todayDow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const mondayOffset = (todayDow + 6) % 7; // 今週の月曜までの日数
  const thisMonday = addDaysISO(today, -mondayOffset);

  const nextWeekDay = text.match(/来週(?:の)?([月火水木金土日])曜/);
  if (nextWeekDay) {
    const offset = (WEEKDAY_INDEX[nextWeekDay[1]] + 6) % 7;
    return { sourceText: nextWeekDay[0], date: addDaysISO(thisMonday, 7 + offset) };
  }
  const patterns: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/(今日|本日)中?/, () => today],
    [/明後日/, () => addDaysISO(today, 2)],
    [/明日/, () => addDaysISO(today, 1)],
    [/今週中/, () => (diffDaysISO(thisMonday, today) >= 5 ? today : addDaysISO(thisMonday, 4))],
    [/来週中/, () => addDaysISO(thisMonday, 11)],
    [/(今月末|月末)/, () => lastDayOfMonth(today)],
  ];
  for (const [re, toDate] of patterns) {
    const m = text.match(re);
    if (m) return { sourceText: m[0], date: toDate(m) };
  }
  return { sourceText: null, date: null };
}

function decidePriority(text: string, due: string | null, today: string): Priority {
  if (/至急|緊急|障害|停止|今すぐ/.test(text)) return "urgent";
  if (due) {
    const days = diffDaysISO(today, due);
    if (days <= 0) return "urgent";
    if (days <= 2) return "high";
  }
  if (/急ぎ|早め|契約|見積/.test(text)) return "high";
  if (/いつでも|余裕|参考まで|共有/.test(text)) return "low";
  return "medium";
}

function buildReply(message: NormalizedMessage, assigneeName: string | null, dueText: string | null) {
  const who = assigneeName ? `担当の${assigneeName}が対応いたします。` : "担当者を確認のうえ、改めてご連絡いたします。";
  const when = dueText ? `ご指定の期限（${dueText}）までに対応いたします。` : "";
  switch (message.sourceType) {
    case "email":
      return {
        subject: `Re: ${message.subject ?? "お問い合わせの件"}`,
        body: `${message.requesterName}様\n\nご連絡いただきありがとうございます。\nご依頼の件、承知いたしました。${who}\n${when}\n\n引き続きよろしくお願いいたします。\n\n${COMPANY.name}`,
      };
    case "slack":
      return { subject: "", body: `${message.requesterName}さん、確認しました！${who}${when}` };
    case "form":
      return {
        subject: `【受付】${message.subject ?? "ご依頼"}`,
        body: `${message.requesterName}さん\n\nご依頼を受け付けました。${who}\n${when}\n進捗はFlowAI OPS上でご確認いただけます。`,
      };
  }
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(signal.reason);
    });
  });

export class MockProvider implements AiProvider {
  readonly name = "mock" as const;
  readonly model = "mock-keyword-v1";

  async analyze(message: NormalizedMessage, { today, history, onStep, signal }: AnalyzeOptions) {
    const tracker = createStepTracker(onStep);
    for (const step of ANALYSIS_STEPS) {
      if (step.key === "register") break;
      tracker.advanceTo(step.key);
      await sleep(STEP_DELAY_MS, signal);
    }

    const text = `${message.subject ?? ""}\n${message.body}`;
    const scored = KEYWORDS.map((k) => ({ ...k, hits: k.words.filter((w) => text.includes(w)).length }))
      .filter((k) => k.hits > 0)
      .sort((a, b) => b.hits - a.hits);
    const best = scored[0];
    const tie = scored.length > 1 && scored[1].hits === best.hits;
    const keywordMember = best && !tie ? MEMBERS.find((m) => m.id === best.memberId)! : null;

    // 「先日の件」のような依頼は、同じ依頼者の過去の依頼が 1 件だけならその続きとみなす
    const backReference = BACK_REFERENCE_RE.test(text);
    const related = backReference && history.length === 1 ? history[0] : null;
    const relatedIndex = related ? 1 : null;
    const relatedMember = related ? (MEMBERS.find((m) => m.id === related.assigneeId) ?? null) : null;
    const member = related ? relatedMember : backReference ? null : keywordMember;

    const due = extractDueDate(text, today);
    const firstLine = (message.subject ?? message.body.split("\n")[0]).slice(0, 28);
    const undecidedReason = backReference
      ? history.length > 1
        ? `過去の依頼が${history.length}件あり、どれの続きか特定できない`
        : "過去の依頼が見つからず、対象を特定できない"
      : tie
        ? "複数の部署に当てはまり、主担当を決められない"
        : "担当領域に当てはまるキーワードがない";

    const output: AnalysisOutput = {
      intent: `${message.requesterName}からの依頼: ${firstLine}`,
      relatedRequest: {
        reasoning: related
          ? `同じ依頼者の過去の依頼「${related.title}」の続き`
          : backReference
            ? undecidedReason
            : "単独で完結した新規の依頼",
        requestId: relatedIndex ? `H${relatedIndex}` : null,
      },
      title: related ? `${related.title}（続報）`.slice(0, 30) : firstLine,
      summary: message.body.replace(/\s+/g, " ").slice(0, 70),
      category: related?.category ?? best?.category ?? "general_affairs",
      priority: decidePriority(text, due.date, today),
      priorityReason: due.date ? `期限が${due.date}(${weekdayJa(due.date)})のため` : "期限の指定がないため通常対応",
      assignee: member
        ? {
            reasoning: related
              ? `関連する依頼の担当者（${member.name}）を引き継ぐ`
              : `「${best.words.find((w) => text.includes(w))}」は${member.department}の担当領域`,
            memberId: member.id,
            confidence: "high",
          }
        : { reasoning: undecidedReason, memberId: null, confidence: "low" },
      dueDate: due,
      nextAction: member ? `${firstLine}の内容を確認し、対応を開始する。` : "依頼内容を確認し、担当者を決める。",
      reply: buildReply(message, member?.name ?? null, due.sourceText),
      missingInformation: [],
    };
    return output;
  }
}
