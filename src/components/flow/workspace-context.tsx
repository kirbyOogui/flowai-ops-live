"use client";

import { createContext, useContext } from "react";
import type { RequestPatch } from "@/lib/services/requests";
import type { MemberDTO, RequestDTO } from "@/lib/types";

export type AiInfo = { provider: "openai" | "mock"; model: string; configured: boolean };

export type WorkspaceContextValue = {
  /** 現在画面にある全ての依頼（関連する依頼の表示を常に最新にするため） */
  requests: RequestDTO[];
  members: MemberDTO[];
  memberById: (id: string | null) => MemberDTO | undefined;
  today: string;
  aiInfo: AiInfo;
  /** 依頼を更新し、成功したら一覧にも反映する。失敗時はトーストを出して null を返す */
  updateRequest: (id: string, patch: RequestPatch) => Promise<RequestDTO | null>;
  upsertRequest: (request: RequestDTO) => void;
  selectRequest: (id: string | null) => void;
};

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceContext");
  return ctx;
}
