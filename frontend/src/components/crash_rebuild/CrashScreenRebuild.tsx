import { useCallback } from 'react';
import { CrashBottomDock } from './CrashBottomDock';
import { CrashCenterDisplay } from './CrashCenterDisplay';
import { CrashHistory } from './CrashHistory';
import { CrashScene } from './CrashScene';
import { CrashTopBar } from './CrashTopBar';
import { useCrashUiModel } from './useCrashUiModel';

export function CrashScreenRebuild() {
  const model = useCrashUiModel();

  const onMainAction = useCallback(() => {
    if (model.mainActionKind === 'place_bet') {
      void model.placeBet();
      return;
    }

    if (model.mainActionKind === 'cash_out') {
      void model.cashOut();
    }
  }, [model]);

  return (
    <main className="crash-screen-rebuild">
      <CrashTopBar balance={model.balance} />

      {model.error && <div className="crash-error">{model.error}</div>}

      <CrashHistory
        items={model.historyItems}
        expanded={model.historyExpanded}
        onToggleExpanded={model.toggleHistoryExpanded}
      />

      <section className="crash-center-wrap">
        <CrashScene />
        <CrashCenterDisplay
          phase={model.phase}
          countdownValue={model.countdownValue}
          multiplierDisplay={model.multiplierDisplay}
        />
      </section>

      <CrashBottomDock
        chips={model.chips}
        selectionAmount={model.selectionAmount}
        activeBetAmount={model.activeBetAmount}
        livePayout={model.livePayout}
        phase={model.phase}
        mainActionKind={model.mainActionKind}
        mainActionLabel={model.mainActionLabel}
        isPlacingBet={model.isPlacingBet}
        isCashingOut={model.isCashingOut}
        onChipClick={model.addSelectionAmount}
        onClear={model.clearSelectionAmount}
        onMainAction={onMainAction}
      />
    </main>
  );
}
