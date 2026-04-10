import React, { useEffect, useRef, useState } from "react";
import { formatCompactUsdFromMinor, formatFullUsdFromMinor } from "../../lib/formatCompactUsd";
import { payoutSmoothDurationMs } from "../../lib/multiplierFeel";
import type { RoundStatus } from "../../types/crash";
import type { RoundPhase } from "./useCrashUiModel";

function money(minor: string | null): string {
  if (!minor) return "0";
  return (Number(minor) / 100).toLocaleString();
}

/** Ease numeric payout toward server value; duration scales down as X rises (sync with thrust/audio). */
function useSmoothedPayoutMinor(target: string | null, active: boolean, liveMultiplier: string | null): string {
  const [out, setOut] = useState(() => (active && target ? target : "0"));
  const valRef = useRef(Number(active && target ? target : 0));
  const rafRef = useRef(0);
  const multRef = useRef(liveMultiplier);
  multRef.current = liveMultiplier;

  useEffect(() => {
    if (!active) {
      const t = target ?? "0";
      valRef.current = Number(t);
      setOut(t);
      return;
    }
    if (target == null) return;
    const to = Number(target);
    if (!Number.isFinite(to)) return;
    cancelAnimationFrame(rafRef.current);
    const from = valRef.current;
    if (from === to) {
      setOut(String(to));
      return;
    }
    const start = performance.now();
    const m = Number(multRef.current ?? "1");
    const dur = payoutSmoothDurationMs(Number.isFinite(m) && m >= 1 ? m : 1);
    const run = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - (1 - p) ** 2;
      const v = Math.round(from + (to - from) * eased);
      valRef.current = v;
      setOut(String(v));
      if (p < 1) rafRef.current = requestAnimationFrame(run);
      else {
        valRef.current = to;
        setOut(String(to));
      }
    };
    rafRef.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, active]);

  return out;
}

export function CrashBottomDock(props: {
  phase: RoundPhase;
  roundStatus: RoundStatus | null;
  countdownValue: number | null;
  selectionAmountMinor: string;
  placedBetAmountMinor: string | null;
  /** Payout minor when bet is CASHED_OUT (from server bet record). */
  placedBetPayoutMinor: string | null;
  placedBetStatus: "ACTIVE" | "CASHED_OUT" | "LOST" | "REJECTED" | null;
  livePayoutMinor: string | null;
  liveMultiplier: string | null;
  canPlaceBet: boolean;
  canReplaceBet: boolean;
  canCashOut: boolean;
  isLoading: boolean;
  chipsLocked: boolean;
  onAddChip: (minor: string) => void;
  onPlaceBet: () => void | Promise<void>;
  onCashOut: () => void | Promise<void>;
  /** Canonical locked payout minor after successful cashout (reward UI); overrides live smoothing. */
  lockedCashoutPayoutMinor?: string | null;
}) {
  const {
    phase,
    roundStatus,
    countdownValue,
    selectionAmountMinor,
    placedBetAmountMinor,
    placedBetPayoutMinor,
    placedBetStatus,
    livePayoutMinor,
    liveMultiplier,
    canPlaceBet,
    canReplaceBet,
    canCashOut,
    isLoading,
    chipsLocked,
    onAddChip,
    onPlaceBet,
    onCashOut,
    lockedCashoutPayoutMinor = null
  } = props;

  let ctaMode: "placebet" | "updatebet" | "betplaced" | "cashout" | "cashedout" | "disabled" = "disabled";
  if (phase === "running") {
    if (placedBetStatus === "ACTIVE" && canCashOut) ctaMode = "cashout";
    else if (placedBetStatus === "CASHED_OUT") ctaMode = "cashedout";
    else ctaMode = "disabled";
  } else if (phase === "betting_open" || phase === "prepare") {
    if (placedBetAmountMinor && canReplaceBet) {
      ctaMode = "updatebet";
    } else if (placedBetAmountMinor) {
      ctaMode = "betplaced";
    } else if (canPlaceBet) {
      ctaMode = "placebet";
    } else {
      ctaMode = "disabled";
    }
  } else {
    if (placedBetStatus === "CASHED_OUT") ctaMode = "cashedout";
    else if (placedBetAmountMinor) ctaMode = "betplaced";
    else ctaMode = "disabled";
  }

  const chipDisabled = chipsLocked || isLoading;
  const payoutSmoothingActive = phase === "running" && livePayoutMinor != null;
  const smoothedPayout = useSmoothedPayoutMinor(
    livePayoutMinor,
    payoutSmoothingActive,
    liveMultiplier
  );
  const wonMinorForUi =
    lockedCashoutPayoutMinor != null && lockedCashoutPayoutMinor !== ""
      ? lockedCashoutPayoutMinor
      : placedBetPayoutMinor != null && placedBetPayoutMinor !== ""
        ? placedBetPayoutMinor
        : null;

  /** Stake shown in capsule: during running, server committed amount; during countdown, draft selection when editing. */
  const stakeMinorForDisplay = (() => {
    if (phase === "running" || phase === "crashed" || phase === "result") {
      if (placedBetStatus === "CASHED_OUT" && wonMinorForUi != null) return wonMinorForUi;
      if (placedBetAmountMinor) return placedBetAmountMinor;
    } else if (phase === "betting_open" || phase === "prepare") {
      if (placedBetAmountMinor) {
        return selectionAmountMinor !== "0" ? selectionAmountMinor : placedBetAmountMinor;
      }
    }
    return selectionAmountMinor !== "0" ? selectionAmountMinor : null;
  })();
  const stakeDisplayText = stakeMinorForDisplay != null ? money(stakeMinorForDisplay) : "—";

  const hasCommittedBet = !!placedBetAmountMinor;
  const inPlayRunning = phase === "running" && placedBetStatus === "ACTIVE" && hasCommittedBet;
  const stakeCapsuleKind = inPlayRunning ? "inplay" : "next";

  const stakeContextLabel = (() => {
    if (phase === "running" || phase === "crashed" || phase === "result") {
      if (placedBetStatus === "CASHED_OUT") {
        return wonMinorForUi != null ? "Won" : "Cashed Out";
      }
    }
    if (inPlayRunning) return "In Play";
    if (phase === "betting_open" || phase === "prepare") {
      if (stakeMinorForDisplay != null) return "Your Bet";
    }
    if (stakeMinorForDisplay != null) return "Your Bet";
    return "Next Bet";
  })();

  const needsSelectAmount =
    !placedBetAmountMinor && selectionAmountMinor === "0" && (phase === "betting_open" || phase === "prepare");

  const bettingUrgent =
    roundStatus === "BETTING_OPEN" &&
    (ctaMode === "placebet" || ctaMode === "updatebet") &&
    !needsSelectAmount &&
    countdownValue != null &&
    countdownValue > 0 &&
    countdownValue <= 5;

  type CtaVisual = "idle" | "active" | "done";

  let ctaVisual: CtaVisual = "done";
  let ctaLabel = "···";
  let ctaDisabled = true;
  let ctaMuted = false;
  let ctaOnClick: (() => void | Promise<void>) | undefined;
  let ctaTitle: string | undefined;
  let ctaAria: string | undefined;

  const cashoutPayoutMinorForUi =
    ctaMode === "cashout" && lockedCashoutPayoutMinor != null && lockedCashoutPayoutMinor !== ""
      ? lockedCashoutPayoutMinor
      : ctaMode === "cashout"
        ? smoothedPayout
        : "0";

  if (ctaMode === "cashout") {
    ctaVisual = "active";
    ctaLabel = "";
    ctaDisabled = !canCashOut || isLoading;
    ctaOnClick = onCashOut;
    ctaTitle = `Cash out $${formatFullUsdFromMinor(cashoutPayoutMinorForUi)}`;
    ctaAria = `Cash out ${formatFullUsdFromMinor(cashoutPayoutMinorForUi)} dollars`;
  } else if (needsSelectAmount) {
    ctaVisual = "idle";
    ctaLabel = "Bet Now";
    ctaDisabled = true;
    ctaMuted = true;
  } else if (ctaMode === "placebet") {
    ctaVisual = "idle";
    ctaLabel = `Bet $${formatFullUsdFromMinor(selectionAmountMinor)}`;
    ctaDisabled = !canPlaceBet || isLoading;
    ctaOnClick = onPlaceBet;
    ctaTitle = `Place bet $${formatFullUsdFromMinor(selectionAmountMinor)}`;
  } else if (ctaMode === "updatebet") {
    ctaVisual = "active";
    ctaLabel = "Update Bet";
    ctaDisabled = !canReplaceBet || isLoading;
    ctaOnClick = onPlaceBet;
    ctaTitle = `Update bet to $${formatFullUsdFromMinor(selectionAmountMinor)}`;
  } else if (ctaMode === "betplaced") {
    ctaVisual = "done";
    ctaLabel = "Bet Placed";
  } else if (ctaMode === "cashedout") {
    ctaVisual = "done";
    ctaLabel =
      wonMinorForUi != null ? `Won: $${formatFullUsdFromMinor(wonMinorForUi)}` : "Cashed Out";
    ctaAria = ctaLabel;
  } else {
    ctaVisual = "done";
    ctaLabel = "···";
    ctaAria = "No action";
  }

  return (
    <div className="bottom-dock">
      <div className="row row-1" id="crash-reward-origin">
        <div className="money-zones">
          <div
            className={`bet-amount-capsule bet-amount-capsule--${stakeCapsuleKind}${stakeMinorForDisplay == null ? " bet-amount-capsule--empty" : ""}`}
            title={stakeMinorForDisplay != null ? `$${formatFullUsdFromMinor(stakeMinorForDisplay)}` : undefined}
          >
            <span className="bet-amount-context">{stakeContextLabel}</span>
            <div className="bet-amount-row">
              <span className="bet-amount-dot" aria-hidden>
                ●
              </span>
              <span
                className={`bet-amount-value${stakeMinorForDisplay == null ? " bet-amount-value--empty" : ""}`}
              >
                {stakeDisplayText}
              </span>
            </div>
          </div>
        </div>
        <div
          className={[
            "main-cta",
            "main-cta--unified",
            bettingUrgent ? "is-betting-urgent" : ""
          ]
            .filter(Boolean)
            .join(" ")}
          data-dock-cta={ctaMode}
        >
          <button
            type="button"
            className={[
              "cta-main",
              `cta-main--${ctaVisual}`,
              ctaMuted ? "cta-main--muted" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={ctaDisabled}
            title={ctaTitle}
            aria-label={ctaAria ?? ctaLabel}
            onClick={() => {
              if (ctaOnClick) void ctaOnClick();
            }}
          >
            {ctaMode === "cashout" ? (
              <span className="cta-main__cashout-stack">
                <span className="cta-main__payout">{formatCompactUsdFromMinor(cashoutPayoutMinorForUi)}</span>
                <span className="cta-main__sublabel">Cash Out</span>
              </span>
            ) : (
              <span className="cta-main__label">{ctaLabel}</span>
            )}
          </button>
        </div>
      </div>

      <div className="row row-2">
        <div className="chips">
          {[
            { label: "100", value: "100" },
            { label: "200", value: "200" },
            { label: "500", value: "500" },
            { label: "1K", value: "1000" },
            { label: "5K", value: "5000" },
            { label: "10K", value: "10000" }
          ].map(({ label, value }) => (
            <button
              key={value}
              type="button"
              className={`chip chip-token chip-denom chip-denom--${value}`}
              disabled={chipDisabled}
              onClick={() => onAddChip(value)}
            >
              <span className="chip-token__rim" aria-hidden />
              <span className="chip-token__metal" aria-hidden />
              <span className="chip-token__edge" aria-hidden />
              <span className="chip-token__label">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
