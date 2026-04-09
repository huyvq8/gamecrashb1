import type {
  BetRecord,
  CrashHistoryResponse,
  CrashStateResponse,
  WalletBalanceResponse,
  WalletDepositResponse
} from "../types/crash";

const API_BASE = "";

function normalizeApiError(payload: unknown, fallback = "Request failed"): string {
  if (payload && typeof payload === "object") {
    const maybe = payload as { message?: unknown; error?: unknown };
    if (typeof maybe.message === "string" && maybe.message.length > 0) {
      return maybe.message;
    }
    if (typeof maybe.error === "string" && maybe.error.length > 0) {
      return maybe.error;
    }
  }
  return fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(normalizeApiError(payload));
  }

  return payload as T;
}

export const apiClient = {
  getState: () => request<CrashStateResponse>("/game/crash/state"),
  /** Avoid stale cached GET after each round settle. */
  getHistory: () =>
    request<CrashHistoryResponse>("/game/crash/history", { cache: "no-store" }),
  placeBet: (body: { userId: string; roundId: string; amountMinor: string }) =>
    request<{ bet: BetRecord }>("/game/crash/bet", { method: "POST", body: JSON.stringify(body) }),
  replaceBet: (body: { userId: string; roundId: string; amountMinor: string }) =>
    request<{ bet: BetRecord }>("/game/crash/bet/replace", { method: "POST", body: JSON.stringify(body) }),
  cashout: (body: { userId: string; roundId: string }) =>
    request<{ bet: BetRecord }>("/game/crash/cashout", { method: "POST", body: JSON.stringify(body) }),
  getBalance: (userId: string) => request<WalletBalanceResponse>(`/wallet/balance?userId=${encodeURIComponent(userId)}`),
  deposit: (body: { userId: string; amountMinor: string; clientRequestId?: string }) =>
    request<WalletDepositResponse>("/wallet/deposit", { method: "POST", body: JSON.stringify(body) })
};
