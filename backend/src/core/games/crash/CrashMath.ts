const MULTIPLIER_SCALE = 1_000_000n;
const ONE_SECOND_MS = 1_000n;
const DEFAULT_GROWTH_PPM_PER_SECOND = 120_000n;

export interface MultiplierConfig {
  growthPpmPerSecond: bigint;
}

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

export function multiplierAtElapsedMs(
  elapsedMs: bigint,
  config: MultiplierConfig = { growthPpmPerSecond: DEFAULT_GROWTH_PPM_PER_SECOND }
): Multiplier {
  if (elapsedMs < 0n) {
    throw new Error("elapsedMs cannot be negative");
  }

  const growthPerSecond = config.growthPpmPerSecond;
  const increment = (elapsedMs * growthPerSecond * MULTIPLIER_SCALE) / (ONE_SECOND_MS * 1_000_000n);
  const current = MULTIPLIER_SCALE + increment;
  return scaledToMultiplierString(current);
}

export function hasCrashed(currentMultiplier: string, crashMultiplier: string): boolean {
  return parseMultiplierToScaled(currentMultiplier) >= parseMultiplierToScaled(crashMultiplier);
}

export const crashMathInternals = {
  MULTIPLIER_SCALE,
  DEFAULT_GROWTH_PPM_PER_SECOND,
  parseMultiplierToScaled,
  scaledToMultiplierString
};
