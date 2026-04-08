import React from "react";
import "./crashV2.css";
import { useCrashViewModel } from "./useCrashViewModel";
import { CrashTopBarV2 } from "./CrashTopBarV2";
import { CrashHistoryBarV2 } from "./CrashHistoryBarV2";
import { CrashSceneV2 } from "./CrashSceneV2";
import { CrashBottomDockV2 } from "./CrashBottomDockV2";

function formatBalanceMinor(minor: string): string {
  const n = Number(minor) / 100;
  if (!isFinite(n)) return "0.00";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function CrashScreenV2() {
  const vm = useCrashViewModel();

  const handleMain = () => {
    if (vm.mainCtaLabel === "Cash Out") {
      vm.cashOut();
    } else {
      vm.placeBet();
    }
  };

  return (
    <div className="crash-v2-root">
      <CrashTopBarV2 balanceText={formatBalanceMinor(vm.balanceMinor)} live={vm.connection === "LIVE"} />
      <CrashHistoryBarV2 history={vm.history} />
      <CrashSceneV2 multiplier={vm.multiplier} phase={vm.phase} countdownSeconds={vm.countdownSeconds ?? null} />
      <CrashBottomDockV2
        amountMinor={vm.preparedAmountMinor}
        onAddChip={vm.addChip}
        onClear={vm.clearChips}
        mainLabel={vm.mainCtaLabel}
        mainEnabled={vm.mainCtaEnabled}
        onMain={handleMain}
        showBetTray={!!vm.bet}
        betAmountMinor={vm.bet?.amountMinor}
        isActiveBet={vm.isActiveBet}
        potentialPayoutMinor={vm.potentialPayoutMinor}
      />
    </div>
  );
}

