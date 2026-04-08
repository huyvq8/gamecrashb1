import type { Bet, Cashout } from "./bets";
import type { AppConfig } from "./config";
import type { GameEvent } from "./events";
import type { GameRound } from "./rounds";
import type { LedgerEntry } from "./wallet";

export interface CrashStateResponse {
  activeRound: GameRound | null;
  activeBetsCount: number;
}

export interface CrashHistoryResponse {
  rounds: GameRound[];
}

export interface PlaceBetRequest {
  userId: string;
  roundId: string;
  amountMinor: string;
}

export interface PlaceBetResponse {
  bet: Bet;
}

export interface CashoutRequest {
  userId: string;
  roundId: string;
}

export interface CashoutResponse {
  cashout: Cashout;
}

export interface WalletBalanceResponse {
  userId: string;
  balanceMinor: string;
  recentLedger: LedgerEntry[];
}

export interface AdminGameConfigResponse {
  config: AppConfig;
}

export interface EventFeedResponse {
  events: GameEvent[];
}
