export type CrashPhase =
  | 'prepare'
  | 'betting_open'
  | 'running'
  | 'crashed'
  | 'result'
  | 'cooldown';

export interface CrashHistoryItemDto {
  value: number;
}

export interface CrashStateDto {
  phase: CrashPhase;
  countdownValue: number | null;
  liveMultiplier: number | null;
  activeBetAmount: number | null;
  hasCashedOut: boolean;
}

const API_BASE = '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchCrashState(): Promise<CrashStateDto> {
  return request<CrashStateDto>('/game/crash/state');
}

export async function fetchCrashHistory(): Promise<CrashHistoryItemDto[]> {
  return request<CrashHistoryItemDto[]>('/game/crash/history');
}

export async function placeCrashBet(amount: number): Promise<{ amount: number }> {
  return request<{ amount: number }>('/game/crash/bet', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

export async function cashOutCrash(): Promise<{ payout: number }> {
  return request<{ payout: number }>('/game/crash/cashout', { method: 'POST' });
}

export async function fetchWalletBalance(userId: string): Promise<{ balance: number }> {
  return request<{ balance: number }>(`/wallet/balance?userId=${encodeURIComponent(userId)}`);
}
