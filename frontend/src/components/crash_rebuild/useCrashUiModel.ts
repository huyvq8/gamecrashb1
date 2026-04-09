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

export type RoundOutcome = null | { kind: "win"; payoutMinor: string | null } | { kind: "lose" };

export interface HistoryItem {
  roundId: string;
  finalMultiplier: string | null;
}

export type CrashToastKind = "error" | "success" | "info";

/** Canonical cashout result for UI reward sequence (balance from same GET as post-cashout). */
export type CashoutResult =
  | { ok: true; payoutMinor: string; balanceBeforeMinor: string; balanceAfterMinor: string }
  | { ok: false };

export interface CrashToastPayload {
  kind: CrashToastKind;
  message: string;
}

/** Optional UI sounds + floating toasts (wired from screen). */
export interface CrashUiSoundHooks {
  onChip?: () => void;
  onBetPlaced?: () => void;
  onCashOut?: () => void;
  onError?: () => void;
  /** Transient messages (errors, confirmations); must not use inline layout. */
  onToast?: (payload: CrashToastPayload) => void;
}

export interface CrashUiModel {
  phase: RoundPhase;
  /** Raw server status for round audio (BETTING_OPEN / IN_PROGRESS / …). */
  roundStatus: RoundStatus | null;
  countdownValue: number | null;
  liveMultiplier: string | null;
  selectionAmountMinor: string;
  activeBetAmountMinor: string | null;
  placedBetAmountMinor: string | null;
  placedBetStatus: "ACTIVE" | "CASHED_OUT" | "LOST" | "REJECTED" | null;
  livePayoutMinor: string | null;
  balanceMinor: string;
  history: HistoryItem[];
  historyExpanded: boolean;
  setHistoryExpanded(next: boolean): void;
  toggleHistoryExpanded(): void;
  /** Brief win/lose line after round; cleared when the next round opens for betting. */
  roundOutcome: RoundOutcome;
  addChip(minor: string): void;
  clearSelection(): void;
  placeBet(): Promise<void>;
  cashOut(): Promise<CashoutResult>;
  canPlaceBet: boolean;
  /** True when user has an ACTIVE bet and selected stake differs (betting_open only). */
  canReplaceBet: boolean;
  canCashOut: boolean;
  isLoading: boolean;
  depositBusy: boolean;
  deposit(): Promise<void>;
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
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(2);
}

function multiplyMinorAmount(amountMinor: string, multiplierString: string): string {
  const base = BigInt(amountMinor || "0");
  const m = Number(multiplierString);
  const scaled = Math.round(m * 100);
  return ((base * BigInt(scaled)) / BigInt(100)).toString();
}

function mapRoundStatusToPhase(
  status: RoundStatus | null,
  hasActiveRound: boolean,
  countdownForBettingOpen: number | null,
  countdownForNextRound: number | null
): RoundPhase {
  if (status === "IN_PROGRESS") return "running";
  if (status === "CRASHED") return "crashed";
  if (status === "SETTLED") {
    return countdownForNextRound !== null && countdownForNextRound > 0 ? "cooldown" : "result";
  }
  if (status === "BETTING_OPEN") return "betting_open";
  return hasActiveRound ? "prepare" : "prepare";
}

function hasCommittedBetForRound(bet: BetRecord | null, roundId: string | undefined): boolean {
  if (!bet || !roundId || bet.roundId !== roundId) return false;
  return bet.status === "ACTIVE" || bet.status === "CASHED_OUT" || bet.status === "LOST";
}

/**
 * Backend `CrashHistoryStore` stores with `unshift` → API `rounds[0]` is newest.
 * We still dedupe + sort by `roundId` (`round_${Date.now()}_${seq}`) so UI is newest-left even if order drifts.
 */
function historyRoundSortKey(roundId: string): bigint {
  const m = /^round_(\d+)_(\d+)$/.exec(roundId);
  if (!m) return 0n;
  return BigInt(m[1]) * 1_000_000n + BigInt(m[2]);
}

/** Newest-first, unique roundIds. CrashHistory must only `slice` this list — never re-sort in the view. */
function normalizeHistoryRounds(rounds: HistoryRound[]): HistoryItem[] {
  const seen = new Set<string>();
  const acc: HistoryItem[] = [];
  for (const h of rounds) {
    if (!h.roundId || seen.has(h.roundId)) continue;
    seen.add(h.roundId);
    acc.push({ roundId: h.roundId, finalMultiplier: h.crashMultiplier });
  }
  acc.sort((a, b) => {
    const d = historyRoundSortKey(b.roundId) - historyRoundSortKey(a.roundId);
    if (d > 0n) return 1;
    if (d < 0n) return -1;
    return 0;
  });
  return acc;
}

export function useCrashUiModel(sound?: CrashUiSoundHooks | null): CrashUiModel {
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const [isLoading, setIsLoading] = useState(false);
  const [depositBusy, setDepositBusy] = useState(false);

  const [balanceMinor, setBalanceMinor] = useState("0");
  const balanceMinorRef = useRef("0");
  useEffect(() => {
    balanceMinorRef.current = balanceMinor;
  }, [balanceMinor]);
  const [activeRound, setActiveRound] = useState<ActiveRound | null>(null);
  const [roundStatus, setRoundStatus] = useState<RoundStatus | null>(null);
  const roundStatusRef = useRef<RoundStatus | null>(null);
  useEffect(() => {
    roundStatusRef.current = roundStatus;
  }, [roundStatus]);

  const [betSelectionAmountMinor, setBetSelectionAmountMinor] = useState("0");
  const [activeBet, setActiveBet] = useState<BetRecord | null>(null);
  const activeBetRef = useRef<BetRecord | null>(null);
  useEffect(() => {
    activeBetRef.current = activeBet;
  }, [activeBet]);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const [liveMultiplier, setLiveMultiplier] = useState<string | null>(null);
  const [roundOutcome, setRoundOutcome] = useState<RoundOutcome>(null);

  const bettingCloseAtRef = useRef<number | null>(null);
  const nextRoundStartsAtRef = useRef<number | null>(null);
  const countdownTick = useRef<number | null>(null);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  /** Blocks double-submit before React re-renders `isLoading` (avoids duplicate replace → 409). */
  const placeBetInFlightRef = useRef(false);

  const userId = runtimeConfig.demoUserId;

  const refreshBalance = useCallback(async () => {
    const r = await apiClient.getBalance(userId);
    setBalanceMinor(r.balanceMinor);
  }, [userId]);

  const refreshHistory = useCallback(async () => {
    try {
      const r: CrashHistoryResponse = await apiClient.getHistory();
      setHistory(normalizeHistoryRounds(r.rounds ?? []));
    } catch {
      /* keep previous history on transient failures */
    }
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
    (async () => {
      try {
        await Promise.all([refreshBalance(), refreshState(), refreshHistory()]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to initialize";
        soundRef.current?.onToast?.({ kind: "error", message: msg });
        soundRef.current?.onError?.();
      } finally {
        setIsLoading(false);
      }
    })();
  }, [refreshBalance, refreshHistory, refreshState]);

  useEffect(() => {
    const socket = createSocketClient();

    function onRoundCreated(_evt: CrashRealtimeEvent) {
      void refreshState();
    }
    function onBettingOpen(evt: CrashRealtimeEvent) {
      setRoundOutcome(null);
      setLiveMultiplier(null);
      nextRoundStartsAtRef.current = null;
      roundStatusRef.current = "BETTING_OPEN";
      setRoundStatus("BETTING_OPEN");
      if (evt.bettingCloseAt) {
        bettingCloseAtRef.current = Date.parse(evt.bettingCloseAt);
      }
      startCountdownLoop();
      void refreshState();
    }
    function onRoundStarted(evt: CrashRealtimeEvent) {
      roundStatusRef.current = "IN_PROGRESS";
      setRoundStatus("IN_PROGRESS");
      setLiveMultiplier(formatMultiplierTick("1.00"));
      bettingCloseAtRef.current = null;
      void refreshState();
    }
    function onTick(evt: CrashRealtimeEvent) {
      if (evt.multiplier) {
        setLiveMultiplier(formatMultiplierTick(evt.multiplier));
      }
    }
    function onCashoutAccepted(evt: CrashRealtimeEvent) {
      if (evt.userId === userId) {
        setRoundOutcome({ kind: "win", payoutMinor: evt.payoutAmountMinor ?? null });
      }
      void refreshBalance();
      void refreshState();
    }
    function onRoundCrashed(evt: CrashRealtimeEvent) {
      roundStatusRef.current = "CRASHED";
      setRoundStatus("CRASHED");
      if (evt.crashMultiplier) {
        setLiveMultiplier(formatMultiplierTick(evt.crashMultiplier));
      }
      const bet = activeBetRef.current;
      if (bet?.status === "ACTIVE") {
        setRoundOutcome({ kind: "lose" });
      }
      void refreshState();
    }
    function onRoundSettled(evt: CrashRealtimeEvent) {
      roundStatusRef.current = "SETTLED";
      setRoundStatus("SETTLED");
      if (evt.nextRoundStartsAt) {
        nextRoundStartsAtRef.current = Date.parse(evt.nextRoundStartsAt);
        startCountdownLoop();
      } else {
        nextRoundStartsAtRef.current = null;
      }
      setActiveBet(null);
      /* Was synced to placed stake after place/replace; must clear or UI shows last round as "next" amount. */
      setBetSelectionAmountMinor("0");
      if (evt.roundId && evt.crashMultiplier != null) {
        setHistory((prev) =>
          normalizeHistoryRounds([
            { roundId: evt.roundId!, crashMultiplier: evt.crashMultiplier!, status: "SETTLED" },
            ...prev
              .filter((x) => x.roundId !== evt.roundId)
              .map(
                (x): HistoryRound => ({
                  roundId: x.roundId,
                  crashMultiplier: x.finalMultiplier,
                  status: "SETTLED"
                })
              )
          ])
        );
      }
      void refreshHistory();
      void refreshState();
    }
    function onConnect() {
      void refreshState();
      void refreshBalance();
      void refreshHistory();
    }
    function onReconnectError() {
      // keep UI alive
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
  }, [refreshBalance, refreshHistory, refreshState, startCountdownLoop, userId]);

  const bettingRem = toIntSecondsRemaining(bettingCloseAtRef.current);
  const nextRem = toIntSecondsRemaining(nextRoundStartsAtRef.current);
  const phase = mapRoundStatusToPhase(roundStatus, !!activeRound, bettingRem, nextRem);

  const committedThisRound = hasCommittedBetForRound(activeBet, activeRound?.roundId);
  const committedActiveThisRound =
    !!activeBet &&
    activeBet.roundId === activeRound?.roundId &&
    activeBet.status === "ACTIVE";

  const canPlaceBet =
    phase === "betting_open" && betSelectionAmountMinor !== "0" && !committedThisRound;

  const canReplaceBet =
    phase === "betting_open" &&
    committedActiveThisRound &&
    activeBet != null &&
    betSelectionAmountMinor !== "0" &&
    betSelectionAmountMinor !== activeBet.amountMinor;

  const canCashOut = useMemo(() => {
    return phase === "running" && !!activeBet && activeBet.status === "ACTIVE";
  }, [phase, activeBet]);

  const livePayoutMinor = useMemo(() => {
    if (!(phase === "running" && activeBet && activeBet.status === "ACTIVE" && liveMultiplier)) {
      return null;
    }
    return multiplyMinorAmount(activeBet.amountMinor, liveMultiplier);
  }, [phase, activeBet, liveMultiplier]);

  const toggleHistoryExpanded = useCallback(() => {
    setHistoryExpanded((v) => !v);
  }, []);

  const addChip = useCallback((chipDisplayAmount: string) => {
    soundRef.current?.onChip?.();
    const scale = BigInt(runtimeConfig.minorUnitsPerDisplay);
    const a = BigInt(betSelectionAmountMinor || "0");
    const delta = BigInt(chipDisplayAmount) * scale;
    setBetSelectionAmountMinor((a + delta).toString());
  }, [betSelectionAmountMinor]);

  const clearSelection = useCallback(() => {
    soundRef.current?.onChip?.();
    setBetSelectionAmountMinor("0");
  }, []);

  const placeBet = useCallback(async () => {
    if (!activeRound?.roundId) return;
    if (!canReplaceBet && !canPlaceBet) return;
    if (placeBetInFlightRef.current) return;
    placeBetInFlightRef.current = true;
    setIsLoading(true);
    const useReplace = canReplaceBet;
    try {
      if (roundStatusRef.current !== "BETTING_OPEN") {
        soundRef.current?.onToast?.({ kind: "error", message: "Betting window closed" });
        return;
      }
      const res = useReplace
        ? await apiClient.replaceBet({
            userId,
            roundId: activeRound.roundId,
            amountMinor: betSelectionAmountMinor
          })
        : await apiClient.placeBet({
            userId,
            roundId: activeRound.roundId,
            amountMinor: betSelectionAmountMinor
          });
      setActiveBet(res.bet);
      setBetSelectionAmountMinor(res.bet.amountMinor);
      soundRef.current?.onBetPlaced?.();
      soundRef.current?.onToast?.({
        kind: "success",
        message: useReplace ? "Bet updated" : "Bet placed"
      });
      await refreshBalance();
      await refreshState();
    } catch (e) {
      const msg = e instanceof Error ? e.message : useReplace ? "Update bet failed" : "Place bet failed";
      soundRef.current?.onToast?.({ kind: "error", message: msg });
      soundRef.current?.onError?.();
    } finally {
      placeBetInFlightRef.current = false;
      setIsLoading(false);
    }
  }, [activeRound, betSelectionAmountMinor, canPlaceBet, canReplaceBet, refreshBalance, refreshState, userId]);

  const cashOut = useCallback(async (): Promise<CashoutResult> => {
    if (!activeRound?.roundId) return { ok: false };
    if (!canCashOut) return { ok: false };
    const balanceBeforeMinor = balanceMinorRef.current;
    setIsLoading(true);
    try {
      const res = await apiClient.cashout({ userId, roundId: activeRound.roundId });
      const payoutMinor = res.bet.payoutAmountMinor ?? "0";
      setActiveBet(res.bet);
      setRoundOutcome({ kind: "win", payoutMinor: res.bet.payoutAmountMinor ?? null });
      const balRes = await apiClient.getBalance(userId);
      const balanceAfterMinor = balRes.balanceMinor;
      setBalanceMinor(balanceAfterMinor);
      balanceMinorRef.current = balanceAfterMinor;
      return { ok: true, payoutMinor, balanceBeforeMinor, balanceAfterMinor };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Cash out failed";
      soundRef.current?.onToast?.({ kind: "error", message: msg });
      soundRef.current?.onError?.();
      return { ok: false };
    } finally {
      setIsLoading(false);
    }
  }, [activeRound, canCashOut, userId]);

  const deposit = useCallback(async () => {
    if (depositBusy) return;
    const scale = BigInt(runtimeConfig.minorUnitsPerDisplay);
    const addDisplay = BigInt(runtimeConfig.depositDisplayUnits);
    const amountMinor = (addDisplay * scale).toString();
    const clientRequestId = `dep_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    setDepositBusy(true);
    try {
      await apiClient.deposit({ userId, amountMinor, clientRequestId });
      await refreshBalance();
      const displayStr = Number(runtimeConfig.depositDisplayUnits).toLocaleString("en-US");
      soundRef.current?.onToast?.({ kind: "success", message: `Deposited +$${displayStr}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Deposit failed";
      soundRef.current?.onToast?.({ kind: "error", message: msg });
      soundRef.current?.onError?.();
    } finally {
      setDepositBusy(false);
    }
  }, [depositBusy, refreshBalance, userId]);

  return {
    phase,
    roundStatus,
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
    toggleHistoryExpanded,
    roundOutcome,
    addChip,
    clearSelection,
    placeBet,
    cashOut,
    canPlaceBet,
    canReplaceBet,
    canCashOut,
    isLoading,
    depositBusy,
    deposit
  };
}
