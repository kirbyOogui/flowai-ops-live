// AI 処理のエラー分類。サーバーは code を返し、クライアントは code から表示文言を引く。

export const AI_ERROR_CODES = [
  "missing_api_key",
  "auth",
  "timeout",
  "rate_limit",
  "api_error",
  "invalid_output",
  "refusal",
  "incomplete",
  "validation",
  "internal",
  "ai_quota",
] as const;

export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

export const AI_ERROR_INFO: Record<AiErrorCode, { title: string; message: string; retryable: boolean }> = {
  missing_api_key: {
    title: "OpenAI APIキーが設定されていません",
    message:
      "サーバーの環境変数 OPENAI_API_KEY を設定してから再起動してください。キーなしで試す場合は AI_PROVIDER=\"mock\" を設定します。",
    retryable: false,
  },
  auth: {
    title: "OpenAI APIキーが無効です",
    message: "OPENAI_API_KEY の値が正しいか、キーが失効していないかを確認してください。",
    retryable: false,
  },
  timeout: {
    title: "AIの応答がタイムアウトしました",
    message: "時間をおいて、もう一度お試しください。",
    retryable: true,
  },
  rate_limit: {
    title: "AIの利用上限に達しました",
    message: "リクエストが集中しているか、APIの利用枠を超えています。少し待ってから再試行してください。",
    retryable: true,
  },
  api_error: {
    title: "AIによる分析に失敗しました",
    message: "もう一度お試しください。",
    retryable: true,
  },
  invalid_output: {
    title: "AIの出力を読み取れませんでした",
    message: "AIが想定外の形式で応答しました。もう一度お試しください。",
    retryable: true,
  },
  refusal: {
    title: "AIがこの依頼の分析を断りました",
    message: "内容を見直してから、もう一度お試しください。",
    retryable: true,
  },
  incomplete: {
    title: "AIの応答が途中で終了しました",
    message: "依頼文が長すぎる可能性があります。短くしてもう一度お試しください。",
    retryable: true,
  },
  validation: {
    title: "入力内容を確認してください",
    message: "必須項目が入力されていません。",
    retryable: false,
  },
  ai_quota: {
    title: "本日のAI分析の上限に達しました",
    message: "AI分析の回数が1日の上限に達しました。時間をおいて再分析してください。",
    retryable: true,
  },
  internal: {
    title: "分析結果の保存に失敗しました",
    message: "もう一度お試しください。",
    retryable: true,
  },
};

export class AiError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    detail?: string,
  ) {
    super(detail ?? AI_ERROR_INFO[code].title);
    this.name = "AiError";
  }
}
