import { describe, expect, it } from "vitest";
import { hasCrashed, multiplierAtElapsedMs } from "../src/core/games/crash/CrashMath";

describe("CrashMath", () => {
  it("multiplier(t=0) = 1.000000", () => {
    expect(multiplierAtElapsedMs(0n)).toBe("1.000000");
  });

  it("multiplier is monotonic increasing", () => {
    const m0 = Number(multiplierAtElapsedMs(0n));
    const m1 = Number(multiplierAtElapsedMs(100n));
    const m2 = Number(multiplierAtElapsedMs(1_000n));
    const m3 = Number(multiplierAtElapsedMs(10_000n));

    expect(m0).toBeLessThanOrEqual(m1);
    expect(m1).toBeLessThanOrEqual(m2);
    expect(m2).toBeLessThanOrEqual(m3);
  });

  it("curve is exponential in time: later windows gain more than earlier ones at comparable width", () => {
    const a = Number(multiplierAtElapsedMs(2_000n));
    const b = Number(multiplierAtElapsedMs(3_000n));
    const c = Number(multiplierAtElapsedMs(6_000n));
    const d = Number(multiplierAtElapsedMs(7_000n));
    expect(b - a).toBeLessThan(d - c);
  });

  it("~4s reaches ~1.5x and ~7s reaches ~3x (tuned default curve)", () => {
    const m4 = Number(multiplierAtElapsedMs(4_000n));
    const m7 = Number(multiplierAtElapsedMs(7_000n));
    expect(m4).toBeGreaterThan(1.45);
    expect(m4).toBeLessThan(1.58);
    expect(m7).toBeGreaterThan(2.85);
    expect(m7).toBeLessThan(3.25);
  });

  it("very high multipliers climb extremely fast vs early game", () => {
    const early = Number(multiplierAtElapsedMs(5_000n));
    const late = Number(multiplierAtElapsedMs(11_000n));
    expect(late / early).toBeGreaterThan(4);
  });

  it("crash comparator is current >= crash", () => {
    expect(hasCrashed("1.500000", "1.500000")).toBe(true);
    expect(hasCrashed("1.500001", "1.500000")).toBe(true);
    expect(hasCrashed("1.499999", "1.500000")).toBe(false);
  });
});
