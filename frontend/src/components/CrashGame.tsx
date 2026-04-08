import React, { useEffect, useMemo, useState } from "react";
import { runtimeConfig } from "../config/runtimeConfig";
import { apiClient } from "../lib/apiClient";
import { createSocketClient } from "../lib/socketClient";
import type { ActiveRound, BetRecord, CrashRealtimeEvent, HistoryRound, RoundStatus } from "../types/crash";
import { BalancePanel } from "./BalancePanel";
import { BetPanel } from "./BetPanel";
import { MultiplierDisplay } from "./MultiplierDisplay";
import { RecentRounds } from "./RecentRounds";
import { RoundTimeline } from "./RoundTimeline";

export function CrashGame() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balanceMinor, setBalanceMinor] = useState("0");
  const [round, setRound] = useState<ActiveRound | null>(null);
  const [multiplier, setMultiplier] = useState("1.000000");
  const [betAmount, setBetAmount] = useState("1000");
  const [bet, setBet] = useState<BetRecord | null>(null);
  const [history, setHistory] = useState<HistoryRound[]>([]);

  const roundStatus: RoundStatus | "IDLE" = round?.status ?? "IDLE";

  const canBet = useMemo(() => roundStatus === "BETTING_OPEN" && !!round?.roundId, [roundStatus, round]);
  const canCashout = useMemo(() => roundStatus === "IN_PROGRESS" && bet?.status === "ACTIVE", [roundStatus, bet]);

  async function refreshState() {
    const [state, wallet, historyResponse] = await Promise.all([
      apiClient.getState(),
      apiClient.getBalance(runtimeConfig.demoUserId),
      apiClient.getHistory()
    ]);

    setRound(state.activeRound);
    setBalanceMinor(wallet.balanceMinor);
    setHistory(historyResponse.rounds);

    if (!state.activeRound || state.activeRound.status === "BETTING_OPEN") {
      setMultiplier("1.000000");
    } else if ((state.activeRound.status === "CRASHED" || state.activeRound.status === "SETTLED") && state.activeRound.crashMultiplier) {
      setMultiplier(state.activeRound.crashMultiplier);
    }

    if (!state.activeRound || state.activeRound.status !== "IN_PROGRESS") {
      setBet((prev) => (prev?.status === "ACTIVE" ? null : prev));
    }
  }

  useEffect(() => {
    setLoading(true);
    refreshState()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load state"))
      .finally(() => setLoading(false));

    const socket = createSocketClient();
    const handleReconnect = () => {
      refreshState().catch(() => undefined);
    };
    const handleReconnectError = () => {
      refreshState().catch(() => undefined);
    };

    const onRoundCreated = (evt: CrashRealtimeEvent) => {
      setRound((prev) => ({ roundId: evt.roundId ?? prev?.roundId ?? "", status: "BETTING_OPEN", crashMultiplier: null }));
      setMultiplier("1.000000");
      setBet(null);
    };

    const onBettingOpen = (evt: CrashRealtimeEvent) => {
      setRound((prev) => ({ roundId: evt.roundId ?? prev?.roundId ?? "", status: "BETTING_OPEN", crashMultiplier: null }));
    };

    const onRoundStarted = (evt: CrashRealtimeEvent) => {
      setRound((prev) => ({ roundId: evt.roundId ?? prev?.roundId ?? "", status: "IN_PROGRESS", crashMultiplier: null }));
    };

    const onTick = (evt: CrashRealtimeEvent) => {
      if (typeof evt.multiplier === "string") {
        setMultiplier(evt.multiplier);
      }
    };

    const onCashoutAccepted = (evt: CrashRealtimeEvent) => {
      setBet((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: "CASHED_OUT",
          payoutAmountMinor: evt.payoutAmountMinor ?? prev.payoutAmountMinor,
          cashoutMultiplier: evt.cashoutMultiplier ?? prev.cashoutMultiplier
        };
      });
      refreshState().catch(() => undefined);
    };

    const onRoundCrashed = (evt: CrashRealtimeEvent) => {
      setRound((prev) => ({
        roundId: evt.roundId ?? prev?.roundId ?? "",
        status: "CRASHED",
        crashMultiplier: evt.crashMultiplier ?? prev?.crashMultiplier ?? null
      }));
      if (typeof evt.crashMultiplier === "string") {
        setMultiplier(evt.crashMultiplier);
      }
      setBet((prev) => (prev?.status === "ACTIVE" ? { ...prev, status: "LOST" } : prev));
    };

    const onRoundSettled = () => {
      setRound((prev) => (prev ? { ...prev, status: "SETTLED" } : prev));
      refreshState().catch(() => undefined);
    };

    socket.on("ROUND_CREATED", onRoundCreated);
    socket.on("BETTING_OPEN", onBettingOpen);
    socket.on("ROUND_STARTED", onRoundStarted);
    socket.on("MULTIPLIER_TICK", onTick);
    socket.on("CASHOUT_ACCEPTED", onCashoutAccepted);
    socket.on("ROUND_CRASHED", onRoundCrashed);
    socket.on("ROUND_SETTLED", onRoundSettled);
    socket.on("connect", handleReconnect);
    socket.on("reconnect", handleReconnect);
    socket.on("reconnect_error", handleReconnectError);
    socket.on("connect_error", handleReconnectError);

    return () => {
      socket.off("ROUND_CREATED", onRoundCreated);
      socket.off("BETTING_OPEN", onBettingOpen);
      socket.off("ROUND_STARTED", onRoundStarted);
      socket.off("MULTIPLIER_TICK", onTick);
      socket.off("CASHOUT_ACCEPTED", onCashoutAccepted);
      socket.off("ROUND_CRASHED", onRoundCrashed);
      socket.off("ROUND_SETTLED", onRoundSettled);
      socket.off("connect", handleReconnect);
      socket.off("reconnect", handleReconnect);
      socket.off("reconnect_error", handleReconnectError);
      socket.off("connect_error", handleReconnectError);
      socket.close();
    };
  }, []);

  async function onPlaceBet() {
    if (!round?.roundId) return;
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.placeBet({ userId: runtimeConfig.demoUserId, roundId: round.roundId, amountMinor: betAmount });
      setBet(response.bet);
      await refreshState();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to place bet");
    } finally {
      setLoading(false);
    }
  }

  async function onCashout() {
    if (!round?.roundId) return;
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.cashout({ userId: runtimeConfig.demoUserId, roundId: round.roundId });
      setBet(response.bet);
      await refreshState();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cash out");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>Crash MVP</h1>
      {loading ? <p data-testid="loading">Loading...</p> : null}
      {error ? <p data-testid="error">{error}</p> : null}
      <BalancePanel balanceMinor={balanceMinor} />
      <RoundTimeline status={roundStatus} />
      <MultiplierDisplay multiplier={multiplier} />
      <BetPanel
        betAmount={betAmount}
        onBetAmountChange={setBetAmount}
        onPlaceBet={onPlaceBet}
        onCashout={onCashout}
        canBet={canBet}
        canCashout={canCashout}
        loading={loading}
      />
      <div data-testid="bet-state">Bet status: {bet?.status ?? "NONE"}</div>
      <RecentRounds rounds={history} />
    </div>
  );
}
