import type { Category } from "./domain";

// 架空企業 NEXORA株式会社 の会社情報とメンバー。
// seed（DB初期データ）と AI プロンプトの両方がここを唯一の情報源として参照する。

export const COMPANY = {
  name: "NEXORA株式会社",
  nameEn: "NEXORA Inc.",
  business:
    "中堅〜大企業向けに、業務コラボレーションSaaS「NEXORA Cloud」（Starter / Pro / Enterprise の3プラン）を提供するソフトウェア企業",
  customers: "国内のBtoB企業（営業・CS・バックオフィス部門）",
} as const;

export type MemberProfile = {
  id: string;
  name: string;
  department: string;
  /** その部署が主に扱うカテゴリ（担当者判断のヒント。機械的な対応表ではない） */
  primaryCategory: Category;
  role: string;
  responsibilities: string[];
};

export const MEMBERS: MemberProfile[] = [
  {
    id: "tanaka",
    name: "田中 悠",
    department: "営業",
    primaryCategory: "sales",
    role: "アカウントエグゼクティブ",
    responsibilities: ["見積", "契約前の顧客対応", "営業案件", "顧客提案"],
  },
  {
    id: "sato",
    name: "佐藤 美咲",
    department: "カスタマーサクセス",
    primaryCategory: "customer_success",
    role: "CSマネージャー",
    responsibilities: ["顧客支援", "問い合わせ", "導入支援", "顧客課題"],
  },
  {
    id: "kato",
    name: "加藤 晴",
    department: "プロダクト",
    primaryCategory: "product",
    role: "プロダクトマネージャー",
    responsibilities: ["機能", "要件", "プロダクト仕様", "リリース"],
  },
  {
    id: "suzuki",
    name: "鈴木 葵",
    department: "デザイン",
    primaryCategory: "design",
    role: "プロダクトデザイナー",
    responsibilities: ["UI", "UX", "バナー", "デザイン", "クリエイティブ"],
  },
  {
    id: "ito",
    name: "伊藤 蓮",
    department: "エンジニアリング",
    primaryCategory: "engineering",
    role: "フロントエンドエンジニア",
    responsibilities: ["Web開発", "フロントエンド", "画面修正", "UI実装"],
  },
  {
    id: "nakamura",
    name: "中村 芽衣",
    department: "財務",
    primaryCategory: "finance",
    role: "財務マネージャー",
    responsibilities: ["請求", "支払い", "経理", "見積関連の財務処理"],
  },
  {
    id: "mori",
    name: "森 健太",
    department: "マーケティング",
    primaryCategory: "marketing",
    role: "マーケティングマネージャー",
    responsibilities: ["広告", "展示会", "コンテンツ", "マーケティング"],
  },
  {
    id: "watanabe",
    name: "渡辺 莉奈",
    department: "人事",
    primaryCategory: "hr",
    role: "HRマネージャー",
    responsibilities: ["採用", "面接", "人事", "社内制度"],
  },
  {
    id: "yamamoto",
    name: "山本 恒一",
    department: "総務",
    primaryCategory: "general_affairs",
    role: "オフィスマネージャー",
    responsibilities: ["備品", "社内手続き", "庶務", "オフィス関連"],
  },
  {
    id: "kobayashi",
    name: "小林 恒一",
    department: "法務",
    primaryCategory: "legal",
    role: "リーガルスペシャリスト",
    responsibilities: ["契約書", "規約", "法務確認", "リスク確認"],
  },
];

export const MEMBER_IDS = MEMBERS.map((m) => m.id) as [string, ...string[]];
