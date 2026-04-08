import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CrashRealtimeEvent } from "../types/crash";
import { CrashGame } from "./CrashGame";

const apiMock = {
  getState: vi.fn(),
  getHistory: vi.fn(),
  placeBet: vi.fn(),
  cashout: vi.fn(),
  getBalance: vi.fn()
};

const handlers = new Map<string, (payload: CrashRealtimeEvent) => void>();
const socketMock = {
  on: vi.fn((event: string, cb: (payload: CrashRealtimeEvent) => void) => handlers.set(event, cb)),
  off: vi.fn((event: string) => handlers.delete(event)),
  close: vi.fn()
};

vi.mock("../lib/apiClient", () => ({ apiClient: apiMock }));
vi.mock("../lib/socketClient", () => ({ createSocketClient: () => socketMock }));

function emit(event: string, payload: CrashRealtimeEvent) {
  const cb = handlers.get(event);
  if (cb) cb(payload);
}

beforeEach(() => {
  handlers.clear();
  vi.clearAllMocks();

  apiMock.getState.mockResolvedValue({
    source: "in_memory",
    activeRound: { roundId: "round_1", status: "BETTING_OPEN", crashMultiplier: null },
    activeBetsCount: 0
  });
  apiMock.getHistory.mockResolvedValue({ source: "in_memory_runtime_history", windowLimit: 50, rounds: [] });
  apiMock.getBalance.mockResolvedValue({ userId: "u1", balanceMinor: "100000", ledgerEntries: [] });
  apiMock.placeBet.mockResolvedValue({
    bet: { betId: "bet_1", roundId: "round_1", userId: "u1", amountMinor: "1000", status: "ACTIVE", payoutAmountMinor: null, cashoutMultiplier: null }
  });
  apiMock.cashout.mockResolvedValue({
    bet: { betId: "bet_1", roundId: "round_1", userId: "u1", amountMinor: "1000", status: "CASHED_OUT", payoutAmountMinor: "1200", cashoutMultiplier: "1.200000" }
  });
});

describe("CrashGame UI", () => {
  it("renders initial state", async () => {
    render(<CrashGame />);
    expect(screen.getByText("Crash MVP")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("round-status")).toHaveTextContent("BETTING_OPEN"));
  });

  it("renders fetched balance", async () => {
    render(<CrashGame />);
    await waitFor(() => expect(screen.getByTestId("balance-panel")).toHaveTextContent("100000"));
  });

  it("bet button enabled/disabled by round status", async () => {
    render(<CrashGame />);
    const betButton = await screen.findByTestId("place-bet");
    expect(betButton).toBeEnabled();

    emit("ROUND_STARTED", { roundId: "round_1" });
    await waitFor(() => expect(betButton).toBeDisabled());
  });

  it("cashout button enabled only with active bet in progress", async () => {
    render(<CrashGame />);
    const cashoutButton = await screen.findByTestId("cashout");
    expect(cashoutButton).toBeDisabled();

    fireEvent.click(screen.getByTestId("place-bet"));
    emit("ROUND_STARTED", { roundId: "round_1" });

    await waitFor(() => expect(cashoutButton).toBeEnabled());
  });

  it("updates multiplier from realtime tick event", async () => {
    render(<CrashGame />);
    await screen.findByTestId("multiplier-display");

    emit("MULTIPLIER_TICK", { roundId: "round_1", multiplier: "1.500000" });
    await waitFor(() => expect(screen.getByTestId("multiplier-display")).toHaveTextContent("1.500000"));
  });

  it("renders history list", async () => {
    apiMock.getHistory.mockResolvedValueOnce({
      source: "in_memory_runtime_history",
      windowLimit: 50,
      rounds: [{ roundId: "r1", status: "SETTLED", crashMultiplier: "2.000000" }]
    });

    render(<CrashGame />);
    await waitFor(() => expect(screen.getByTestId("history-list")).toHaveTextContent("r1"));
  });

  it("shows API error message", async () => {
    apiMock.placeBet.mockRejectedValueOnce(new Error("Betting window closed"));

    render(<CrashGame />);
    await screen.findByTestId("place-bet");
    fireEvent.click(screen.getByTestId("place-bet"));

    await waitFor(() => expect(screen.getByTestId("error")).toHaveTextContent("Betting window closed"));
  });

  it("refreshes state on reconnect-style events", async () => {
    render(<CrashGame />);
    await screen.findByTestId("round-status");
    expect(apiMock.getState).toHaveBeenCalledTimes(1);

    emit("connect", {});
    await waitFor(() => expect(apiMock.getState).toHaveBeenCalledTimes(2));

    emit("reconnect_error", {});
    await waitFor(() => expect(apiMock.getState).toHaveBeenCalledTimes(3));
  });

  it("reconciles stale multiplier and active bet after settled refresh", async () => {
    render(<CrashGame />);
    await screen.findByTestId("place-bet");
    fireEvent.click(screen.getByTestId("place-bet"));
    emit("ROUND_STARTED", { roundId: "round_1" });
    emit("MULTIPLIER_TICK", { roundId: "round_1", multiplier: "4.200000" });
    await waitFor(() => expect(screen.getByTestId("multiplier-display")).toHaveTextContent("4.200000"));

    apiMock.getState.mockResolvedValueOnce({
      source: "in_memory",
      activeRound: { roundId: "round_1", status: "SETTLED", crashMultiplier: "1.900000" },
      activeBetsCount: 0
    });
    emit("ROUND_SETTLED", { roundId: "round_1" });

    await waitFor(() => expect(screen.getByTestId("multiplier-display")).toHaveTextContent("1.900000"));
    await waitFor(() => expect(screen.getByTestId("bet-state")).toHaveTextContent("NONE"));
  });
});
