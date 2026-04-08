import { describe, expect, it } from "vitest";
import { defaultCrashConfig } from "../src/config/gameConfig";
import { DeterministicCrashRng, crashRngInternals } from "../src/core/games/crash/CrashRng";

function parseMultiplier(value: string): number {
  return Number(value);
}

describe("DeterministicCrashRng", () => {
  it("same seed produces same first multiplier", () => {
    const rngA = new DeterministicCrashRng(defaultCrashConfig, "seed-1");
    const rngB = new DeterministicCrashRng(defaultCrashConfig, "seed-1");

    expect(rngA.nextCrashMultiplier()).toBe(rngB.nextCrashMultiplier());
  });

  it("outputs always stay within configured crash bands", () => {
    const rng = new DeterministicCrashRng(defaultCrashConfig, "band-check");
    const ranges = defaultCrashConfig.crashDistribution.map((b) => ({ min: Number(b.minMultiplier), max: Number(b.maxMultiplier) }));

    for (let i = 0; i < 2_000; i += 1) {
      const v = parseMultiplier(rng.nextCrashMultiplier());
      const inAnyRange = ranges.some((r) => v >= r.min && v < r.max);
      expect(inAnyRange).toBe(true);
    }
  });

  it("distribution sanity roughly matches configured weights", () => {
    const rng = new DeterministicCrashRng(defaultCrashConfig, "dist-sanity");
    const sampleSize = 20_000;
    const buckets = [0, 0, 0, 0, 0];

    for (let i = 0; i < sampleSize; i += 1) {
      const v = parseMultiplier(rng.nextCrashMultiplier());
      if (v < 2) buckets[0] += 1;
      else if (v < 5) buckets[1] += 1;
      else if (v < 20) buckets[2] += 1;
      else if (v < 100) buckets[3] += 1;
      else buckets[4] += 1;
    }

    const ratios = buckets.map((x) => x / sampleSize);
    expect(ratios[0]).toBeGreaterThan(0.54);
    expect(ratios[0]).toBeLessThan(0.66);
    expect(ratios[1]).toBeGreaterThan(0.20);
    expect(ratios[1]).toBeLessThan(0.30);
    expect(ratios[2]).toBeGreaterThan(0.07);
    expect(ratios[2]).toBeLessThan(0.13);
    expect(ratios[3]).toBeGreaterThan(0.02);
    expect(ratios[3]).toBeLessThan(0.06);
    expect(ratios[4]).toBeGreaterThan(0.004);
    expect(ratios[4]).toBeLessThan(0.02);
  });

  it("normalizes by actual total weight and rejects invalid weights", () => {
    const config = {
      ...defaultCrashConfig,
      crashDistribution: [
        { weight: 3, minMultiplier: "1.00", maxMultiplier: "2.00" },
        { weight: 1, minMultiplier: "2.00", maxMultiplier: "3.00" }
      ]
    };

    expect(() => new DeterministicCrashRng(config, "ok")).not.toThrow();

    const invalid = {
      ...defaultCrashConfig,
      crashDistribution: [{ weight: 0, minMultiplier: "1.00", maxMultiplier: "2.00" }]
    };

    expect(() => new DeterministicCrashRng(invalid, "bad")).toThrow(/weights must be > 0/i);

    expect(crashRngInternals.weightToScaledInt(0.5)).toBe(500000n);
  });
});
