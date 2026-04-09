import { useEffect, useRef, useState } from "react";

function lerpMinor(fromMinor: string, toMinor: string, t: number): string {
  const from = BigInt(fromMinor);
  const to = BigInt(toMinor);
  if (t <= 0) return fromMinor;
  if (t >= 1) return toMinor;
  const delta = to - from;
  const cur = from + (delta * BigInt(Math.round(t * 1_000_000))) / 1_000_000n;
  return cur.toString();
}

/**
 * Smooth count-up between two minor-unit balances. Uses bigint-safe lerp.
 * `runId` increments to restart animation from a new baseline.
 */
export function useBalanceCountUp(
  runId: number,
  fromMinor: string,
  toMinor: string,
  durationMs: number,
  active: boolean
): string {
  const [value, setValue] = useState(fromMinor);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setValue(toMinor);
      return;
    }
    if (fromMinor === toMinor) {
      setValue(toMinor);
      return;
    }
    setValue(fromMinor);
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - p) ** 2;
      const next = lerpMinor(fromMinor, toMinor, eased);
      setValue(next);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else setValue(toMinor);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [runId, fromMinor, toMinor, durationMs, active]);

  return value;
}
