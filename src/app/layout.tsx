import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FlowAI OPS — AIオペレーション管理",
  description:
    "Gmail・Slack・Webフォームから届く業務依頼をAIが理解し、分類・重要度・担当者・期限・次のアクション・返信案まで自動で決めるAIオペレーション管理ツール",
  // Google Search Console の所有者確認（Google OAuth のブランディング設定でドメインの登録に必要）
  verification: { google: "joDNcoKgpugPYrllxHtnCcSVVv7VNEzf-ijl1KA4214" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${inter.variable} h-full antialiased`}>
      {/* ブラウザ拡張機能が body に属性を足しても、ハイドレーション警告を出さない */}
      <body className="min-h-full" suppressHydrationWarning>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
