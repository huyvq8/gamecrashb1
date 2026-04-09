import { useMemo } from "react";
import type { HistoryItem } from "./useCrashUiModel";

function colorClassForMultiplier(m: number): string {
  if (m < 1.5) return "hx-tier-1";
  if (m < 3.0) return "hx-tier-2";
  if (m < 10.0) return "hx-tier-3";
  return "hx-tier-4";
}

/** `items` is already newest-first from the model — slice only, no re-sort. */
function Pill({
  value,
  isLatest,
  tier
}: {
  value: string | null;
  isLatest?: boolean;
  /** expanded row2 = older archive */
  tier?: "older";
}) {
  const n = value ? Number(value) : null;
  const cls = n ? colorClassForMultiplier(n) : "hx-tier-1";
  const text = n ? `${n.toFixed(2)}x` : "—";
  const extra = [isLatest ? "history-pill--latest" : "", tier === "older" ? "history-pill--older" : ""].filter(Boolean).join(" ");
  return (
    <div
      className={`history-pill ${cls}${extra ? ` ${extra}` : ""}`}
      aria-current={isLatest ? "true" : undefined}
      data-latest={isLatest ? "true" : undefined}
    >
      {text}
    </div>
  );
}

export function CrashHistory(props: {
  items: HistoryItem[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const { items, expanded, onToggle } = props;
  const limit = expanded ? 16 : 6;
  const view = useMemo(() => items.slice(0, limit), [items, limit]);

  return (
    <div className="crash-history" data-expanded={expanded ? "true" : undefined}>
      <div className="crash-history__pills">
        {!expanded ? (
          <div className="history-grid history-grid--compact">
            {view.map((it, i) => (
              <Pill key={it.roundId} value={it.finalMultiplier} isLatest={i === 0} />
            ))}
          </div>
        ) : (
          <>
            <div className="history-grid history-grid--expanded-r1">
              {view.slice(0, 8).map((it, i) => (
                <Pill key={it.roundId} value={it.finalMultiplier} isLatest={i === 0} />
              ))}
            </div>
            {view.length > 8 ? (
              <div className="history-grid history-grid--expanded-r2">
                {view.slice(8, 16).map((it) => (
                  <Pill key={it.roundId} value={it.finalMultiplier} tier="older" />
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
      <button
        type="button"
        className="history-expand"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse round history" : "Expand round history"}
      >
        <span className="history-expand__icon" aria-hidden>
          {expanded ? "−" : "+"}
        </span>
      </button>
    </div>
  );
}
