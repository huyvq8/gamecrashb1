/**
 * Shared “pressure vs reward” mapping from live multiplier X (game feel).
 * Used for thrust visuals, payout tick speed, and engine pitch.
 */
export function multiplierFeel(m: number): {
  /** Animation speed / particle rate (higher = faster). */
  boost: number;
  /** Vertical stretch of exhaust (1 = baseline). */
  thrustScale: number;
  /** Brightness for exhaust stack. */
  exhaustBrightness: number;
  highX: boolean;
  extremeX: boolean;
} {
  if (!Number.isFinite(m) || m < 1) {
    return {
      boost: 1,
      thrustScale: 1,
      exhaustBrightness: 1,
      highX: false,
      extremeX: false
    };
  }
  const boost = Math.min(
    6.4,
    1 + Math.log10(m + 0.08) * 1.22 + Math.max(0, m - 6) * 0.036 + Math.max(0, m - 18) * 0.022
  );
  const thrustScale = Math.min(1.52, 0.86 + (boost - 1) * 0.118);
  const exhaustBrightness = Math.min(1.38, 1 + (boost - 1) * 0.068);
  return {
    boost,
    thrustScale,
    exhaustBrightness,
    highX: m >= 5,
    extremeX: m >= 14
  };
}

/** Audio engine Hz vs X (sawtooth loop). */
export function engineFrequencyHz(m: number): number {
  if (!Number.isFinite(m) || m < 1) return 118;
  const base = 118;
  const fromLog = Math.log2(Math.min(m, 120)) * 38;
  const fromLinear = Math.min(m - 1, 80) * 1.15;
  return Math.min(480, base + fromLog + fromLinear);
}

/** Engine loop gain (slight lift with X). */
export function engineGainForMultiplier(m: number): number {
  if (!Number.isFinite(m) || m < 1) return 0.08;
  const v = 0.074 + Math.log10(m + 0.5) * 0.034;
  return Math.min(0.19, Math.max(0.08, v));
}

/** Payout count-up duration (ms): faster as X rises — syncs with urgency. */
export function payoutSmoothDurationMs(m: number): number {
  if (!Number.isFinite(m) || m < 1.01) return 320;
  const denom = 1 + Math.log10(m) * 1.05 + Math.max(0, m - 10) * 0.018;
  return Math.max(40, Math.round(320 / denom));
}
