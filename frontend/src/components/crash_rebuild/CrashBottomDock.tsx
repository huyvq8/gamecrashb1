import React from "react";
import type { RoundPhase } from "./useCrashUiModel";

function money(minor: string | null): string {
  if (!minor) return "0";
  return (Number(minor) / 100).toLocaleString();
}

export function CrashBottomDock(props: {
  phase: RoundPhase;
  selectionAmountMinor: string;
  activeBetAmountMinor: string | null;
  placedBetAmountMinor: string | null;
  placedBetStatus: "ACTIVE" | "CASHED_OUT" | "LOST" | "REJECTED" | null;
  livePayoutMinor: string | null;
  canPlaceBet: boolean;
  canCashOut: boolean;
  isLoading: boolean;
  onAddChip: (minor: string) => void;
  onClear: () => void;
  onPlaceBet: () => void | Promise<void>;
  onCashOut: () => void | Promise<void>;
}) {
  const {
    phase,
    selectionAmountMinor,
    activeBetAmountMinor,
    placedBetAmountMinor,
    placedBetStatus,
    livePayoutMinor,
    canPlaceBet,
    canCashOut,
    isLoading,
    onAddChip,
    onClear,
    onPlaceBet,
    onCashOut
  } = props;

  // Bet tray is visible for the entire round once bet is placed (ACTIVE or CASHED_OUT),
  // including waiting/locked state before running.
  const showBetTray = !!placedBetAmountMinor && (phase === "betting_open" || phase === "prepare" || phase === "running" || phase === "crashed" || phase === "result");

  // Button states:
  // - Before bet (open + selection > 0): Place Bet enabled
  // - After bet before running: disabled "Bet Placed"
  // - During running with ACTIVE: "Cash Out XXX"
  // - During running with CASHED_OUT: disabled "Cashed Out"
  // - After result/crash: disabled (short)
  let ctaMode: "placebet" | "betplaced" | "cashout" | "cashedout" | "disabled" = "disabled";
  if (phase === "running") {
    if (placedBetStatus === "ACTIVE" && canCashOut) ctaMode = "cashout";
    else if (placedBetStatus === "CASHED_OUT") ctaMode = "cashedout";
    else ctaMode = "disabled";
  } else if (phase === "betting_open" || phase === "prepare") {
    if (placedBetAmountMinor) {
      ctaMode = "betplaced";
    } else if (canPlaceBet) {
      ctaMode = "placebet";
    } else {
      ctaMode = "disabled";
    }
  } else {
    // crashed/result/cooldown
    if (placedBetStatus === "CASHED_OUT") ctaMode = "cashedout";
    else if (placedBetAmountMinor) ctaMode = "betplaced";
    else ctaMode = "disabled";
  }

  return (
    <div className="bottom-dock">
      <div className="row row-1">
        {showBetTray ? (
          <div className="compact-tray prominent">
            <div className="tray-icon" />
            <div className="tray-amount">{money(placedBetAmountMinor)}</div>
            {phase === "running" && <div className="tray-payout">{livePayoutMinor ? money(livePayoutMinor) : ""}</div>}
          </div>
        ) : (
          <div className="selection-capsule">
            <div className="money-icon" />
            <div className="money-amount">{money(selectionAmountMinor)}</div>
          </div>
        )}
        <div className={`main-cta ${ctaMode}`}>
          {ctaMode === "placebet" && (
            <button disabled={!canPlaceBet || isLoading} onClick={() => onPlaceBet()}>
              Place Bet
            </button>
          )}
          {ctaMode === "betplaced" && (
            <button disabled className="cta-locked">Bet Placed</button>
          )}
          {ctaMode === "cashout" && (
            <button className="cta-cashout" disabled={!canCashOut || isLoading} onClick={() => onCashOut()}>
              {livePayoutMinor ? `Cash Out ${money(livePayoutMinor)}` : "Cash Out"}
            </button>
          )}
          {ctaMode === "cashedout" && (
            <button disabled className="cta-locked">Cashed Out</button>
          )}
          {ctaMode === "disabled" && (
            <button disabled className="cta-locked"></button>
          )}
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
            <button key={value} className="chip" onClick={() => onAddChip(value)}>
              {label}
            </button>
          ))}
          <button className="chip clr" onClick={() => onClear()}>CLR</button>
        </div>
      </div>

      {/* Row 3 removed; bet tray is now persistent in Row 1 */}
    </div>
  );
}

