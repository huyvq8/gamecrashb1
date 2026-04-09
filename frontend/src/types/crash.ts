export type RoundStatus = "BETTING_OPEN" | "IN_PROGRESS" | "CRASHED" | "SETTLED";

export interface ActiveRound {
  roundId: string;
  status: RoundStatus;
  crashMultiplier: string | null;
}

export interface CrashStateResponse {
  source: string;
  activeRound: ActiveRound | null;
  activeBetsCount: number;
}

export interface HistoryRound {
  roundId: string;
  status: RoundStatus;
  crashMultiplier: string | null;
}

export interface CrashHistoryResponse {
  source: string;
  windowLimit: number;
  rounds: HistoryRound[];
}

export interface WalletBalanceResponse {
  userId: string;
  balanceMinor: string;
  ledgerEntries: Array<Record<string, unknown>>;
}

export interface WalletDepositResponse {
  userId: string;
  balanceMinor: string;
}

export interface BetRecord {
  betId: string;
  roundId: string;
  userId: string;
  amountMinor: string;
  status: "ACTIVE" | "CASHED_OUT" | "LOST" | "REJECTED";
  payoutAmountMinor: string | null;
  cashoutMultiplier: string | null;
}

export interface CrashRealtimeEvent {
  roundId?: string;
  userId?: string;
  multiplier?: string;
  cashoutMultiplier?: string;
  payoutAmountMinor?: string;
  crashMultiplier?: string;
  crashedAt?: string | null;
  settledAt?: string | null;
  nextRoundStartsAt?: string | null;
  bettingCloseAt?: string | null;
}
