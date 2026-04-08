import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSocketClient } from "../../lib/socketClient";
import { apiClient } from "../../lib/apiClient";
import { runtimeConfig } from "../../config/runtimeConfig";
import type { ActiveRound, BetRecord, CrashRealtimeEvent, HistoryRound, RoundStatus } from "../../types/crash";

export type RoundPhase = "IDLE" | "BETTING_OPEN" | "IN_PROGRESS" | "CRASHED" | "SETTLED";

export interface CrashViewModel {
  // primitives
  connection: "LIVE" | "OFFLINE";
  balanceMinor: string;
  multiplier: string;
  round: ActiveRound | null;
  history: HistoryRound[];
  bet: BetRecord | null;
  preparedAmountMinor: string;
  isSubmitting: boolean;
  countdownLabel: "Betting ends in" | "Next round in" | null;
  countdownSeconds: number | null;

  // derived
  phase: RoundPhase;
  isBettingOpen: boolean;
  isRoundRunning: boolean;
  hasActiveBet: boolean;
  mainCtaLabel: "Place Bet" | "Cash Out";
  mainCtaEnabled: boolean;
  isActiveBet: boolean;
  potentialPayoutMinor: string | null;
  phaseHint: string | null;

  // actions
  addChip: (minor: string) => void;
  clearChips: () => void;
  placeBet: () => Promise<void>;
  cashOut: () => Promise<void>;
}

export function useCrashViewModel(): CrashViewModel {
  const [connection, setConnection] = useState<"LIVE" | "OFFLINE">("OFFLINE");
  const [balanceMinor, setBalanceMinor] = useState("0");
  const [round, setRound] = useState<ActiveRound | null>(null);
  const [multiplier, setMultiplier] = useState("1.000000");
  const [preparedAmountMinor, setPreparedAmountMinor] = useState("0");
  const [bet, setBet] = useState<BetRecord | null>(null);
  const [history, setHistory] = useState<HistoryRound[]>([]);
  const reconnectingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const phase: RoundPhase = useMemo<RoundPhase>(() => {
    if (!round) return "IDLE";
    return round.status;
  }, [round]);

  const isBettingOpen = phase === "BETTING_OPEN";
  const isRoundRunning = phase === "IN_PROGRESS";
  const hasActiveBet = !!bet && bet.status === "ACTIVE";

  const mainCtaLabel: CrashViewModel["mainCtaLabel"] = hasActiveBet && isRoundRunning ? "Cash Out" : "Place Bet";
  const mainCtaEnabled: boolean =
    !isSubmitting && (
      (mainCtaLabel === "Place Bet" && isBettingOpen && preparedAmountMinor !== "0") ||
      (mainCtaLabel === "Cash Out" && hasActiveBet && isRoundRunning)
    );

  // Potential payout while running: amount * multiplier
  const potentialPayoutMinor: string | null = useMemo(() => {
    if (!hasActiveBet || !isRoundRunning || !bet?.amountMinor) return null;
    const amt = Number(bet.amountMinor);
    const m = Number(multiplier);
    if (!isFinite(amt) || !isFinite(m)) return null;
    return Math.floor(amt * m).toString();
  }, [bet?.amountMinor, hasActiveBet, isRoundRunning, multiplier]);

  // Server-driven countdown
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  const [countdownLabel, setCountdownLabel] = useState<CrashViewModel["countdownLabel"]>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);

  const refreshState = useCallback(async () => {
    const [state, bal, hist] = await Promise.all([
      apiClient.getState(),
      apiClient.getBalance(runtimeConfig.demoUserId),
      apiClient.getHistory()
    ]);
    setRound(state.activeRound);
    setBalanceMinor(bal.balanceMinor);
    setHistory((hist as any).rounds ?? []);
  }, []);

  // Chips
  const addChip = useCallback((minor: string) => {
    const current = BigInt(preparedAmountMinor || "0");
    const add = BigInt(minor);
    setPreparedAmountMinor((current + add).toString());
  }, [preparedAmountMinor]);

  const clearChips = useCallback(() => {
    setPreparedAmountMinor("0");
  }, []);

  // Actions
  const placeBet = useCallback(async () => {
    if (!round?.roundId) return;
    if (!isBettingOpen) return;
    if (preparedAmountMinor === "0") return;
    try {
      setIsSubmitting(true);
      const response = await apiClient.placeBet({
        userId: runtimeConfig.demoUserId,
        roundId: round.roundId,
        amountMinor: preparedAmountMinor
      });
      setBet(response.bet);
      setPreparedAmountMinor("0");
    } catch {
      // ignore; server enforces window/timing; just sync state
    } finally {
      setIsSubmitting(false);
      await refreshState().catch(() => {});
    }
  }, [isBettingOpen, preparedAmountMinor, refreshState, round?.roundId]);

  const cashOut = useCallback(async () => {
    if (!round?.roundId) return;
    if (!hasActiveBet || !isRoundRunning) return;
    try {
      setIsSubmitting(true);
      const response = await apiClient.cashout({
        userId: runtimeConfig.demoUserId,
        roundId: round.roundId
      });
      setBet(response.bet);
    } catch {
      // ignore and sync
    } finally {
      setIsSubmitting(false);
      await refreshState().catch(() => {});
    }
  }, [hasActiveBet, isRoundRunning, refreshState, round?.roundId]);

  // Realtime
  useEffect(() => {
    let mounted = true;
    const socket = createSocketClient();
    const setLive = () => mounted && setConnection("LIVE");
    const setOffline = () => mounted && setConnection("OFFLINE");
    socket.on("connect", setLive);
    socket.on("reconnect", setLive);
    socket.on("connect_error", setOffline);
    socket.on("reconnect_error", setOffline);

    const onEvent = (evt: CrashRealtimeEvent) => {
      if (!mounted) return;
      if (typeof evt.multiplier === "string") {
        setMultiplier(evt.multiplier);
      }
      if (evt.type === "ROUND_CREATED" || evt.type === "BETTING_OPEN" || evt.type === "ROUND_STARTED" || evt.type === "ROUND_CRASHED" || evt.type === "ROUND_SETTLED") {
        // Lazy refresh to avoid leaking backend details
        refreshState().catch(() => {});
      }
      if (evt.type === "CASHOUT_ACCEPTED" && evt.bet) {
        setBet(evt.bet);
      }
      if (evt.bettingCloseAt) {
        const t = Date.parse(evt.bettingCloseAt);
        if (!Number.isNaN(t)) {
          setDeadlineMs(t);
          setCountdownLabel("Betting ends in");
        }
      } else if (evt.nextRoundStartsAt) {
        const t = Date.parse(evt.nextRoundStartsAt);
        if (!Number.isNaN(t)) {
          setDeadlineMs(t);
          setCountdownLabel("Next round in");
        }
      }
    };

    socket.onAny((_evt, payload) => onEvent(payload as CrashRealtimeEvent));

    (async () => {
      try {
        await refreshState();
        setConnection("LIVE");
      } catch {
        setConnection("OFFLINE");
      }
    })();

    return () => {
      mounted = false;
      socket.disconnect();
    };
  }, [refreshState]);

  // Handle reconnect throttle
  useEffect(() => {
    if (connection === "OFFLINE" && !reconnectingRef.current) {
      reconnectingRef.current = true;
      const id = setTimeout(() => {
        reconnectingRef.current = false;
        refreshState().catch(() => {});
      }, 1500);
      return () => clearTimeout(id);
    }
  }, [connection, refreshState]);

  useEffect(() => {
    if (!deadlineMs) {
      setCountdownSeconds(null);
      return;
    }
    const id = setInterval(() => {
      const left = Math.max(0, deadlineMs - Date.now());
      const secs = Math.ceil(left / 1000);
      setCountdownSeconds(secs);
      if (secs <= 0) {
        setDeadlineMs(null);
      }
    }, 250);
    return () => clearInterval(id);
  }, [deadlineMs]);

  return {
    connection,
    balanceMinor,
    multiplier,
    round,
    history,
    bet,
    preparedAmountMinor,
    isSubmitting,
    countdownLabel,
    countdownSeconds,
    phase,
    isBettingOpen,
    isRoundRunning,
    hasActiveBet,
    mainCtaLabel,
    mainCtaEnabled,
    isActiveBet: hasActiveBet && isRoundRunning,
    potentialPayoutMinor,
    addChip,
    clearChips,
    placeBet,
    cashOut
  };
}

