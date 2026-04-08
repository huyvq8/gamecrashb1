import { useEffect, useRef } from "react";

interface RewardAudioApi {
  playClick: () => void;
  playBetPlaced: () => void;
  playReward: (intensity: "small" | "medium" | "big") => void;
}

export function useRewardAudio(): RewardAudioApi {
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.AudioContext === "undefined") return;
    ctxRef.current = new window.AudioContext();
    const unlock = () => {
      if (ctxRef.current?.state === "suspended") {
        void ctxRef.current.resume();
      }
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  function playClick() {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state !== "running") return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 780;
    gain.gain.value = 0.0001;
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  function playReward(intensity: "small" | "medium" | "big") {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state !== "running") return;
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(560, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(intensity === "big" ? 1240 : intensity === "medium" ? 1080 : 940, ctx.currentTime + 0.22);
    gain.gain.value = 0.0001;
    gain.gain.linearRampToValueAtTime(intensity === "big" ? 0.16 : 0.11, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }

  function playBetPlaced() {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state !== "running") return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.16);
    gain.gain.value = 0.0001;
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
  }

  return { playClick, playBetPlaced, playReward };
}

