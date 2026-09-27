import type { Metadata } from "next";
import Link from "next/link";
import { Workflow } from "lucide-react";
import { RequestForm } from "./request-form";

export const metadata: Metadata = {
  title: "依頼フォーム — FlowAI OPS",
  description: "NEXORA株式会社への依頼フォーム。送信すると AI が内容を分析し、担当部署へ振り分けます。",
};

export default function FormPage() {
  return (
    <main className="min-h-dvh px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Workflow className="size-4.5" aria-hidden />
          </span>
          <span className="font-bold tracking-tight">
            FlowAI <span className="text-primary">OPS</span>
          </span>
        </Link>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">NEXORA株式会社 依頼フォーム</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          送信すると AI が内容を読み取り、担当部署・重要度・期限を判断して社内の担当者に振り分けます。
          担当者が内容を確認したうえで、入力したメールアドレスへ返信します。
        </p>
        <RequestForm />
        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          ※ FlowAI OPS の動作を確認するための窓口です（NEXORA株式会社は架空の企業です）。入力内容は依頼の分析のために OpenAI API に送信されます。
          個人情報や機密情報は入力しないでください。
        </p>
      </div>
    </main>
  );
}
