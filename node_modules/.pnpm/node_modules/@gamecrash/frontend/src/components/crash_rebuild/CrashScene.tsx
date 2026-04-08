import React from "react";
import type { RoundPhase } from "./useCrashUiModel";
import { runtimeConfig } from "../../config/runtimeConfig";

export function CrashScene(props: { phase: RoundPhase }) {
  const { phase } = props;
  const thrust =
    phase === "running" ? "thrust-strong" :
    phase === "prepare" || phase === "betting_open" ? "thrust-idle" :
    "thrust-off";

  return (
    <div className="scene-root">
      <div className="scene-bg">
        <div className="stars layer-a" />
        <div className="stars layer-b" />
        <div className="stars layer-c" />
        <div className="center-glow" />
        <div className="nebula" />
        <div className="vignette" />
      </div>
      <div className="scene-ground" />
      <div className={`rocket-wrap ${thrust}`}>
        <img className="rocket" src={runtimeConfig.rocketImageUrl} alt="rocket" />
        <div className="thrust-core" />
        <div className="thrust-aura" />
        <div className="thrust-beam" />
      </div>
    </div>
  );
}

