import React from "react";
import type { HistoryItem } from "./useCrashUiModel";
import { CrashHistory } from "./CrashHistory";

export function CrashTopBar(props: {
  balanceMinor: string;
  history: HistoryItem[];
  historyExpanded: boolean;
  setHistoryExpanded: (v: boolean) => void;
}) {
  const { balanceMinor, history, historyExpanded, setHistoryExpanded } = props;
  return (
    <div className="crash-topbar">
      <div className="crash-topbar-header">
        <div className="crash-title">CRASH</div>
        <div className="crash-live-badge">LIVE</div>
        <div className="crash-balance">{Number(balanceMinor) / 100}</div>
      </div>
      <CrashHistory
        items={history}
        expanded={historyExpanded}
        onToggle={() => setHistoryExpanded(!historyExpanded)}
      />
    </div>
  );
}

