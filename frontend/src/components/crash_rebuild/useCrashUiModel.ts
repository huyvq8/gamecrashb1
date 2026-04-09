import { useCallback, useEffect, useMemo, useState } from 'react';
import { runtimeConfig } from '../../config/runtimeConfig';
import {
  cashOutCrash,
  fetchCrashHistory,
  fetchCrashState,
  fetchWalletBalance,
  placeCrashBet,
  type CrashHistoryItemDto,
  type CrashPhase,
} from '../../lib/apiClient';
import { createCrashSocket } from '../../lib/crashSocket';

export type MainActionKind = 'place_bet' | 'bet_placed' | 'cash_out' | 'cashed_out' | 'locked';

export interface CrashHistoryItem {
  value: number;
  display: string;
  tier: string;
}

const DEFAULT_CHIPS = [100, 200, 500, 1000, 5000, 10000];

function formatMultiplier(value: number | null): string | null {
  return typeof value === 'number' ? `${value.toFixed(2)}x` : null;
}

function formatMoney(value: number): string {
  return value.toLocaleString('en-US');
}

function toHistoryItem(item: CrashHistoryItemDto): CrashHistoryItem {
  const value = item.value || 1;
  const tier = value >= 10 ? 'high' : value >= 2 ? 'mid' : 'low';
  return { value, display: `${value.toFixed(2)}x`, tier };
}

function playAudioCue(cue: 'betting_open' | 'bet_placed' | 'round_started' | 'cashout' | 'round_crashed' | 'round_settled') {
  const pathByCue: Record<typeof cue, string> = {
    betting_open: '/audio/crash-betting-open.mp3',
    bet_placed: '/audio/crash-bet-placed.mp3',
    round_started: '/audio/crash-round-started.mp3',
    cashout: '/audio/crash-cashout.mp3',
    round_crashed: '/audio/crash-round-crashed.mp3',
    round_settled: '/audio/crash-round-settled.mp3',
  };

  const audio = new Audio(pathByCue[cue]);
  audio.volume = 0.45;
  void audio.play();
}

export function useCrashUiModel() {
  const [phase, setPhase] = useState<CrashPhase>('prepare');
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [liveMultiplier, setLiveMultiplier] = useState<number | null>(null);
  const [selectionAmount, setSelectionAmount] = useState(0);
  const [activeBetAmount, setActiveBetAmount] = useState<number | null>(null);
  const [hasPlacedBet, setHasPlacedBet] = useState(false);
  const [hasCashedOut, setHasCashedOut] = useState(false);
  const [historyItems, setHistoryItems] = useState<CrashHistoryItem[]>([]);
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [isCashingOut, setIsCashingOut] = useState(false);

  const hasActiveBet = activeBetAmount !== null;

  const refreshBalance = useCallback(async () => {
    const payload = await fetchWalletBalance(runtimeConfig.demoUserId);
    setBalance(payload.balance ?? 0);
  }, []);

  const refreshState = useCallback(async () => {
    const state = await fetchCrashState();
    setPhase(state.phase);
    setCountdownValue(state.countdownValue ?? null);
    setLiveMultiplier(state.liveMultiplier ?? null);
    setActiveBetAmount(state.activeBetAmount ?? null);
    setHasPlacedBet((state.activeBetAmount ?? 0) > 0);
    setHasCashedOut(Boolean(state.hasCashedOut));
  }, []);

  const refreshHistory = useCallback(async () => {
    const history = await fetchCrashHistory();
    setHistoryItems((history || []).map(toHistoryItem));
  }, []);

  useEffect(() => {
    let mounted = true;
    Promise.all([refreshBalance(), refreshState(), refreshHistory()]).catch((e) => {
      if (mounted) setError(e instanceof Error ? e.message : 'State sync failed');
    });
    return () => {
      mounted = false;
    };
  }, [refreshBalance, refreshHistory, refreshState]);

  useEffect(() => {
    const socket = createCrashSocket();

    const onRoundCreated = (payload?: any) => {
      setPhase('prepare');
      setCountdownValue(payload?.countdownValue ?? 10);
      setLiveMultiplier(null);
      setHasPlacedBet(false);
      setActiveBetAmount(null);
      setHasCashedOut(false);
      setIsPlacingBet(false);
      setIsCashingOut(false);
    };

    const onBettingOpen = (payload?: any) => {
      setPhase('betting_open');
      setCountdownValue(payload?.countdownValue ?? countdownValue ?? 10);
      playAudioCue('betting_open');
    };

    const onRoundStarted = (payload?: any) => {
      setPhase('running');
      setCountdownValue(null);
      setLiveMultiplier(payload?.multiplier ?? 1);
      playAudioCue('round_started');
    };

    const onMultiplierTick = (payload?: any) => {
      setPhase('running');
      setLiveMultiplier(payload?.multiplier ?? 1);
    };

    const onCashoutAccepted = () => {
      setHasCashedOut(true);
      setIsCashingOut(false);
      playAudioCue('cashout');
    };

    const onRoundCrashed = (payload?: any) => {
      setPhase('crashed');
      setLiveMultiplier(payload?.multiplier ?? liveMultiplier);
      playAudioCue('round_crashed');
    };

    const onRoundSettled = async () => {
      setPhase('result');
      setTimeout(() => setPhase('cooldown'), 700);
      setTimeout(() => setPhase('prepare'), 1600);
      setHasPlacedBet(false);
      setActiveBetAmount(null);
      setHasCashedOut(false);
      setSelectionAmount(0);
      setIsPlacingBet(false);
      setIsCashingOut(false);
      playAudioCue('round_settled');
      try {
        await Promise.all([refreshHistory(), refreshBalance()]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'State sync failed');
      }
    };

    const onReconnect = async () => {
      try {
        await Promise.all([refreshState(), refreshHistory(), refreshBalance()]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'State sync failed');
      }
    };

    socket.on('ROUND_CREATED', onRoundCreated);
    socket.on('BETTING_OPEN', onBettingOpen);
    socket.on('ROUND_STARTED', onRoundStarted);
    socket.on('MULTIPLIER_TICK', onMultiplierTick);
    socket.on('CASHOUT_ACCEPTED', onCashoutAccepted);
    socket.on('ROUND_CRASHED', onRoundCrashed);
    socket.on('ROUND_SETTLED', onRoundSettled);
    socket.on('connect', onReconnect);
    socket.on('reconnect', onReconnect);

    return () => {
      socket.off('ROUND_CREATED', onRoundCreated);
      socket.off('BETTING_OPEN', onBettingOpen);
      socket.off('ROUND_STARTED', onRoundStarted);
      socket.off('MULTIPLIER_TICK', onMultiplierTick);
      socket.off('CASHOUT_ACCEPTED', onCashoutAccepted);
      socket.off('ROUND_CRASHED', onRoundCrashed);
      socket.off('ROUND_SETTLED', onRoundSettled);
      socket.off('connect', onReconnect);
      socket.off('reconnect', onReconnect);
      socket.disconnect();
    };
  }, [countdownValue, liveMultiplier, refreshBalance, refreshHistory, refreshState]);

  const addSelectionAmount = useCallback((value: number) => {
    setSelectionAmount((prev) => prev + value);
  }, []);

  const clearSelectionAmount = useCallback(() => {
    setSelectionAmount(0);
  }, []);

  const placeBet = useCallback(async () => {
    if (phase !== 'betting_open' || selectionAmount <= 0 || hasActiveBet || isPlacingBet) return;

    try {
      setIsPlacingBet(true);
      setError(null);
      const payload = await placeCrashBet(selectionAmount);
      const betAmount = payload.amount ?? selectionAmount;
      setActiveBetAmount(betAmount);
      setHasPlacedBet(true);
      setHasCashedOut(false);
      playAudioCue('bet_placed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Place bet failed');
    } finally {
      setIsPlacingBet(false);
    }
  }, [hasActiveBet, isPlacingBet, phase, selectionAmount]);

  const cashOut = useCallback(async () => {
    if (phase !== 'running' || !hasActiveBet || hasCashedOut || isCashingOut) return;

    try {
      setIsCashingOut(true);
      setError(null);
      await cashOutCrash();
      setHasCashedOut(true);
      await refreshBalance();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cash out failed');
    } finally {
      setIsCashingOut(false);
    }
  }, [hasActiveBet, hasCashedOut, isCashingOut, phase, refreshBalance]);

  const toggleHistoryExpanded = useCallback(() => {
    setHistoryExpanded((prev) => !prev);
  }, []);

  const livePayout = useMemo(() => {
    if (!hasActiveBet || hasCashedOut || phase !== 'running' || !liveMultiplier) return null;
    return (activeBetAmount ?? 0) * liveMultiplier;
  }, [activeBetAmount, hasActiveBet, hasCashedOut, liveMultiplier, phase]);

  const canPlaceBet = phase === 'betting_open' && selectionAmount > 0 && !hasActiveBet && !isPlacingBet;
  const canCashOut = phase === 'running' && hasActiveBet && !hasCashedOut && !isCashingOut;

  const mainActionKind: MainActionKind = useMemo(() => {
    if (canPlaceBet) return 'place_bet';
    if (phase === 'betting_open' && hasPlacedBet && hasActiveBet) return 'bet_placed';
    if (canCashOut) return 'cash_out';
    if (hasCashedOut) return 'cashed_out';
    return 'locked';
  }, [canCashOut, canPlaceBet, hasActiveBet, hasCashedOut, hasPlacedBet, phase]);

  const mainActionLabel = useMemo(() => {
    if (mainActionKind === 'place_bet') return 'Place Bet';
    if (mainActionKind === 'bet_placed') return 'Bet Placed';
    if (mainActionKind === 'cash_out') {
      return `Cash Out ${formatMoney(Math.round(livePayout ?? 0))}`;
    }
    if (mainActionKind === 'cashed_out') return 'Cashed Out';
    return '';
  }, [livePayout, mainActionKind]);

  return {
    chips: DEFAULT_CHIPS,
    phase,
    countdownValue,
    liveMultiplier,
    multiplierDisplay: formatMultiplier(liveMultiplier),
    selectionAmount,
    activeBetAmount,
    hasPlacedBet,
    hasActiveBet,
    hasCashedOut,
    isPlacingBet,
    isCashingOut,
    livePayout,
    historyItems: historyExpanded ? historyItems.slice(0, 16) : historyItems.slice(0, 4),
    canPlaceBet,
    canCashOut,
    mainActionKind,
    mainActionLabel,
    balance,
    error,
    historyExpanded,
    addSelectionAmount,
    clearSelectionAmount,
    placeBet,
    cashOut,
    toggleHistoryExpanded,
  };
}
