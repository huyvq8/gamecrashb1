import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSocketClient } from "../../lib/socketClient";
import { apiClient } from "../../lib/apiClient";
import { runtimeConfig } from "../../config/runtimeConfig";
import type { ActiveRound, BetRecord, CrashHistoryResponse, CrashRealtimeEvent, CrashStateResponse, HistoryRound, RoundStatus } from "../../types/crash";

export type RoundPhase =
  | "prepare"
  | "betting_open"
  | "running"
  | "crashed"
  | "result"
  | "cooldown";

export interface HistoryItem {
  roundId: string;
  finalMultiplier: string | null;
}

export interface CrashUiModel {
  // Phases
  phase: RoundPhase;

  // A. RoundPhase provided as above
  // B. CountdownValue (seconds int) for prepare/betting_open/cooldown
  countdownValue: number | null;

  // C. LiveMultiplier for running only (e.g., "1.03")
  liveMultiplier: string | null;

  // D. BetSelectionAmount (chips prepared, not committed)
  selectionAmountMinor: string;

  // E. ActiveBetAmount (committed in current round)
  activeBetAmountMinor: string | null;
  // Placed bet for current round, even if later cashed out
  placedBetAmountMinor: string | null;
  placedBetStatus: "ACTIVE" | "CASHED_OUT" | "LOST" | "REJECTED" | null;

  // F. LivePayout = activeBetAmount * liveMultiplier (only when running and active bet)
  livePayoutMinor: string | null;

  // User balance
  balanceMinor: string;

  // G. History items, newest on the left
  history: HistoryItem[];
  historyExpanded: boolean;
  setHistoryExpanded(next: boolean): void;

  // Actions
  addChip(minor: string): void;
  clearSelection(): void;
  placeBet(): Promise<void>;
  cashOut(): Promise<void>;

  // Flags
  canPlaceBet: boolean;
  canCashOut: boolean;
  isLoading: boolean;
  error: string | null;
}

function nowMs(): number {
  return Date.now();
}

function toIntSecondsRemaining(targetIsoOrMs: string | number | null | undefined): number | null {
  if (!targetIsoOrMs) return null;
  const targetMs = typeof targetIsoOrMs === "string" ? Date.parse(targetIsoOrMs) : targetIsoOrMs;
  if (!Number.isFinite(targetMs)) return null;
  const diffMs = targetMs - nowMs();
  const remaining = Math.max(0, Math.ceil(diffMs / 1000));
  return remaining;
}

function formatMultiplierTick(raw: string | undefined | null): string | null {
  if (!raw) return null;
  // backend ticks like "1.012345" - keep two decimals for UI, never show stale/shared display
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(2);
}

function multiplyMinorAmount(amountMinor: string, multiplierString: string): string {
  // Use BigInt for minor units and scale by 100 to match 2 decimals
  const base = BigInt(amountMinor || "0");
  const m = Number(multiplierString);
  const scaled = Math.round(m * 100); // integer
  return ((base * BigInt(scaled)) / BigInt(100)).toString();
}

function mapRoundStatusToPhase(status: RoundStatus | null, hasActiveRound: boolean, countdownForBettingOpen: number | null, countdownForNextRound: number | null): RoundPhase {
  // Priority:
  // - If IN_PROGRESS -> running
  // - If CRASHED -> crashed
  // - If SETTLED -> result/cooldown depending on countdown to next start
  // - If BETTING_OPEN -> betting_open
  // - Else -> prepare
  if (status === "IN_PROGRESS") return "running";
  if (status === "CRASHED") return "crashed";
  if (status === "SETTLED") {
    // while waiting for next round, treat as cooldown/result
    return countdownForNextRound !== null && countdownForNextRound > 0 ? "cooldown" : "result";
  }
  if (status === "BETTING_OPEN") return "betting_open";
  return hasActiveRound ? "prepare" : "prepare";
}

export function useCrashUiModel(): CrashUiModel {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [balanceMinor, setBalanceMinor] = useState("0");
  const [activeRound, setActiveRound] = useState<ActiveRound | null>(null);
  const [roundStatus, setRoundStatus] = useState<RoundStatus | null>(null);

  const [betSelectionAmountMinor, setBetSelectionAmountMinor] = useState("0");
  const [activeBet, setActiveBet] = useState<BetRecord | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const [liveMultiplier, setLiveMultiplier] = useState<string | null>(null);

  const bettingCloseAtRef = useRef<number | null>(null);
  const nextRoundStartsAtRef = useRef<number | null>(null);
  const countdownTick = useRef<number | null>(null);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);

  const userId = runtimeConfig.demoUserId;

  const refreshBalance = useCallback(async () => {
    const r = await apiClient.getBalance(userId);
    setBalanceMinor(r.balanceMinor);
  }, [userId]);

  const refreshHistory = useCallback(async () => {
    const r: CrashHistoryResponse = await apiClient.getHistory();
    const items: HistoryItem[] = (r.rounds ?? [])
      .slice()
      .reverse() // newest first on the left
      .map((h: HistoryRound) => ({ roundId: h.roundId, finalMultiplier: h.crashMultiplier }));
    setHistory(items);
  }, []);

  const refreshState = useCallback(async () => {
    const state: CrashStateResponse = await apiClient.getState();
    setActiveRound(state.activeRound);
    const rs = state.activeRound?.status ?? null;
    setRoundStatus(rs);
  }, []);

  const startCountdownLoop = useCallback(() => {
    if (countdownTick.current !== null) {
      window.clearInterval(countdownTick.current);
      countdownTick.current = null;
    }
    countdownTick.current = window.setInterval(() => {
      const bettingRem = toIntSecondsRemaining(bettingCloseAtRef.current);
      const nextRem = toIntSecondsRemaining(nextRoundStartsAtRef.current);
      // prefer betting open countdown if in that window; else next round countdown
      if (bettingRem !== null && bettingRem > 0) {
        setCountdownValue(bettingRem);
      } else if (nextRem !== null && nextRem > 0) {
        setCountdownValue(nextRem);
      } else {
        setCountdownValue(0);
      }
    }, 250);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    (async () => {
      try {
        await Promise.all([refreshBalance(), refreshState(), refreshHistory()]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to initialize");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [refreshBalance, refreshHistory, refreshState]);

  useEffect(() => {
    const socket = createSocketClient();

    function onRoundCreated(evt: CrashRealtimeEvent) {
      // treat as prepare
      setRoundStatus("BETTING_OPEN");
    }
    function onBettingOpen(evt: CrashRealtimeEvent) {
      setRoundStatus("BETTING_OPEN");
      if (evt.bettingCloseAt) {
        bettingCloseAtRef.current = Date.parse(evt.bettingCloseAt);
      }
      startCountdownLoop();
    }
    function onRoundStarted(evt: CrashRealtimeEvent) {
      setRoundStatus("IN_PROGRESS");
      setLiveMultiplier(formatMultiplierTick("1.00"));
      bettingCloseAtRef.current = null;
    }
    function onTick(evt: CrashRealtimeEvent) {
      if (evt.multiplier) {
        setLiveMultiplier(formatMultiplierTick(evt.multiplier));
      }
    }
    function onCashoutAccepted(evt: CrashRealtimeEvent) {
      // refresh balance lazily; keep active bet status from response
      refreshBalance().catch(() => void 0);
    }
    function onRoundCrashed(evt: CrashRealtimeEvent) {
      setRoundStatus("CRASHED");
      if (evt.crashMultiplier) {
        setLiveMultiplier(formatMultiplierTick(evt.crashMultiplier));
      }
    }
    function onRoundSettled(evt: CrashRealtimeEvent) {
      setRoundStatus("SETTLED");
      // schedule next round countdown
      if (evt.nextRoundStartsAt) {
        nextRoundStartsAtRef.current = Date.parse(evt.nextRoundStartsAt);
        startCountdownLoop();
      } else {
        nextRoundStartsAtRef.current = null;
      }
      // clear any placed bet at settle (round end)
      setActiveBet(null);
      refreshHistory().catch(() => void 0);
    }
    function onConnect() {
      // on connect/reconnect, resync
      refreshState().catch(() => void 0);
      refreshBalance().catch(() => void 0);
      refreshHistory().catch(() => void 0);
    }
    function onReconnectError() {
      // keep UI alive, do nothing special
    }

    socket.on("ROUND_CREATED", onRoundCreated);
    socket.on("BETTING_OPEN", onBettingOpen);
    socket.on("ROUND_STARTED", onRoundStarted);
    socket.on("MULTIPLIER_TICK", onTick);
    socket.on("CASHOUT_ACCEPTED", onCashoutAccepted);
    socket.on("ROUND_CRASHED", onRoundCrashed);
    socket.on("ROUND_SETTLED", onRoundSettled);
    socket.on("connect", onConnect);
    socket.on("reconnect", onConnect);
    socket.on("reconnect_error", onReconnectError);
    socket.on("connect_error", onReconnectError);

    return () => {
      socket.off("ROUND_CREATED", onRoundCreated);
      socket.off("BETTING_OPEN", onBettingOpen);
      socket.off("ROUND_STARTED", onRoundStarted);
      socket.off("MULTIPLIER_TICK", onTick);
      socket.off("CASHOUT_ACCEPTED", onCashoutAccepted);
      socket.off("ROUND_CRASHED", onRoundCrashed);
      socket.off("ROUND_SETTLED", onRoundSettled);
      socket.off("connect", onConnect);
      socket.off("reconnect", onConnect);
      socket.off("reconnect_error", onReconnectError);
      socket.off("connect_error", onReconnectError);
      socket.close();
    };
  }, [refreshBalance, refreshHistory, refreshState, startCountdownLoop]);

  const phase: RoundPhase = useMemo(() => {
    const bettingRem = toIntSecondsRemaining(bettingCloseAtRef.current);
    const nextRem = toIntSecondsRemaining(nextRoundStartsAtRef.current);
    return mapRoundStatusToPhase(roundStatus, !!activeRound, bettingRem, nextRem);
  }, [roundStatus, activeRound]);

  const canPlaceBet = useMemo(() => {
    return phase === "betting_open" && betSelectionAmountMinor !== "0" && (!activeBet || activeBet.status !== "ACTIVE");
  }, [phase, betSelectionAmountMinor, activeBet]);

  const canCashOut = useMemo(() => {
    return phase === "running" && !!activeBet && activeBet.status === "ACTIVE";
  }, [phase, activeBet]);

  const livePayoutMinor = useMemo(() => {
    if (!(phase === "running" && activeBet && activeBet.status === "ACTIVE" && liveMultiplier)) {
      return null;
    }
    return multiplyMinorAmount(activeBet.amountMinor, liveMultiplier);
  }, [phase, activeBet, liveMultiplier]);

  const addChip = useCallback((minor: string) => {
    const a = BigInt(betSelectionAmountMinor || "0");
    const b = BigInt(minor);
    setBetSelectionAmountMinor((a + b).toString());
  }, [betSelectionAmountMinor]);

  const clearSelection = useCallback(() => {
    setBetSelectionAmountMinor("0");
  }, []);

  const placeBet = useCallback(async () => {
    if (!activeRound?.roundId) return;
    if (!canPlaceBet) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.placeBet({
        userId,
        roundId: activeRound.roundId,
        amountMinor: betSelectionAmountMinor
      });
      setActiveBet(res.bet);
      setBetSelectionAmountMinor("0");
      await refreshBalance();
      await refreshState();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Place bet failed");
    } finally {
      setIsLoading(false);
    }
  }, [activeRound, betSelectionAmountMinor, canPlaceBet, refreshBalance, refreshState, userId]);

  const cashOut = useCallback(async () => {
    if (!activeRound?.roundId) return;
    if (!canCashOut) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.cashout({ userId, roundId: activeRound.roundId });
      setActiveBet(res.bet);
      await refreshBalance();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cash out failed");
    } finally {
      setIsLoading(false);
    }
  }, [activeRound, canCashOut, refreshBalance, userId]);

  return {
    phase,
    countdownValue,
    liveMultiplier,
    selectionAmountMinor: betSelectionAmountMinor,
    activeBetAmountMinor: activeBet?.status === "ACTIVE" ? activeBet.amountMinor : null,
    placedBetAmountMinor: activeBet ? activeBet.amountMinor : null,
    placedBetStatus: activeBet ? activeBet.status : null,
    livePayoutMinor,
    balanceMinor,
    history,
    historyExpanded,
    setHistoryExpanded,
    addChip,
    clearSelection,
    placeBet,
    cashOut,
    canPlaceBet,
    canCashOut,
    isLoading,
    error
  };
}

