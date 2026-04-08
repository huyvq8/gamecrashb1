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

export interface AppConfig {
  crash: CrashGameConfig;
}
