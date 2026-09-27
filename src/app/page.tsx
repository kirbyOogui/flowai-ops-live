import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  Inbox,
  LockKeyhole,
  Mail,
  MessagesSquare,
  Send,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export const metadata: Metadata = {
  title: "FlowAI OPS — Gmail・Slack・フォームの依頼をAIが振り分ける",
  description:
    "Gmail・Slack・Webフォームに届いた業務依頼を AI が読み取り、担当者・期限・重要度・返信案まで決めて仕事として登録する AI オペレーション管理ツール。",
};

const FLOW: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Inbox, title: "受信", text: "Gmail・Slack・Webフォームに届いた依頼を、Webhook とプッシュ通知でその場で取り込みます。" },
  { icon: Sparkles, title: "AI が分析", text: "要約・カテゴリ・重要度・期限を判断し、同じ依頼者の過去の依頼とも照合します。" },
  { icon: UserRoundCheck, title: "担当者を決定", text: "担当業務から適任者を選びます。確信が持てない依頼だけ、人に判断を戻します。" },
  { icon: Send, title: "確認して返信", text: "AI が作った返信案を人が確認し、元のメールのスレッドや Slack のスレッドへ送ります。" },
];

const CHANNELS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Mail, title: "Gmail", text: "Gmail API と Pub/Sub のプッシュ通知で受信。返信は元のメールと同じスレッドに入ります。" },
  { icon: MessagesSquare, title: "Slack", text: "Events API で指定チャンネルの投稿を受信（署名を検証）。返信は元の投稿のスレッドへ。" },
  { icon: ClipboardList, title: "Webフォーム", text: "誰でも送れる公開フォーム。送信後に AI の分析の様子をその場で表示します。" },
];

const STACK = ["Next.js 16", "TypeScript", "PostgreSQL / Prisma", "OpenAI API（Structured Outputs）", "Gmail API", "Slack Events API", "Vercel"];

export default function LandingPage() {
  const demoUrl = process.env.DEMO_URL?.trim();

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Workflow className="size-4.5" aria-hidden />
        </span>
        <span className="text-[15px] font-bold tracking-tight">
          FlowAI <span className="text-primary">OPS</span>
        </span>
        <Link href="/login" className="ml-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <LockKeyhole className="size-3.5" aria-hidden />
          オーナー用ログイン
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <section className="py-12 sm:py-16">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
            Gmail・Slack・フォームと実際に連携して稼働中
          </span>
          <h1 className="mt-5 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            届いた依頼を、AI が理解して
            <br className="hidden sm:block" />
            担当者と次の行動まで決める。
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            FlowAI OPS は、Gmail・Slack・Webフォームから届く業務依頼を AI が読み取り、要約・重要度・担当者・期限・返信案まで決めて仕事として登録する
            AI オペレーション管理ツールです。外部への返信だけは、人が確認してから送ります。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/form"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/85"
            >
              <ClipboardList className="size-4" aria-hidden />
              依頼フォームから送ってみる
            </Link>
            {demoUrl && (
              <a href={demoUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border bg-card px-4 text-sm font-medium hover:bg-muted">
                操作できるデモ版を開く
                <ArrowRight className="size-4" aria-hidden />
              </a>
            )}
          </div>
        </section>

        <section aria-labelledby="flow-title" className="py-8">
          <h2 id="flow-title" className="text-lg font-bold">
            依頼が届いてから返信するまで
          </h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FLOW.map((step, i) => (
              <li key={step.title} className="rounded-xl border bg-card p-4 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-primary">
                    <step.icon className="size-4" aria-hidden />
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">STEP {i + 1}</span>
                </div>
                <h3 className="mt-3 text-sm font-semibold">{step.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="channels-title" className="py-8">
          <h2 id="channels-title" className="text-lg font-bold">
            つながっている受付窓口
          </h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {CHANNELS.map((c) => (
              <div key={c.title} className="rounded-xl border bg-card p-4 shadow-xs">
                <c.icon className="size-5 text-primary" aria-hidden />
                <h3 className="mt-2 text-sm font-semibold">{c.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="trust-title" className="py-8">
          <h2 id="trust-title" className="text-lg font-bold">
            実運用を想定した作り
          </h2>
          <ul className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {[
              "Webhook は受信を保存してすぐ応答し、AI 分析は後から実行（再送・重複通知でも二重登録しない）",
              "AI の出力はスキーマで検証し、確信が持てない担当者判断は人に戻す",
              "Gmail のトークンは暗号化して保存。Slack はリクエストの署名を検証",
              "受信から AI の判断、人の操作、実際の送信まで、すべて処理履歴に記録",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-1.5">
            {STACK.map((s) => (
              <span key={s} className="rounded-md bg-muted px-2 py-1 text-xs text-foreground/80">
                {s}
              </span>
            ))}
          </div>
        </section>

        <p className="mt-6 text-xs text-muted-foreground">
          ※ 画面内の「NEXORA株式会社」は架空の企業です。実際の依頼内容はオーナーだけが閲覧できます。
        </p>
      </main>
    </div>
  );
}
