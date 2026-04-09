import { useEffect, useRef } from "react";
import type { RoundStatus } from "../types/crash";
import { engineFrequencyHz, engineGainForMultiplier } from "./multiplierFeel";

type AudioState = RoundStatus | "IDLE";

interface AudioBank {
  ctx: AudioContext;
  countdownBuffer: AudioBuffer;
  engineStartBuffer: AudioBuffer;
  explosionBuffer: AudioBuffer;
  engineLoopGain: GainNode;
  engineLoopOsc: OscillatorNode;
}

function createToneBuffer(ctx: AudioContext, frequency: number, durationSec: number, volume = 0.25): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const frameCount = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i += 1) {
    const t = i / sampleRate;
    const envelope = Math.max(0, 1 - t / durationSec);
    channel[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * volume;
  }
  return buffer;
}

function createNoiseBuffer(ctx: AudioContext, durationSec: number, volume = 0.35): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const frameCount = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i += 1) {
    const envelope = Math.max(0, 1 - i / frameCount);
    channel[i] = (Math.random() * 2 - 1) * envelope * volume;
  }
  return buffer;
}

function createAudioBank(): AudioBank | null {
  if (typeof window === "undefined" || typeof window.AudioContext === "undefined") {
    return null;
  }
  const ctx = new window.AudioContext();
  const countdownBuffer = createToneBuffer(ctx, 760, 0.08, 0.22);
  const engineStartBuffer = createToneBuffer(ctx, 220, 0.3, 0.25);
  const explosionBuffer = createNoiseBuffer(ctx, 0.45, 0.4);

  const engineLoopGain = ctx.createGain();
  engineLoopGain.gain.value = 0;
  engineLoopGain.connect(ctx.destination);

  const engineLoopOsc = ctx.createOscillator();
  engineLoopOsc.type = "sawtooth";
  engineLoopOsc.frequency.value = 120;
  engineLoopOsc.connect(engineLoopGain);
  engineLoopOsc.start();

  return { ctx, countdownBuffer, engineStartBuffer, explosionBuffer, engineLoopGain, engineLoopOsc };
}

export function useCrashAudio(
  roundStatus: AudioState,
  countdownValue: number,
  liveMultiplier?: string | null
): void {
  const bankRef = useRef<AudioBank | null>(null);
  const prevRoundStatus = useRef<AudioState>("IDLE");
  const prevCountdown = useRef<number>(countdownValue);

  useEffect(() => {
    const bank = createAudioBank();
    bankRef.current = bank;

    const unlock = () => {
      if (bank?.ctx.state === "suspended") {
        void bank.ctx.resume();
      }
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      if (bank) {
        bank.engineLoopOsc.stop();
        void bank.ctx.close();
      }
    };
  }, []);

  useEffect(() => {
    const bank = bankRef.current;
    if (!bank || bank.ctx.state !== "running") return;

    if (roundStatus === "BETTING_OPEN" && countdownValue !== prevCountdown.current) {
      const src = bank.ctx.createBufferSource();
      src.buffer = bank.countdownBuffer;
      src.connect(bank.ctx.destination);
      src.start();
    }
    prevCountdown.current = countdownValue;
  }, [countdownValue, roundStatus]);

  useEffect(() => {
    const bank = bankRef.current;
    if (!bank || bank.ctx.state !== "running") return;

    const prev = prevRoundStatus.current;
    if (roundStatus === prev) return;

    if (roundStatus === "IN_PROGRESS") {
      const start = bank.ctx.createBufferSource();
      start.buffer = bank.engineStartBuffer;
      start.connect(bank.ctx.destination);
      start.start();
      bank.engineLoopGain.gain.cancelScheduledValues(bank.ctx.currentTime);
      bank.engineLoopGain.gain.linearRampToValueAtTime(0.08, bank.ctx.currentTime + 0.3);
    } else if (roundStatus === "CRASHED") {
      const explosion = bank.ctx.createBufferSource();
      explosion.buffer = bank.explosionBuffer;
      explosion.connect(bank.ctx.destination);
      explosion.start();
      bank.engineLoopGain.gain.cancelScheduledValues(bank.ctx.currentTime);
      bank.engineLoopGain.gain.linearRampToValueAtTime(0, bank.ctx.currentTime + 0.12);
    } else if (roundStatus === "SETTLED" || roundStatus === "BETTING_OPEN" || roundStatus === "IDLE") {
      bank.engineLoopGain.gain.cancelScheduledValues(bank.ctx.currentTime);
      bank.engineLoopGain.gain.linearRampToValueAtTime(0, bank.ctx.currentTime + 0.2);
    }

    prevRoundStatus.current = roundStatus;
  }, [roundStatus]);

  useEffect(() => {
    const bank = bankRef.current;
    if (!bank || bank.ctx.state !== "running") return;

    const t = bank.ctx.currentTime;
    if (roundStatus !== "IN_PROGRESS") {
      bank.engineLoopOsc.frequency.exponentialRampToValueAtTime(120, t + 0.16);
      return;
    }

    const raw = Number(liveMultiplier ?? "1");
    const m = Number.isFinite(raw) && raw >= 1 ? raw : 1;
    const hz = engineFrequencyHz(m);
    const gain = engineGainForMultiplier(m);
    bank.engineLoopOsc.frequency.exponentialRampToValueAtTime(Math.max(72, hz), t + 0.09);
    const g = bank.engineLoopGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(gain, t + 0.09);
  }, [roundStatus, liveMultiplier]);
}
