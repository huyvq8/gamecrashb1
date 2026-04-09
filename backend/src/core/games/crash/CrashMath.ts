const MULTIPLIER_SCALE = 1_000_000n;
/** Max multiplier string we format (avoids float noise / runaway exponents). */
const MULTIPLIER_RAW_CAP = 1e15;

/**
 * Curve: multiplier(t) = exp(coeff * t^exponentPower), t = elapsed seconds.
 * exponentPower > 1 → derivative at 0 is 0: slow, smooth 1.0 → ~1.5, then clearly faster mid/high.
 * Coeff is chosen so t ≈ 4s reaches ~1.5× (feel: early phase ~4s to 1.5, mid to ~3× by ~7s).
 */
const DEFAULT_EXPONENT_POWER = 1.8;
const DEFAULT_EXPONENTIAL_COEFF = Math.log(1.5) / Math.pow(4, DEFAULT_EXPONENT_POWER);

export interface MultiplierConfig {
  /** Exponent p in exp(k * t^p). Higher → more “flat” early, steeper later. */
  exponentPower: number;
  /** k in exp(k * t^p). */
  exponentialCoeff: number;
}

export const defaultMultiplierConfig: MultiplierConfig = {
  exponentPower: DEFAULT_EXPONENT_POWER,
  exponentialCoeff: DEFAULT_EXPONENTIAL_COEFF
};

export type Multiplier = string;

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

function rawMultiplierAtElapsedSec(tSec: number, config: MultiplierConfig): number {
  if (tSec <= 0) return 1;
  const { exponentPower, exponentialCoeff } = config;
  const expArg = exponentialCoeff * Math.pow(tSec, exponentPower);
  if (!Number.isFinite(expArg) || expArg > 700) {
    return MULTIPLIER_RAW_CAP;
  }
  const m = Math.exp(expArg);
  if (!Number.isFinite(m) || m < 1) return 1;
  return Math.min(m, MULTIPLIER_RAW_CAP);
}

export function multiplierAtElapsedMs(
  elapsedMs: bigint,
  config: MultiplierConfig = defaultMultiplierConfig
): Multiplier {
  if (elapsedMs < 0n) {
    throw new Error("elapsedMs cannot be negative");
  }

  const tSec = Number(elapsedMs) / 1000;
  const raw = rawMultiplierAtElapsedSec(tSec, config);
  const scaledFloat = Math.min(raw, Number(MULTIPLIER_RAW_CAP)) * Number(MULTIPLIER_SCALE);
  if (!Number.isFinite(scaledFloat)) {
    return scaledToMultiplierString(BigInt(MULTIPLIER_RAW_CAP) * MULTIPLIER_SCALE);
  }
  const scaledInt = BigInt(Math.floor(scaledFloat + 1e-9));
  return scaledToMultiplierString(scaledInt);
}

export function hasCrashed(currentMultiplier: string, crashMultiplier: string): boolean {
  return parseMultiplierToScaled(currentMultiplier) >= parseMultiplierToScaled(crashMultiplier);
}

export const crashMathInternals = {
  MULTIPLIER_SCALE,
  defaultMultiplierConfig,
  parseMultiplierToScaled,
  scaledToMultiplierString
};
