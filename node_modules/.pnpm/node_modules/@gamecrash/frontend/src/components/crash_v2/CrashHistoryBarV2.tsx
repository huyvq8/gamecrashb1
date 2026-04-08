import React, { useMemo, useState } from "react";
import type { HistoryRound } from "../../types/crash";

function formatPillText(multiplier: string | null): string {
  const base = multiplier ?? "1.00";
  const n = Number(base);
  if (!isFinite(n) || n <= 0) return "—";
  const rounded = Math.max(1, Math.floor(n * 100) / 100);
  return `${rounded.toFixed(2)}x`;
}

function pillClass(multiplier: string | null): string {
  const n = Number(multiplier ?? "1");
  if (n >= 10) return "crash-v2-pill high";
  if (n >= 3) return "crash-v2-pill med";
  return "crash-v2-pill low";
}

export function CrashHistoryBarV2(props: { history: HistoryRound[] }) {
  const { history } = props;
  const [expanded, setExpanded] = useState(false);

  // newest on the LEFT
  const ordered = useMemo(() => {
    const copy = [...history];
    copy.reverse();
    return copy;
  }, [history]);

  const visible = expanded ? ordered.slice(0, 16) : ordered.slice(0, 4);

  return (
    <div className="crash-v2-historybar">
      {expanded ? (
        <div className="crash-v2-history-grid">
          {visible.map((r) => (
            <div key={r.roundId} className={pillClass(r.crashMultiplier)}>{formatPillText(r.crashMultiplier)}</div>
          ))}
        </div>
      ) : (
        <div className="crash-v2-history-row">
          {visible.map((r) => (
            <div key={r.roundId} className={pillClass(r.crashMultiplier)}>{formatPillText(r.crashMultiplier)}</div>
          ))}
        </div>
      )}
      <div className="crash-v2-history-controls">
        <button className="crash-v2-expand-icon" aria-label="Toggle history size" onClick={() => setExpanded((v) => !v)}>
          {/* simple chevron icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            {expanded ? (
              <path d="M7 14l5-5 5 5H7z" />
            ) : (
              <path d="M7 10l5 5 5-5H7z" />
            )}
          </svg>
        </button>
      </div>
    </div>
  );
}

