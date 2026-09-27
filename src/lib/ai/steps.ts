// AI分析の処理ステップ定義（クライアントからも参照するため zod に依存させない）。

/**
 * UI に表示する処理ステップ。
 * `field` は構造化出力の中でそのステップに対応するキー。ストリーミング中にこのキーが出現したら
 * 「そのステップを処理中（= 前のステップは完了）」とみなして進捗を進める。
 */
export const ANALYSIS_STEPS = [
  { key: "read", label: "依頼内容を読み取り", field: "intent" },
  { key: "history", label: "過去の依頼を照合", field: "relatedRequest" },
  { key: "summary", label: "要約を作成", field: "summary" },
  { key: "category", label: "カテゴリを判定", field: "category" },
  { key: "priority", label: "重要度を分析", field: "priority" },
  { key: "assignee", label: "担当者を決定", field: "assignee" },
  { key: "deadline", label: "期限を確認", field: "dueDate" },
  { key: "nextAction", label: "次のアクションを作成", field: "nextAction" },
  { key: "reply", label: "返信案を作成", field: "reply" },
  { key: "register", label: "仕事として登録", field: null },
] as const;

export type AnalysisStepKey = (typeof ANALYSIS_STEPS)[number]["key"];

export const STEP_INDEX = Object.fromEntries(ANALYSIS_STEPS.map((s, i) => [s.key, i])) as Record<
  AnalysisStepKey,
  number
>;

/**
 * ストリーミングで届く JSON 文字列から、現在どのステップまで生成が進んだかを判定する。
 * 前進したときだけ onStep を呼ぶ。
 */
export function createStepTracker(onStep?: (step: AnalysisStepKey) => void) {
  let current = -1;
  const advanceTo = (index: number) => {
    while (current < index) {
      current += 1;
      onStep?.(ANALYSIS_STEPS[current].key);
    }
  };
  return {
    start: () => advanceTo(0),
    feed(jsonSoFar: string) {
      for (let i = ANALYSIS_STEPS.length - 1; i > current; i--) {
        const field = ANALYSIS_STEPS[i].field;
        if (field && jsonSoFar.includes(`"${field}"`)) {
          advanceTo(i);
          return;
        }
      }
    },
    advanceTo: (step: AnalysisStepKey) => advanceTo(STEP_INDEX[step]),
  };
}
