import React, { useMemo } from "react";
import type { RoundPhase } from "./useCrashUiModel";

export function CrashCenterDisplay(props: {
  phase: RoundPhase;
  countdownValue: number | null;
  liveMultiplier: string | null;
}) {
  const { phase, countdownValue, liveMultiplier } = props;

  const mode: "countdown" | "multiplier" | "none" = useMemo(() => {
    if (phase === "running") return "multiplier";
    if (phase === "prepare" || phase === "betting_open" || phase === "cooldown") return "countdown";
    if (phase === "crashed" || phase === "result") return liveMultiplier ? "multiplier" : "countdown";
    return "none";
  }, [phase, liveMultiplier]);

  if (mode === "countdown") {
    const v = typeof countdownValue === "number" ? countdownValue : 0;
    const urgency = v <= 3 ? "urgency" : "";
    return <div className={`center-countdown ${urgency}`}>{v}</div>;
  }
  if (mode === "multiplier") {
    const text = liveMultiplier ? `${Number(liveMultiplier).toFixed(2)}x` : "1.00x";
    const tier =
      !liveMultiplier ? "tier-1" :
      Number(liveMultiplier) < 1.5 ? "tier-1" :
      Number(liveMultiplier) < 3.0 ? "tier-2" :
      Number(liveMultiplier) < 10.0 ? "tier-3" :
      "tier-4";
    return <div className={`center-multiplier ${tier}`}>{text}</div>;
  }
  return null;
}

