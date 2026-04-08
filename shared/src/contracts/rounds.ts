export enum RoundStatus {
  BETTING_OPEN = "BETTING_OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  CRASHED = "CRASHED",
  SETTLED = "SETTLED"
}

export interface GameRound {
  roundId: string;
  gameKey: string;
  status: RoundStatus;
  bettingOpenAt: string;
  bettingCloseAt: string;
  startedAt: string | null;
  crashedAt: string | null;
  settledAt: string | null;
  crashMultiplier: string | null;
  rngSeedRef: string | null;
  serverSeedHash: string | null;
  fairnessVersion: string;
  configSnapshot: Record<string, unknown>;
}

export const ROUND_TRANSITIONS: Readonly<Record<RoundStatus, readonly RoundStatus[]>> = {
  [RoundStatus.BETTING_OPEN]: [RoundStatus.IN_PROGRESS],
  [RoundStatus.IN_PROGRESS]: [RoundStatus.CRASHED],
  [RoundStatus.CRASHED]: [RoundStatus.SETTLED],
  [RoundStatus.SETTLED]: []
};
