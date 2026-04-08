import React, { useMemo, useRef, useEffect } from "react";
import type { HistoryRound } from "../types/crash";
import { getMultiplierColor } from "../lib/multiplierColor";

function chipClass(multiplier: string | null): string {
  const v = Number(multiplier ?? "0");
  const hue = getMultiplierColor(v);
  return `mc-${hue}`;
}

function formatMultiplier(multiplier: string | null): string {
  if (!multiplier) return "n/a";
  const n = Number(multiplier);
  if (!Number.isFinite(n)) return multiplier;
  if (n >= 100) return `${Math.round(n)}`;
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

function highValue(rounds: HistoryRound[]): string {
  let max = 0;
  for (const r of rounds) {
    const v = Number(r.crashMultiplier ?? "0");
    if (Number.isFinite(v) && v > max) max = v;
  }
  return max > 0 ? `${formatMultiplier(max.toString())}x` : "-";
}

export function HistoryBar(props: {
  rounds: HistoryRound[];
  expanded: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  // newest first (leftmost)
  const latest16 = useMemo(() => props.rounds.slice(-16).reverse(), [props.rounds]);
  const recent4 = useMemo(() => props.rounds.slice(-4).reverse(), [props.rounds]);
  const next12 = useMemo(() => {
    const arr = props.rounds.slice(-16).reverse();
    return arr.slice(4, 16); // items after the first row
  }, [props.rounds]);
  const todayHighValue = useMemo(() => {
    let max = 0;
    for (const r of props.rounds) {
      const v = Number(r.crashMultiplier ?? "0");
      if (Number.isFinite(v) && v > max) max = v;
    }
    return max;
  }, [props.rounds]);
  const barRef = useRef<HTMLUListElement | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (barRef.current) barRef.current.scrollLeft = 0;
  }, [recent4]);

  // Measure the bottom of the first row in viewport and pin overlay just below it
  useEffect(() => {
    if (!props.expanded) return;
    const updateTop = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const top = Math.max(0, Math.round(rect.bottom + 6)); // 6px gap
      document.documentElement.style.setProperty("--history-overlay-top", `${top}px`);
    };
    updateTop();
    window.addEventListener("resize", updateTop);
    window.addEventListener("scroll", updateTop, { passive: true });
    return () => {
      window.removeEventListener("resize", updateTop);
      window.removeEventListener("scroll", updateTop);
    };
  }, [props.expanded]);

  return (
    <>
      <section className="history-bar" ref={containerRef as unknown as React.RefObject<HTMLDivElement>}>
        <div className={`today-high mc-${getMultiplierColor(todayHighValue)}`}>🔥 {highValue(props.rounds)}</div>
        <ul className="history-mini-row" data-testid="history-list" ref={barRef}>
          {recent4.map((r) => (
            <li className={`chip ${chipClass(r.crashMultiplier)}`} key={r.roundId}>
              {formatMultiplier(r.crashMultiplier)}x
            </li>
          ))}
        </ul>
        <button type="button" className="history-expand-btn" onClick={props.onToggle} aria-label="toggle-history">
          {props.expanded ? "×" : "▾"}
        </button>

        {/* Overlay panel pinned directly below row 1; does not cover row 1 */}
        <div className={`history-pop ${props.expanded ? "open" : ""}`} onClick={(e) => e.stopPropagation()}>
          <div className="history-overlay-grid grid-4x4">
            {next12.map((r) => (
              <div className={`history-cell ${chipClass(r.crashMultiplier)}`} key={`overlay-${r.roundId}`}>
                {formatMultiplier(r.crashMultiplier)}x
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

