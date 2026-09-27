import type { Metadata } from "next";
import Link from "next/link";
import { Workflow } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "ログイン — FlowAI OPS", robots: { index: false } };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await props.searchParams;
  // 外部サイトへのリダイレクトに使われないよう、アプリ内のパスだけを受け付ける
  const safeNext = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Workflow className="size-5" aria-hidden />
          </span>
          <span className="text-lg font-bold tracking-tight">
            FlowAI <span className="text-primary">OPS</span>
          </span>
        </div>
        <h1 className="mt-5 text-base font-semibold">オーナー用ログイン</h1>
        <p className="mt-1 text-sm text-muted-foreground">実際のメール・Slack を扱うため、ダッシュボードはオーナーだけが操作できます。</p>
        <LoginForm next={safeNext} />
        <p className="mt-5 text-center text-xs text-muted-foreground">
          <Link href="/" className="hover:underline">
            ← サービス紹介に戻る
          </Link>
        </p>
      </div>
    </main>
  );
}
