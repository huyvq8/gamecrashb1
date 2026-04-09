import React, { useMemo } from "react";
import type { RoundPhase } from "./useCrashUiModel";
import { CrashExplosionFx } from "./CrashExplosionFx";
import { runtimeConfig } from "../../config/runtimeConfig";
import { multiplierFeel } from "../../lib/multiplierFeel";
import { spaceJourneyEnv } from "../../lib/spaceJourney";

function feelForPhase(phase: RoundPhase, liveMultiplier: string | null) {
  if (phase !== "running" || !liveMultiplier) {
    return {
      boost: 1,
      thrustScale: 1,
      exhaustBrightness: 1,
      highX: false,
      extremeX: false
    };
  }
  const m = Number(liveMultiplier);
  return multiplierFeel(m);
}

export function CrashScene(props: {
  phase: RoundPhase;
  liveMultiplier: string | null;
  /** Increments once per crash; remounts explosion (sync with crash audio). */
  crashExplosionKey: number;
}) {
  const { phase, liveMultiplier, crashExplosionKey } = props;
  const thrust =
    phase === "running" ? "thrust-strong" :
    phase === "prepare" || phase === "betting_open" ? "thrust-idle" :
    "thrust-off";

  const running = phase === "running";
  const { boost, thrustScale, exhaustBrightness, highX, extremeX } = useMemo(
    () => feelForPhase(phase, liveMultiplier),
    [phase, liveMultiplier]
  );

  const journeyM = useMemo(() => {
    if (phase === "running" && liveMultiplier) {
      const x = Number(liveMultiplier);
      return Number.isFinite(x) && x >= 1 ? x : 1;
    }
    return 1;
  }, [phase, liveMultiplier]);

  const { zoneOpacities, travelMul, envGlow, nebulaHueDeg, nebulaSat } = useMemo(
    () => spaceJourneyEnv(journeyM),
    [journeyM]
  );

  const rootStyle = useMemo(
    () =>
      ({
        "--mult-boost": String(boost),
        "--thrust-scale": String(thrustScale),
        "--exhaust-brightness": String(exhaustBrightness),
        "--travel-mul": String(travelMul),
        "--env-glow": String(envGlow),
        "--nebula-hue": `${nebulaHueDeg}deg`,
        "--nebula-sat": String(nebulaSat)
      }) as React.CSSProperties,
    [boost, thrustScale, exhaustBrightness, travelMul, envGlow, nebulaHueDeg, nebulaSat]
  );

  return (
    <div
      className="scene-root"
      style={rootStyle}
      data-running={running ? "true" : "false"}
      data-high-x={running && highX ? "true" : "false"}
      data-extreme-x={running && extremeX ? "true" : "false"}
    >
      <div className="scene-bg">
        <div className="space-zone-stack" aria-hidden>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`space-zone space-zone--${i}`}
              style={{ opacity: zoneOpacities[i] ?? 0 }}
            />
          ))}
        </div>
        <div className="stars layer-a" />
        <div className="stars layer-b" />
        <div className="stars layer-c" />
        <div className="star-twinkle" aria-hidden />
        <div className="cosmic-drift-slow" aria-hidden />
        <div className="cosmic-streaks" aria-hidden />
        <div className="speed-rush" aria-hidden />
        <div className="center-glow" />
        <div className="nebula" />
        <div className="vignette" />
      </div>
      <div className="scene-ground" />
      <div
        className={`rocket-wrap ${thrust}`}
        data-crashed={phase === "crashed" ? "true" : undefined}
      >
        {crashExplosionKey > 0 ? <CrashExplosionFx key={crashExplosionKey} /> : null}
        <div className="rocket-bob">
          <div className="rocket-stack">
            <div className="exhaust" aria-hidden>
              <div className="exhaust-bloom" />
              <div className="exhaust-plume-wide" />
              <div className="exhaust-tongue" />
              <div className="exhaust-core-hot" />
              <div className="exhaust-beam" />
              <div className="exhaust-sparks">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="exhaust-particles" aria-hidden>
                {Array.from({ length: 14 }, (_, i) => (
                  <span key={i} className={`exhaust-particle exhaust-particle--${i % 7}`} />
                ))}
              </div>
            </div>
            <img className="rocket" src={runtimeConfig.rocketImageUrl} alt="rocket" />
          </div>
        </div>
      </div>
    </div>
  );
}
