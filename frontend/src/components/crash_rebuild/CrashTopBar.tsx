import React from "react";
import type { HistoryItem } from "./useCrashUiModel";
import { CrashHistory } from "./CrashHistory";

export function CrashTopBar(props: {
  balanceMinor: string;
  /** Soft glow while balance count-up runs after cashout. */
  balanceRewardGlow?: boolean;
  history: HistoryItem[];
  historyExpanded: boolean;
  onToggleHistory: () => void;
  onDeposit: () => void | Promise<void>;
  depositBusy: boolean;
}) {
  const {
    balanceMinor,
    balanceRewardGlow = false,
    history,
    historyExpanded,
    onToggleHistory,
    onDeposit,
    depositBusy
  } = props;
  const bal = (Number(balanceMinor) / 100).toLocaleString("en-US");
  return (
    <div className="crash-topbar">
      <div className="crash-topbar-header">
        <div className="crash-title">CRASH</div>
        <div className="crash-live-badge">LIVE</div>
        <div className="crash-balance-group">
          <div
            id="crash-balance-reward-target"
            className={`crash-balance-figure${balanceRewardGlow ? " crash-balance-figure--reward" : ""}`}
            aria-label="Balance"
          >
            <span className="crash-balance-dollar">$</span>
            <span className="crash-balance-amount">{bal}</span>
          </div>
          <button
            type="button"
            className="crash-deposit-btn"
            onClick={() => void onDeposit()}
            disabled={depositBusy}
          >
            Deposit
          </button>
        </div>
      </div>
      <CrashHistory items={history} expanded={historyExpanded} onToggle={onToggleHistory} />
    </div>
  );
}
