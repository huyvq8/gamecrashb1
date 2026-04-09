/**
 * Visual space “zones” driven by live multiplier (environment only — no gameplay).
 * At most two adjacent zones have non-zero opacity → smooth crossfade.
 */

function smoothstep01(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/** Breakpoints between zones: [1↔2], [2↔5], [5↔10], [10↔25], [25↔50], then 50+ stays zone 5 with rising intensity. */
const BP = [1, 2, 5, 10, 25, 50] as const;

const ZONE_HUES = [232, 208, 198, 16, 42, 288] as const;
const ZONE_SATS = [1, 1.06, 1.1, 1.22, 1.32, 1.48] as const;
const ZONE_GLOW = [0.32, 0.44, 0.56, 0.74, 0.88, 1] as const;

export function spaceZoneOpacities(mRaw: number): number[] {
  const m = Math.max(1, mRaw);
  const w = [0, 0, 0, 0, 0, 0];
  if (m >= BP[5]) {
    w[5] = 1;
    return w;
  }
  for (let i = 0; i < 5; i += 1) {
    const a = BP[i];
    const b = BP[i + 1];
    if (m >= a && m < b) {
      const t = smoothstep01((m - a) / (b - a));
      w[i] = 1 - t;
      w[i + 1] = t;
      return w;
    }
  }
  return w;
}

function weightedSum(weights: number[], values: readonly number[]): number {
  let s = 0;
  let tw = 0;
  for (let i = 0; i < weights.length; i += 1) {
    s += weights[i] * values[i];
    tw += weights[i];
  }
  return tw > 1e-6 ? s / tw : values[0];
}

/**
 * m: live multiplier (1+). When idle, pass 1.
 */
export function spaceJourneyEnv(mRaw: number): {
  zoneOpacities: number[];
  /** >1 = faster ambient drift / parallax feel */
  travelMul: number;
  /** Scales center glow / nebula visibility */
  envGlow: number;
  nebulaHueDeg: number;
  nebulaSat: number;
} {
  const m = Math.max(1, mRaw);
  const zoneOpacities = spaceZoneOpacities(m);
  const travelMul = Math.min(2.35, 0.58 + Math.log10(m + 0.2) * 0.42 + Math.max(0, m - 50) * 0.0025);
  const baseGlow = weightedSum(zoneOpacities, ZONE_GLOW);
  const over50 = m > 50 ? Math.min(1.1, 1 + Math.log10(m / 50) * 0.22) : 1;
  const envGlow = Math.min(1.12, baseGlow * over50);
  return {
    zoneOpacities,
    travelMul,
    envGlow,
    nebulaHueDeg: weightedSum(zoneOpacities, ZONE_HUES),
    nebulaSat: weightedSum(zoneOpacities, ZONE_SATS)
  };
}
