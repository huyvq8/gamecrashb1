import type { GameRoundBase } from "../base/GameRound";

export interface CrashDistributionBucket {
  weight: number;
  minMultiplier: string;
  maxMultiplier: string;
}

export interface CrashGameConfig {
  gameKey: "crash";
  houseEdgeBps: number;
  minBetMinor: string;
  maxBetMinor: string;
  bettingWindowMs: number;
  tickIntervalMs: number;
  crashDistribution: CrashDistributionBucket[];
}

export interface CrashRound extends GameRoundBase {
  crashMultiplier: string | null;
  rngSeedRef: string | null;
  serverSeedHash: string | null;
  fairnessVersion: string;
}

export interface CrashBetRequest {
  userId: string;
  roundId: string;
  amountMinor: string;
}

export interface CrashCashoutRequest {
  userId: string;
  roundId: string;
  requestTime: Date;
}
