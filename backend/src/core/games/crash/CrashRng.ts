import type { CrashDistributionBucket, CrashGameConfig } from "./CrashContracts";

const MULTIPLIER_SCALE = 1_000_000n;
const MAX_U64 = (1n << 64n) - 1n;
const WEIGHT_SCALE = 1_000_000n;

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

function weightToScaledInt(weight: number): bigint {
  if (!Number.isFinite(weight)) {
    throw new Error("Crash distribution weight must be a finite number");
  }
  return BigInt(Math.round(weight * Number(WEIGHT_SCALE)));
}

function ensureValidDistribution(distribution: CrashDistributionBucket[]): bigint {
  if (distribution.length === 0) {
    throw new Error("Crash distribution must contain at least one bucket");
  }

  let total = 0n;
  for (const bucket of distribution) {
    const scaledWeight = weightToScaledInt(bucket.weight);
    if (scaledWeight <= 0n) {
      throw new Error("Crash distribution weights must be > 0");
    }

    const min = parseMultiplierToScaled(bucket.minMultiplier);
    const max = parseMultiplierToScaled(bucket.maxMultiplier);
    if (max <= min) {
      throw new Error("Invalid crash distribution bucket bounds");
    }

    total += scaledWeight;
  }

  if (total <= 0n) {
    throw new Error("Crash distribution total weight must be > 0");
  }

  return total;
}

export class DeterministicCrashRng implements CrashRng {
  private state: bigint;
  private readonly distribution: CrashDistributionBucket[];
  private readonly totalWeight: bigint;

  constructor(config: CrashGameConfig, seed = "phase2-default-seed") {
    this.totalWeight = ensureValidDistribution(config.crashDistribution);
    this.distribution = config.crashDistribution;
    this.state = this.hashSeed(seed);
  }

  nextCrashMultiplier(): string {
    const weightPoint = this.nextUInt64() % this.totalWeight;
    let cursor = 0n;
    let selected = this.distribution[this.distribution.length - 1];

    for (const bucket of this.distribution) {
      cursor += weightToScaledInt(bucket.weight);
      if (weightPoint < cursor) {
        selected = bucket;
        break;
      }
    }

    const min = parseMultiplierToScaled(selected.minMultiplier);
    const max = parseMultiplierToScaled(selected.maxMultiplier);
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

}

export const crashRngInternals = {
  MULTIPLIER_SCALE,
  WEIGHT_SCALE,
  weightToScaledInt,
  ensureValidDistribution,
  parseMultiplierToScaled,
  scaledToMultiplierString
};
