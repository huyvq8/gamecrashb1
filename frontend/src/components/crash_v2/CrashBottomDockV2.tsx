import React from "react";

function formatMinorInteger(minor: string): string {
  const n = Math.floor(Number(minor)); // already minor units, keep integer
  if (!isFinite(n)) return "0";
  return n.toLocaleString();
}

function formatChipLabel(minor: string): string {
  const v = Number(minor);
  if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K`;
  return `${v}`;
}

export function CrashBottomDockV2(props: {
  amountMinor: string;
  onAddChip: (minor: string) => void;
  onClear: () => void;
  mainLabel: "Place Bet" | "Cash Out";
  mainEnabled: boolean;
  onMain: () => void;
  showBetTray: boolean;
  betAmountMinor?: string | null;
  isActiveBet?: boolean;
  potentialPayoutMinor?: string | null;
}) {
  const chipValues = ["100", "200", "500", "1000", "5000", "10000"];
  return (
    <div className="crash-v2-dock">
      <div className="crash-v2-row">
        <div className="crash-v2-amount">{formatMinorInteger(props.amountMinor)}</div>
        <button
          className={`crash-v2-cta ${props.mainEnabled ? "is-ready" : ""} ${props.isActiveBet ? "is-active" : ""}`}
          onClick={props.onMain}
          disabled={!props.mainEnabled}
        >
          {props.mainLabel}
          {props.isActiveBet && props.potentialPayoutMinor ? ` ${formatMinorInteger(props.potentialPayoutMinor)}` : ""}
        </button>
      </div>
      <div className="crash-v2-chips">
        {chipValues.map((v) => (
          <button key={v} className="crash-v2-chip" onClick={() => props.onAddChip(v)}>
            {formatChipLabel(v)}
          </button>
        ))}
        <button className="crash-v2-chip" onClick={props.onClear}>CLR</button>
      </div>
      {props.showBetTray ? (
        <div className="crash-v2-bettray">● {formatMinorInteger(props.betAmountMinor ?? "0")}</div>
      ) : null}
    </div>
  );
}

