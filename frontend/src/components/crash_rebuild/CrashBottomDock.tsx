import type { MainActionKind } from './useCrashUiModel';

interface Props {
  chips: number[];
  selectionAmount: number;
  activeBetAmount: number | null;
  livePayout: number | null;
  phase: string;
  mainActionKind: MainActionKind;
  mainActionLabel: string;
  isPlacingBet: boolean;
  isCashingOut: boolean;
  onChipClick: (amount: number) => void;
  onClear: () => void;
  onMainAction: () => void;
}

function formatMoney(value: number | null): string {
  if (value === null) return '0';
  return Math.round(value).toLocaleString('en-US');
}

function isMainDisabled(kind: MainActionKind, isPending: boolean): boolean {
  return isPending || kind === 'bet_placed' || kind === 'cashed_out' || kind === 'locked';
}

export function CrashBottomDock(props: Props) {
  const chipsDisabled = props.phase === 'running' && props.activeBetAmount !== null;
  const isPending = props.isPlacingBet || props.isCashingOut;

  return (
    <section className="crash-bottom-dock">
      <div className="money-capsule">Selection: {formatMoney(props.selectionAmount)}</div>

      {props.activeBetAmount !== null && (
        <div className="bet-tray">
          <span>In Play: {formatMoney(props.activeBetAmount)}</span>
          {props.phase === 'running' && <span>Cashout Now: {formatMoney(props.livePayout)}</span>}
        </div>
      )}

      <div className="chip-row">
        {props.chips.map((chip) => (
          <button key={chip} onClick={() => props.onChipClick(chip)} disabled={chipsDisabled}>
            {chip >= 1000 ? `${chip / 1000}K` : chip}
          </button>
        ))}
        <button onClick={props.onClear} disabled={chipsDisabled}>
          CLR
        </button>
      </div>

      <button
        className="main-action"
        onClick={props.onMainAction}
        disabled={isMainDisabled(props.mainActionKind, isPending)}
      >
        {props.mainActionLabel || ' '}
      </button>
    </section>
  );
}
