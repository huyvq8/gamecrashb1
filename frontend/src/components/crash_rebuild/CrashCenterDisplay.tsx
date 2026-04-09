import type { CrashPhase } from '../../lib/apiClient';

interface Props {
  phase: CrashPhase;
  countdownValue: number | null;
  multiplierDisplay: string | null;
}

export function CrashCenterDisplay({ phase, countdownValue, multiplierDisplay }: Props) {
  const isCountdownMode = phase === 'prepare' || phase === 'betting_open' || phase === 'cooldown';

  if (isCountdownMode) {
    return <div className="crash-center crash-countdown">{Math.max(0, Math.floor(countdownValue ?? 0))}</div>;
  }

  if (phase === 'running') {
    return <div className="crash-center crash-multiplier">{multiplierDisplay ?? '1.00x'}</div>;
  }

  return <div className="crash-center crash-multiplier">{multiplierDisplay ?? '—'}</div>;
}
