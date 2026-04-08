import React from "react";
import type { HistoryItem } from "./useCrashUiModel";

function colorClassForMultiplier(m: number): string {
  if (m < 1.5) return "hx-tier-1";
  if (m < 3.0) return "hx-tier-2";
  if (m < 10.0) return "hx-tier-3";
  return "hx-tier-4";
}

function Pill({ value }: { value: string | null }) {
  const n = value ? Number(value) : null;
  const cls = n ? colorClassForMultiplier(n) : "hx-tier-1";
  const text = n ? `${n.toFixed(2)}x` : "-";
  return <div className={`history-pill ${cls}`}>{text}</div>;
}

export function CrashHistory(props: {
  items: HistoryItem[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const { items, expanded, onToggle } = props;
  const limit = expanded ? 16 : 4;
  const view = items.slice(0, limit);
  return (
    <div className="crash-history">
      <div className={`history-grid ${expanded ? "expanded" : "compact"}`}>
        {view.map((it) => (
          <Pill key={it.roundId} value={it.finalMultiplier} />
        ))}
      </div>
      <button className="history-expand" onClick={onToggle} aria-label="toggle history">
        {expanded ? "−" : "+"}
      </button>
    </div>
  );
}

