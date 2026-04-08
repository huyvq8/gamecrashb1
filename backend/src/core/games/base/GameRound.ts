export enum RoundStatus {
  BETTING_OPEN = "BETTING_OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  CRASHED = "CRASHED",
  SETTLED = "SETTLED"
}

export type RoundTransitionRules = {
  [K in RoundStatus]: ReadonlyArray<RoundStatus>;
};

export const ROUND_TRANSITIONS: RoundTransitionRules = {
  [RoundStatus.BETTING_OPEN]: [RoundStatus.IN_PROGRESS],
  [RoundStatus.IN_PROGRESS]: [RoundStatus.CRASHED],
  [RoundStatus.CRASHED]: [RoundStatus.SETTLED],
  [RoundStatus.SETTLED]: []
};

export const INVALID_ROUND_TRANSITIONS: ReadonlyArray<readonly [RoundStatus, RoundStatus]> = [
  [RoundStatus.BETTING_OPEN, RoundStatus.CRASHED],
  [RoundStatus.BETTING_OPEN, RoundStatus.SETTLED],
  [RoundStatus.IN_PROGRESS, RoundStatus.SETTLED]
] as const;

export interface GameRoundBase {
  roundId: string;
  gameKey: string;
  status: RoundStatus;
  bettingOpenAt: Date;
  bettingCloseAt: Date;
  startedAt: Date | null;
  crashedAt: Date | null;
  settledAt: Date | null;
  configSnapshot: Record<string, unknown>;
}
