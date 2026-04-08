import React from "react";
import { useCrashUiModel } from "./useCrashUiModel";
import { CrashTopBar } from "./CrashTopBar";
import { CrashScene } from "./CrashScene";
import { CrashCenterDisplay } from "./CrashCenterDisplay";
import { CrashBottomDock } from "./CrashBottomDock";
import "./crashRebuild.css";

export function CrashScreenRebuild() {
  const ui = useCrashUiModel();

  return (
    <div className="crash-root">
      <div className="crash-top">
        <CrashTopBar
          balanceMinor={ui.balanceMinor}
          history={ui.history}
          historyExpanded={ui.historyExpanded}
          setHistoryExpanded={ui.setHistoryExpanded}
        />
      </div>

      <div className="crash-center">
        <CrashScene phase={ui.phase} />
        <div className="crash-center-overlay">
          <CrashCenterDisplay
            phase={ui.phase}
            countdownValue={ui.countdownValue}
            liveMultiplier={ui.liveMultiplier}
          />
        </div>
      </div>

      <div className="crash-bottom">
        <CrashBottomDock
          phase={ui.phase}
          selectionAmountMinor={ui.selectionAmountMinor}
          activeBetAmountMinor={ui.activeBetAmountMinor}
          placedBetAmountMinor={ui.placedBetAmountMinor}
          placedBetStatus={ui.placedBetStatus}
          livePayoutMinor={ui.livePayoutMinor}
          canPlaceBet={ui.canPlaceBet}
          canCashOut={ui.canCashOut}
          isLoading={ui.isLoading}
          onAddChip={ui.addChip}
          onClear={ui.clearSelection}
          onPlaceBet={ui.placeBet}
          onCashOut={ui.cashOut}
        />
      </div>
    </div>
  );
}

