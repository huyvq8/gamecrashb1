import { useEffect, useRef } from "react";

interface RewardAudioApi {
  playClick: () => void;
  playBetPlaced: () => void;
  playReward: (intensity: "small" | "medium" | "big") => void;
  /** Short mechanical “tap” on cash out press (non-blocking). */
  playCashoutTap: () => void;
  /** Coin / vault drop — single hit when cashout succeeds (premium, not loud). */
  playCashoutVault: () => void;
  playError: () => void;
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

  function playError() {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state !== "running") return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 180;
    gain.gain.value = 0.0001;
    gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
  }

  function playCashoutTap() {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state !== "running") return;
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(620, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(980, ctx.currentTime + 0.05);
    gain.gain.value = 0.0001;
    gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.07);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  }

  /** Layered “coins into tray” — louder than before so it reads over rocket SFX. */
  function playCashoutVault() {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state !== "running") return;
    const t0 = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.28;
    master.connect(ctx.destination);

    const drops = [
      { f: 880, d: 0 },
      { f: 740, d: 0.05 },
      { f: 620, d: 0.1 },
      { f: 520, d: 0.16 },
      { f: 480, d: 0.22 }
    ];
    for (const { f, d } of drops) {
      const g = ctx.createGain();
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(f, t0 + d);
      g.gain.value = 0.0001;
      g.gain.linearRampToValueAtTime(0.12, t0 + d + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.1);
      o.connect(g);
      g.connect(master);
      o.start(t0 + d);
      o.stop(t0 + d + 0.11);
    }

    const noiseBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.06), ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * 0.35;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const ng = ctx.createGain();
    ng.gain.value = 0.0001;
    ng.gain.linearRampToValueAtTime(0.09, t0 + 0.02);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1400;
    noise.connect(bp);
    bp.connect(ng);
    ng.connect(master);
    noise.start(t0 + 0.02);
    noise.stop(t0 + 0.08);
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

  return { playClick, playBetPlaced, playReward, playCashoutTap, playCashoutVault, playError };
}

