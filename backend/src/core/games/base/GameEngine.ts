import type { RoundStatus } from "./GameRound";

export interface GameEngine<TConfig, TRoundId extends string = string> {
  init(config: TConfig): Promise<void>;
  createRound(): Promise<TRoundId>;
  openBetting(roundId: TRoundId): Promise<void>;
  closeBetting(roundId: TRoundId): Promise<void>;
  startRound(roundId: TRoundId): Promise<void>;
  processTick(roundId: TRoundId, now: Date): Promise<void>;
  requestCashout(userId: string, roundId: TRoundId, requestTime: Date): Promise<void>;
  settleRound(roundId: TRoundId): Promise<void>;
  getRoundStatus(roundId: TRoundId): Promise<RoundStatus>;
}
