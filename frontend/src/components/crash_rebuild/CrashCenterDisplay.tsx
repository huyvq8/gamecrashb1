import React, { useEffect, useMemo, useRef, useState } from "react";
import type { RoundPhase } from "./useCrashUiModel";

function tickDurationSec(multiplier: number): string {
  const m = Math.max(1, multiplier);
  const dur = Math.max(0.07, 0.36 - Math.min(0.27, Math.log10(m + 0.02) * 0.1));
  return `${dur.toFixed(3)}s`;
}

/** Display-only smooth step toward server multiplier while running. */
function useSmoothedMultiplierDisplay(target: number, active: boolean): number {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setDisplay(target);
      displayRef.current = target;
      return;
    }
    cancelAnimationFrame(rafRef.current);
    const from = displayRef.current;
    const start = performance.now();
    const dur = 260;
    const run = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - (1 - p) ** 2;
      const v = from + (target - from) * eased;
      displayRef.current = v;
      setDisplay(v);
      if (p < 1) rafRef.current = requestAnimationFrame(run);
      else {
        displayRef.current = target;
        setDisplay(target);
      }
    };
    rafRef.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, active]);

  return display;
}

export function CrashCenterDisplay(props: {
  phase: RoundPhase;
  countdownValue: number | null;
  liveMultiplier: string | null;
}) {
  const { phase, countdownValue, liveMultiplier } = props;
  const multRef = useRef<HTMLDivElement>(null);

  const mode: "countdown" | "multiplier" | "none" = useMemo(() => {
    if (phase === "running") return "multiplier";
    if (phase === "prepare" || phase === "betting_open" || phase === "cooldown") return "countdown";
    if (phase === "crashed" || phase === "result") return liveMultiplier ? "multiplier" : "countdown";
    return "none";
  }, [phase, liveMultiplier]);

  const targetMult = useMemo(() => {
    const n = liveMultiplier != null ? Number(liveMultiplier) : 1;
    return Number.isFinite(n) && n >= 1 ? n : 1;
  }, [liveMultiplier]);

  const multActive = mode === "multiplier";
  const displayMult = useSmoothedMultiplierDisplay(targetMult, multActive);

  useEffect(() => {
    if (!multActive || liveMultiplier == null) return;
    const el = multRef.current;
    if (!el) return;
    el.style.setProperty("--tick-dur", tickDurationSec(targetMult));
    el.style.setProperty(
      "--mult-glow-strength",
      String(Math.min(1.45, 0.58 + Math.log10(targetMult + 0.5) * 0.4))
    );
    el.classList.remove("is-ticking");
    void el.offsetWidth;
    el.classList.add("is-ticking");
  }, [liveMultiplier, multActive, targetMult]);

  if (mode === "countdown") {
    const v = typeof countdownValue === "number" ? countdownValue : 0;
    const urgency = v <= 3 && v > 0 ? "urgency" : "";
    const zero = v === 0 ? " countdown-zero" : "";
    const pressure = v > 3 ? " pressure-normal" : "";
    return (
      <div className="center-display-stack">
        {v <= 3 && v > 0 ? (
          <div key={`scp-${v}`} className="countdown-screen-pulse" aria-hidden />
        ) : null}
        <div key={`cd-${v}`} className={`center-countdown ${urgency}${zero}${pressure}`} data-count={v}>
          {v}
        </div>
      </div>
    );
  }
  if (mode === "multiplier") {
    const text = `${displayMult.toFixed(2)}x`;
    const tier =
      !liveMultiplier ? "tier-1" :
      targetMult < 1.5 ? "tier-1" :
      targetMult < 3.0 ? "tier-2" :
      targetMult < 10.0 ? "tier-3" :
      "tier-4";
    return (
      <div className="center-display-stack center-display-stack--mult">
        <div ref={multRef} className={`center-multiplier ${tier}`}>
          {text}
        </div>
      </div>
    );
  }
  return null;
}
