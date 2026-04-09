import React, { useCallback, useEffect, useRef, useState } from "react";
import { useCrashAudio } from "../../lib/useCrashAudio";
import { useBalanceCountUp } from "../../lib/useBalanceCountUp";
import { useRewardAudio } from "../../lib/useRewardAudio";
import type { RoundOutcome } from "./useCrashUiModel";
import { useCrashUiModel } from "./useCrashUiModel";
import { CrashTopBar } from "./CrashTopBar";
import { CrashScene } from "./CrashScene";
import { CrashCenterDisplay } from "./CrashCenterDisplay";
import { CrashBottomDock } from "./CrashBottomDock";
import "./crashRebuild.css";

function formatOutcomeMinor(minor: string | null | undefined): string {
  if (minor == null || minor === "") return "";
  return (Number(minor) / 100).toLocaleString();
}

type ToastPayload =
  | { variant: "win"; payoutMinor: string | null }
  | { variant: "lose" }
  | { variant: "error"; message: string }
  | { variant: "success"; message: string }
  | { variant: "info"; message: string };

const TOAST_MS_DEFAULT = 2200;
const TOAST_MS_ERROR = 2400;

/** Reward sequence phases (visual only). */
export type CashoutRewardPhase = "a" | "b" | "c";

type RewardFlyParticle = {
  id: number;
  left: number;
  top: number;
  dx: number;
  dy: number;
  delayMs: number;
  ch: string;
};

type RewardFlyState = { key: number; particles: RewardFlyParticle[] };

/** DOM-measured flight from dock → balance (viewport px). */
function computeRewardParticles(): RewardFlyParticle[] {
  const bal = document.getElementById("crash-balance-reward-target");
  const origin = document.getElementById("crash-reward-origin");
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let startX = vw * 0.52;
  let startY = vh * 0.78;
  let endX = vw * 0.72;
  let endY = vh * 0.13;
  const orW = origin?.getBoundingClientRect().width ?? 140;
  if (bal && origin) {
    const br = bal.getBoundingClientRect();
    const or = origin.getBoundingClientRect();
    startX = or.left + or.width * 0.58;
    startY = or.top + or.height * 0.42;
    endX = br.left + br.width * 0.32;
    endY = br.top + br.height * 0.5;
  }
  const n = 12;
  const chars = ["$", "$", "$", "✦", "$", "●", "$", "✦", "$", "●", "$", "$"];
  const out: RewardFlyParticle[] = [];
  for (let i = 0; i < n; i++) {
    const jx = (Math.random() - 0.5) * orW * 0.5;
    const jy = (Math.random() - 0.5) * 18;
    const sx = startX + jx;
    const sy = startY + jy;
    const ex = endX + (Math.random() - 0.5) * 32;
    const ey = endY + (Math.random() - 0.5) * 16;
    out.push({
      id: i,
      left: sx,
      top: sy,
      dx: ex - sx,
      dy: ey - sy,
      delayMs: i * 26,
      ch: chars[i % chars.length] ?? "$"
    });
  }
  return out;
}

export function CrashScreenRebuild() {
  const rewardAudio = useRewardAudio();
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cashoutSeqTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const [toastKey, setToastKey] = useState(0);

  const [cashoutReward, setCashoutReward] = useState<CashoutRewardPhase | null>(null);
  const [lockedCashoutPayoutMinor, setLockedCashoutPayoutMinor] = useState<string | null>(null);
  const [balanceRewardGlow, setBalanceRewardGlow] = useState(false);
  const [counting, setCounting] = useState(false);
  const [countRun, setCountRun] = useState(0);
  const [countFrom, setCountFrom] = useState("0");
  const [countTo, setCountTo] = useState("0");
  const [rewardFlight, setRewardFlight] = useState<RewardFlyState | null>(null);
  const prevPhaseForExplosionRef = useRef<string | null>(null);
  const [crashExplosionKey, setCrashExplosionKey] = useState(0);

  const scheduleToast = useCallback((payload: ToastPayload, durationMs: number = TOAST_MS_DEFAULT) => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setToastKey((k) => k + 1);
    setToast(payload);
    dismissTimerRef.current = setTimeout(() => {
      setToast(null);
      dismissTimerRef.current = null;
    }, durationMs);
  }, []);

  const ui = useCrashUiModel({
    onChip: () => rewardAudio.playClick(),
    onBetPlaced: () => rewardAudio.playBetPlaced(),
    onError: () => rewardAudio.playError(),
    onToast: ({ kind, message }) => {
      const ms = kind === "error" ? TOAST_MS_ERROR : TOAST_MS_DEFAULT;
      if (kind === "error") scheduleToast({ variant: "error", message }, ms);
      else if (kind === "success") scheduleToast({ variant: "success", message }, ms);
      else scheduleToast({ variant: "info", message }, ms);
    }
  });

  useEffect(() => {
    const prev = prevPhaseForExplosionRef.current;
    if (prev !== "crashed" && ui.phase === "crashed") {
      setCrashExplosionKey((k) => k + 1);
    }
    prevPhaseForExplosionRef.current = ui.phase;
  }, [ui.phase]);

  const animatedBalance = useBalanceCountUp(countRun, countFrom, countTo, 950, counting);
  const balanceForTopBar = counting ? animatedBalance : ui.balanceMinor;

  const audioState = ui.roundStatus ?? "IDLE";
  useCrashAudio(
    audioState,
    ui.countdownValue ?? 0,
    audioState === "IN_PROGRESS" ? ui.liveMultiplier : null
  );

  const chipsLocked = ui.phase === "running" && ui.placedBetStatus === "ACTIVE";

  const clearCashoutSeqTimers = useCallback(() => {
    cashoutSeqTimersRef.current.forEach((id) => clearTimeout(id));
    cashoutSeqTimersRef.current = [];
  }, []);

  const handleCashOut = useCallback(async () => {
    rewardAudio.playCashoutTap();
    setCashoutReward("a");
    const clearAPhase = window.setTimeout(() => {
      setCashoutReward((r) => (r === "a" ? null : r));
    }, 120);

    const result = await ui.cashOut();
    clearTimeout(clearAPhase);

    if (!result.ok) {
      setCashoutReward(null);
      return;
    }

    setLockedCashoutPayoutMinor(result.payoutMinor);
    setCashoutReward("b");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setRewardFlight({ key: Date.now(), particles: computeRewardParticles() });
      });
    });

    clearCashoutSeqTimers();
    /* Coin sound after particles near balance; count-up shortly after */
    cashoutSeqTimersRef.current.push(window.setTimeout(() => rewardAudio.playCashoutVault(), 480));
    cashoutSeqTimersRef.current.push(
      window.setTimeout(() => {
        setCountFrom(result.balanceBeforeMinor);
        setCountTo(result.balanceAfterMinor);
        setCountRun((k) => k + 1);
        setCounting(true);
        setBalanceRewardGlow(true);
      }, 530)
    );
    cashoutSeqTimersRef.current.push(window.setTimeout(() => setCashoutReward("c"), 820));
    cashoutSeqTimersRef.current.push(
      window.setTimeout(() => {
        setCashoutReward(null);
        setLockedCashoutPayoutMinor(null);
        setCounting(false);
        setBalanceRewardGlow(false);
        setRewardFlight(null);
      }, 1580)
    );
  }, [ui.cashOut, rewardAudio, clearCashoutSeqTimers]);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      clearCashoutSeqTimers();
    };
  }, [clearCashoutSeqTimers]);

  useEffect(() => {
    const html = document.documentElement;
    const appRoot = document.getElementById("root");
    html.classList.add("crash-shell");
    document.body.classList.add("crash-shell");
    appRoot?.classList.add("crash-shell-root");
    return () => {
      html.classList.remove("crash-shell");
      document.body.classList.remove("crash-shell");
      appRoot?.classList.remove("crash-shell-root");
    };
  }, []);

  useEffect(() => {
    const o: RoundOutcome = ui.roundOutcome;
    if (!o) return;
    if (o.kind === "win") {
      scheduleToast({ variant: "win", payoutMinor: o.payoutMinor ?? null }, TOAST_MS_DEFAULT);
    } else {
      scheduleToast({ variant: "lose" }, TOAST_MS_DEFAULT);
    }
  }, [ui.roundOutcome, scheduleToast]);

  const toastClass =
    toast == null
      ? ""
      : toast.variant === "win"
        ? "crash-toast crash-toast--win"
        : toast.variant === "lose"
          ? "crash-toast crash-toast--lose"
          : toast.variant === "error"
            ? "crash-toast crash-toast--error"
            : toast.variant === "success"
              ? "crash-toast crash-toast--success"
              : "crash-toast crash-toast--info";

  const toastText =
    toast == null
      ? ""
      : toast.variant === "win"
        ? `Cashed out${toast.payoutMinor ? ` +${formatOutcomeMinor(toast.payoutMinor)}` : ""}`
        : toast.variant === "lose"
          ? "Bet lost"
          : toast.message;

  const toastLive: "assertive" | "polite" = toast?.variant === "error" ? "assertive" : "polite";

  return (
    <div className="crash-mobile-frame">
    <div
      className="crash-root"
      data-cashout-reward={cashoutReward ?? undefined}
      data-cashout-reward-active={cashoutReward != null ? "1" : undefined}
    >
      <div className="crash-top">
        <CrashTopBar
          balanceMinor={balanceForTopBar}
          balanceRewardGlow={balanceRewardGlow}
          history={ui.history}
          historyExpanded={ui.historyExpanded}
          onToggleHistory={ui.toggleHistoryExpanded}
          onDeposit={ui.deposit}
          depositBusy={ui.depositBusy}
        />
      </div>

      {toast ? (
        <div key={toastKey} className={toastClass} role="status" aria-live={toastLive}>
          {toastText}
        </div>
      ) : null}

      <div className="crash-center">
        <CrashScene phase={ui.phase} liveMultiplier={ui.liveMultiplier} crashExplosionKey={crashExplosionKey} />
        <div className="crash-center-overlay">
          <CrashCenterDisplay
            phase={ui.phase}
            countdownValue={ui.countdownValue}
            liveMultiplier={ui.liveMultiplier}
          />
        </div>
      </div>

      {rewardFlight != null && (cashoutReward === "b" || cashoutReward === "c") ? (
        <div
          className={`cashout-reward-fly-root${cashoutReward === "c" ? " cashout-reward-fly-root--fade" : ""}`}
          aria-hidden
        >
          {rewardFlight.particles.map((p) => (
            <span
              key={`${rewardFlight.key}-${p.id}`}
              className={`cashout-reward-fly cashout-reward-fly--${p.id % 3}`}
              style={
                {
                  left: p.left,
                  top: p.top,
                  "--dx": `${p.dx}px`,
                  "--dy": `${p.dy}px`,
                  animationDelay: `${p.delayMs}ms`
                } as React.CSSProperties
              }
            >
              {p.ch}
            </span>
          ))}
        </div>
      ) : null}

      <div className="crash-bottom">
        <CrashBottomDock
          phase={ui.phase}
          roundStatus={ui.roundStatus}
          countdownValue={ui.countdownValue}
          selectionAmountMinor={ui.selectionAmountMinor}
          placedBetAmountMinor={ui.placedBetAmountMinor}
          placedBetStatus={ui.placedBetStatus}
          livePayoutMinor={ui.livePayoutMinor}
          liveMultiplier={ui.liveMultiplier}
          canPlaceBet={ui.canPlaceBet}
          canReplaceBet={ui.canReplaceBet}
          canCashOut={ui.canCashOut}
          isLoading={ui.isLoading}
          chipsLocked={chipsLocked}
          onAddChip={ui.addChip}
          onPlaceBet={ui.placeBet}
          onCashOut={handleCashOut}
          lockedCashoutPayoutMinor={lockedCashoutPayoutMinor}
        />
      </div>
    </div>
    </div>
  );
}
