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

  it("crash comparator is current >= crash", () => {
    expect(hasCrashed("1.500000", "1.500000")).toBe(true);
    expect(hasCrashed("1.500001", "1.500000")).toBe(true);
    expect(hasCrashed("1.499999", "1.500000")).toBe(false);
  });
});
