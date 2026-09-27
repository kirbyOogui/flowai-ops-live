import type { Metadata } from "next";
import Link from "next/link";
import { Workflow } from "lucide-react";

export const metadata: Metadata = {
  title: "プライバシーポリシー — FlowAI OPS",
  description: "FlowAI OPS における個人情報・Google ユーザーデータの取り扱いについて",
};

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. このサービスについて",
    body: [
      "FlowAI OPS（以下「本サービス」）は、Gmail・Slack・Webフォームに届いた業務依頼を AI で分析し、担当者の振り分けや返信の作成を行うツールです。個人が制作・運営するポートフォリオ用のサービスで、画面内の「NEXORA株式会社」は架空の企業です。",
    ],
  },
  {
    title: "2. 取得する情報",
    body: [
      "Webフォーム：入力されたお名前、会社名、返信先メールアドレス、件名、依頼内容。回数制限のため、IP アドレスをハッシュ化した値（元の IP アドレスに戻せない形）を一時的に記録します。",
      "Gmail：運営者が接続した Gmail アカウントの受信トレイに届いたメールの差出人、件名、本文、受信日時。",
      "Slack：運営者のワークスペースの指定チャンネルに投稿されたメッセージの投稿者名と本文。",
    ],
  },
  {
    title: "3. 利用目的",
    body: [
      "取得した情報は、依頼の内容を分析して担当者・期限・返信案を決めること、依頼者への返信、および不正利用の防止のためだけに利用します。広告や第三者への販売には一切利用しません。",
    ],
  },
  {
    title: "4. Google ユーザーデータの取り扱い",
    body: [
      "本サービスは Gmail API の gmail.readonly（受信メールの読み取り）と gmail.send（返信の送信）の権限を使用します。これらは、運営者自身が接続した Gmail アカウントについてのみ、受信した依頼の取り込みと、運営者が確認した返信の送信のためだけに使います。",
      "Google から取得したデータの使用と他のアプリへの転送は、限定的な使用の要件を含む Google API サービスのユーザーデータに関するポリシーに準拠します。Google ユーザーデータを広告に使用したり、人が閲覧したり（運営者本人による業務上の確認を除く）、AI モデルの学習に使用したりすることはありません。",
      "Gmail のアクセストークンは暗号化してデータベースに保存し、接続の解除により削除できます。",
    ],
  },
  {
    title: "5. 外部サービスへの送信",
    body: [
      "依頼の分析のため、依頼内容を OpenAI API に送信します。OpenAI の商用 API に送信したデータは、同社の規約上、既定でモデルの学習には使用されません。",
      "本サービスは Vercel（ホスティング）および Neon（データベース）上で動作しています。",
    ],
  },
  {
    title: "6. 保存期間と削除",
    body: [
      "取得した情報は、ポートフォリオとしての動作確認に必要な期間だけ保存し、不要になった時点で削除します。フォームから送信した内容の削除を希望される場合は、下記の連絡先までご連絡ください。",
    ],
  },
  {
    title: "7. お問い合わせ",
    body: ["本ポリシーに関するお問い合わせは、demo.ringogaii@gmail.com までご連絡ください。"],
  },
];

export default function PrivacyPage() {
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
        <h1 className="mt-6 text-2xl font-bold tracking-tight">プライバシーポリシー</h1>
        <p className="mt-1 text-xs text-muted-foreground">制定日：2026年9月28日</p>
        <div className="mt-6 space-y-6">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="text-base font-semibold">{s.title}</h2>
              {s.body.map((p) => (
                <p key={p} className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
