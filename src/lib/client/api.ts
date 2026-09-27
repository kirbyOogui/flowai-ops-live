import type { AnalysisStepKey } from "@/lib/ai/steps";
import type { FormInput } from "@/lib/ingestion";
import type { RequestPatch } from "@/lib/services/requests";
import type { FormEvent, FormResultDTO, InboundIssueDTO, RequestDTO } from "@/lib/types";

// ブラウザから API Route を呼ぶための薄いラッパー

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  } catch {
    throw new ApiError("サーバーに接続できませんでした。通信状況を確認してください。");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error ?? `エラーが発生しました（${res.status}）`, res.status);
  return data as T;
}

export const fetchWorkspace = () => call<{ requests: RequestDTO[]; inbound: InboundIssueDTO[] }>("/api/requests");

export async function patchRequest(id: string, patch: RequestPatch): Promise<RequestDTO> {
  return (await call<{ request: RequestDTO }>(`/api/requests/${id}`, { method: "PATCH", body: JSON.stringify(patch) })).request;
}

export async function sendReply(id: string, reply: { subject: string; body: string }): Promise<RequestDTO> {
  return (await call<{ request: RequestDTO }>(`/api/requests/${id}/send-reply`, { method: "POST", body: JSON.stringify(reply) })).request;
}

export async function retryInbound(id: string): Promise<RequestDTO> {
  return (await call<{ request: RequestDTO }>(`/api/inbound/${id}/retry`, { method: "POST" })).request;
}

export const syncGmail = () => call<{ imported: number; skipped: number; duplicates: number }>("/api/integrations/google/sync", { method: "POST" });
export const disconnectGmail = () => call<{ ok: true }>("/api/integrations/google/disconnect", { method: "POST" });

export type IntegrationStatus = {
  gmail: {
    configured: boolean;
    connected: boolean;
    email?: string;
    lastSyncAt?: string | null;
    watchExpiration?: string | null;
    realtime: boolean;
    error?: string;
  };
  slack: { connected: boolean; team?: string; bot?: string; error?: string; channelId: string | null };
  formUrl: string;
};
export const fetchIntegrations = () => call<IntegrationStatus>("/api/integrations/status");

export const login = (password: string) => call<{ ok: true }>("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) });
export const logout = () => call<{ ok: true }>("/api/auth/logout", { method: "POST" });

export class FormSubmitError extends Error {
  constructor(
    readonly code: string,
    readonly detail?: string,
  ) {
    super(code);
  }
}

/** 公開フォームの送信。AI 分析の進み具合を onStep に流し、受付結果を返す */
export async function submitForm(input: FormInput, onStep: (step: AnalysisStepKey) => void): Promise<FormResultDTO> {
  let res: Response;
  try {
    res = await fetch("/api/form", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  } catch {
    throw new FormSubmitError("network");
  }
  if (!res.body) throw new FormSubmitError("api_error");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const handle = (line: string): FormResultDTO | undefined => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as FormEvent;
    if (event.type === "step") onStep(event.step);
    if (event.type === "error") throw new FormSubmitError(event.code, event.detail);
    if (event.type === "done") return event.result;
  };
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const result = handle(line);
      if (result) return result;
    }
    if (done) break;
  }
  const result = handle(buffer);
  if (result) return result;
  throw new FormSubmitError("api_error");
}
