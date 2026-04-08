import React, { useEffect, useState } from "react";
import { runtimeConfig } from "../../config/runtimeConfig";

function getMultiplierTier(multiplier: string): "tier-low" | "tier-med" | "tier-high" | "tier-hot" {
  const m = Number(multiplier);
  if (!isFinite(m) || m < 1.5) return "tier-low";
  if (m < 3) return "tier-med";
  if (m < 10) return "tier-high";
  return "tier-hot";
}

export function CrashSceneV2(props: { multiplier: string; phase?: "IDLE" | "BETTING_OPEN" | "IN_PROGRESS" | "CRASHED" | "SETTLED"; countdownSeconds?: number | null }) {
  const { multiplier, phase = "IDLE", countdownSeconds = null } = props;
  const isRunning = phase === "IN_PROGRESS";
  const isIdle = phase === "IDLE" || phase === "BETTING_OPEN" || phase === "SETTLED";
  const isCrashed = phase === "CRASHED";
  const tier = getMultiplierTier(multiplier);
  const showCountdown = !isRunning && typeof countdownSeconds === "number" && countdownSeconds > 0;
  const urgent = showCountdown && countdownSeconds <= 3;

  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (countdownSeconds === 0) {
      setFlash(true);
      const id = setTimeout(() => setFlash(false), 300);
      return () => clearTimeout(id);
    }
  }, [countdownSeconds]);
  return (
    <div className={`crash-v2-scene ${isRunning ? "is-running" : ""} ${isIdle ? "is-idle" : ""} ${isCrashed ? "is-crashed" : ""} ${tier} ${showCountdown || flash ? "has-countdown" : ""}`}>
      <div className="crash-v2-scene-bg" />
      <div className="crash-v2-scene-stars" />
      <div className="crash-v2-rocket-wrap">
        <img className="crash-v2-rocket" src={runtimeConfig.rocketImageUrl} alt="rocket" />
        <div className="crash-v2-thrust">
          <div className="thrust-core" />
          <div className="thrust-inner" />
          <div className="thrust-outer" />
          <div className="thrust-beam" />
          <div className="thrust-particles" />
        </div>
      </div>
      {!showCountdown && !flash ? <div className="crash-v2-multiplier">{Number(multiplier).toFixed(2)}x</div> : null}
      {showCountdown ? (
        <div className={`crash-v2-countdown-center ${urgent ? "is-urgent" : ""}`} key={countdownSeconds}>
          {Math.max(0, countdownSeconds)}
        </div>
      ) : null}
      {flash ? <div className="crash-v2-countdown-flash" /> : null}
      <div className="crash-v2-ground" />
    </div>
  );
}

