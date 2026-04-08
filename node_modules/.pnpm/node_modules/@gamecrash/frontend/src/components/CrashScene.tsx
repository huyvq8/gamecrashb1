import React, { useEffect, useMemo, useRef, useState } from "react";
import { runtimeConfig } from "../config/runtimeConfig";
import { useChromaKeyImage } from "../lib/useChromaKeyImage";
import type { RoundStatus } from "../types/crash";

type ScenePhase = "IDLE" | "COUNTDOWN" | "LAUNCH" | "FLYING" | "CRASHED" | "RESET";

function parseMultiplier(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 1;
}

export function CrashScene(props: {
  roundStatus: RoundStatus | "IDLE";
  multiplier: string;
  crashMultiplier: string | null;
  onCountdownChange?: (value: number) => void;
  displayMultiplier?: string;
  multiplierClass?: string;
  rewardEffect?: {
    token: number;
    text: string;
    intensity: "small" | "medium" | "big";
    hue: string;
  } | null;
}) {
  const [phase, setPhase] = useState<ScenePhase>("IDLE");
  const [countdown, setCountdown] = useState(5);
  const prevStatusRef = useRef<RoundStatus | "IDLE">(props.roundStatus);
  const rocketSrc = useChromaKeyImage(runtimeConfig.rocketImageUrl, { whiteThreshold: 248 }) ?? runtimeConfig.rocketImageUrl;

  useEffect(() => {
    if (props.roundStatus === "BETTING_OPEN") {
      setPhase("COUNTDOWN");
      setCountdown(5);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 0) return 0;
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
    return undefined;
  }, [props.roundStatus]);

  useEffect(() => {
    if (props.roundStatus === "IN_PROGRESS" && prevStatusRef.current !== "IN_PROGRESS") {
      setPhase("LAUNCH");
      const t = setTimeout(() => setPhase("FLYING"), 800);
      prevStatusRef.current = props.roundStatus;
      return () => clearTimeout(t);
    }
    if (props.roundStatus === "CRASHED") {
      setPhase("CRASHED");
    } else if (props.roundStatus === "SETTLED") {
      setPhase("RESET");
    } else if (props.roundStatus === "IDLE") {
      setPhase("IDLE");
    }
    prevStatusRef.current = props.roundStatus;
    return undefined;
  }, [props.roundStatus]);

  useEffect(() => {
    props.onCountdownChange?.(countdown);
  }, [countdown, props]);

  const multiplierValue = parseMultiplier(props.multiplier);
  const rocketOffset = useMemo(() => {
    if (phase === "LAUNCH") return 26;
    if (phase !== "FLYING") return 0;
    const normalized = Math.min(1, Math.max(0, (multiplierValue - 1) / 8));
    const eased = normalized * normalized;
    return Math.round(22 + eased * 160);
  }, [multiplierValue, phase]);

  return (
    <div className={`crash-scene phase-${phase.toLowerCase()}`}>
      <div className="scene-nebula nebula-a" />
      <div className="scene-nebula nebula-b" />
      <div className="scene-stars" />
      <div className="scene-atmosphere" />
      <div className="scene-launch-flash" />
      {/* Removed numeric countdown badge to keep scene clean */}

      <div className="scene-track">
        <div className="launchpad" />
        <div className="launch-glow" />
        {props.rewardEffect ? (
          <>
            <div key={`glow-${props.rewardEffect.token}`} className={`cashout-screen-glow ${props.rewardEffect.intensity} ${props.rewardEffect.hue}`} />
            <div key={`float-${props.rewardEffect.token}`} className={`cashout-reward ${props.rewardEffect.intensity}`}>
              +{props.rewardEffect.text}
            </div>
            <div key={`particles-${props.rewardEffect.token}`} className={`cashout-particles ${props.rewardEffect.hue}`}>
              {Array.from({ length: props.rewardEffect.intensity === "big" ? 20 : props.rewardEffect.intensity === "medium" ? 14 : 10 }).map(
                (_, i) => (
                  <span
                    // eslint-disable-next-line react/no-array-index-key
                    key={i}
                    className="particle"
                    style={{ ["--i" as string]: `${i}` }}
                  />
                )
              )}
            </div>
          </>
        ) : null}
        <div className="rocket-wrap" style={{ transform: `translateY(${-rocketOffset}px)` }}>
          <img className="rocket-img rocket-no-flame" src={rocketSrc} alt="rocket" />
          <div className="engine-fx">
            <div className="engine-core-glow" />
            <div className="engine-primary-jet" />
            <div className="engine-outer-trail" />
            <div className="engine-ribbon ribbon-a" />
            <div className="engine-ribbon ribbon-b" />
            <div className="engine-sparks">
              <span className="spark s1" />
              <span className="spark s2" />
              <span className="spark s3" />
              <span className="spark s4" />
              <span className="spark s5" />
            </div>
            <div className="rocket-smoke" />
          </div>
          <div className={`rocket-multiplier ${props.multiplierClass ?? ""}`} data-testid="multiplier-display">
            {props.displayMultiplier ?? `${props.multiplier}x`}
          </div>
        </div>
      </div>

      {phase === "CRASHED" ? (
        <div className="crash-overlay">
          <div className="crash-shockwave" />
        </div>
      ) : null}
    </div>
  );
}
