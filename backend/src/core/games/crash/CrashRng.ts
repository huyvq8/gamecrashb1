import type { CrashDistributionBucket, CrashGameConfig } from "./CrashContracts";

const MULTIPLIER_SCALE = 1_000_000n;
const MAX_U64 = (1n << 64n) - 1n;

export interface CrashRng {
  nextCrashMultiplier(): string;
}

function parseMultiplierToScaled(value: string): bigint {
  const [wholePart, decimalPart = ""] = value.split(".");
  const normalizedDecimal = (decimalPart + "000000").slice(0, 6);
  return BigInt(wholePart) * MULTIPLIER_SCALE + BigInt(normalizedDecimal);
}

function scaledToMultiplierString(value: bigint): string {
  const whole = value / MULTIPLIER_SCALE;
  const decimal = value % MULTIPLIER_SCALE;
  return `${whole.toString()}.${decimal.toString().padStart(6, "0")}`;
}

function ensureValidDistribution(distribution: CrashDistributionBucket[]): void {
  const totalWeight = distribution.reduce((acc, bucket) => acc + bucket.weight, 0);
  if (Math.abs(totalWeight - 100) > Number.EPSILON) {
    throw new Error(`Invalid crash distribution weight total: expected 100, got ${totalWeight}`);
  }
}

export class DeterministicCrashRng implements CrashRng {
  private state: bigint;
  private readonly distribution: CrashDistributionBucket[];

  constructor(config: CrashGameConfig, seed = "phase2-default-seed") {
    ensureValidDistribution(config.crashDistribution);
    this.distribution = config.crashDistribution;
    this.state = this.hashSeed(seed);
  }

  nextCrashMultiplier(): string {
    const weightPoint = this.nextInteger(100);
    let cursor = 0;
    let selected = this.distribution[this.distribution.length - 1];

    for (const bucket of this.distribution) {
      cursor += bucket.weight;
      if (weightPoint < cursor) {
        selected = bucket;
        break;
      }
    }

    const min = parseMultiplierToScaled(selected.minMultiplier);
    const max = parseMultiplierToScaled(selected.maxMultiplier);
    if (max <= min) {
      throw new Error("Invalid crash distribution bucket bounds");
    }

    const range = max - min;
    const offset = (this.nextUInt64() * range) / MAX_U64;
    const outcome = min + offset;

    return scaledToMultiplierString(outcome);
  }

  private hashSeed(seed: string): bigint {
    let hash = 1469598103934665603n;
    for (let i = 0; i < seed.length; i += 1) {
      hash ^= BigInt(seed.charCodeAt(i));
      hash = (hash * 1099511628211n) & MAX_U64;
    }
    if (hash === 0n) {
      return 1n;
    }
    return hash;
  }

  private nextUInt64(): bigint {
    this.state ^= this.state << 13n;
    this.state ^= this.state >> 7n;
    this.state ^= this.state << 17n;
    this.state &= MAX_U64;
    if (this.state === 0n) {
      this.state = 1n;
    }
    return this.state;
  }

  private nextInteger(maxExclusive: number): number {
    if (maxExclusive <= 0) {
      throw new Error("maxExclusive must be positive");
    }
    return Number(this.nextUInt64() % BigInt(maxExclusive));
  }
}

export const crashRngInternals = {
  MULTIPLIER_SCALE,
  parseMultiplierToScaled,
  scaledToMultiplierString
};
