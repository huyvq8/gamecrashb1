import { describe, expect, it } from "vitest";
import { createServer } from "../src/api/createServer";
import { defaultCrashConfig } from "../src/config/gameConfig";
import { InMemoryCrashBetRepository } from "../src/core/games/crash/CrashBetRepository";
import { CrashBettingService } from "../src/core/games/crash/CrashBettingService";
import { CrashEngine } from "../src/core/games/crash/CrashEngine";
import { CrashHistoryStore } from "../src/core/games/crash/runtime/CrashHistoryStore";
import { CrashRuntime } from "../src/core/games/crash/runtime/CrashRuntime";
import { RejectionTracker } from "../src/ops/RejectionTracker";
import { InMemoryRealtimeGateway } from "../src/realtime/InMemoryRealtimeGateway";
import { InMemoryWalletAdapter } from "../src/wallet/InMemoryWalletAdapter";

async function setup() {
  const engine = new CrashEngine();
  await engine.init(defaultCrashConfig);
  const wallet = new InMemoryWalletAdapter();
  wallet.seedBalance("u1", "500000");
  const betRepository = new InMemoryCrashBetRepository();
  const historyStore = new CrashHistoryStore();
  const realtime = new InMemoryRealtimeGateway();
  const rejectionTracker = new RejectionTracker();
  const bettingService = new CrashBettingService(defaultCrashConfig, engine, wallet, betRepository);
  const runtime = new CrashRuntime(defaultCrashConfig, engine, bettingService, betRepository, historyStore, realtime);

  const app = createServer({
    runtime,
    historyStore,
    bettingService,
    betRepository,
    wallet,
    realtime,
    rejectionTracker
  });

  return { app, runtime, wallet, realtime, engine };
}

describe("Phase 4 API + realtime", () => {
  it("GET /game/crash/state returns active round snapshot", async () => {
    const { app, runtime } = await setup();
    await runtime.start();

    const res = await app.inject({ method: "GET", url: "/game/crash/state" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.source).toBe("in_memory");
    expect(body.activeRound).not.toBeNull();

    runtime.stop();
    await app.close();
  });

  it("POST /game/crash/bet validation path", async () => {
    const { app, runtime } = await setup();
    await runtime.start();
    const state = (await app.inject({ method: "GET", url: "/game/crash/state" })).json();

    const bad = await app.inject({ method: "POST", url: "/game/crash/bet", payload: { userId: "", roundId: "", amountMinor: "x" } });
    expect(bad.statusCode).toBe(400);

    const ok = await app.inject({
      method: "POST",
      url: "/game/crash/bet",
      payload: { userId: "u1", roundId: state.activeRound.roundId, amountMinor: "1000" }
    });
    expect(ok.statusCode).toBe(201);

    runtime.stop();
    await app.close();
  });

  it("POST /game/crash/cashout validation path", async () => {
    const { app, runtime, engine } = await setup();
    await runtime.start();
    const state = (await app.inject({ method: "GET", url: "/game/crash/state" })).json();

    await app.inject({
      method: "POST",
      url: "/game/crash/bet",
      payload: { userId: "u1", roundId: state.activeRound.roundId, amountMinor: "1000" }
    });

    await engine.closeBetting(state.activeRound.roundId);
    await engine.startRound(state.activeRound.roundId);

    const ok = await app.inject({
      method: "POST",
      url: "/game/crash/cashout",
      payload: { userId: "u1", roundId: state.activeRound.roundId }
    });

    expect([200, 409]).toContain(ok.statusCode);

    runtime.stop();
    await app.close();
  });

  it("GET /wallet/balance returns expected shape", async () => {
    const { app } = await setup();
    const res = await app.inject({ method: "GET", url: "/wallet/balance?userId=u1" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.userId).toBe("u1");
    expect(typeof body.balanceMinor).toBe("string");
    expect(Array.isArray(body.ledgerEntries)).toBe(true);
    await app.close();
  });

  it("GET /game/crash/history returns recent settled rounds shape", async () => {
    const { app, runtime } = await setup();
    await runtime.runSingleLifecycleForTest();

    const res = await app.inject({ method: "GET", url: "/game/crash/history" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.source).toBe("in_memory_runtime_history");
    expect(typeof body.windowLimit).toBe("number");
    expect(Array.isArray(body.rounds)).toBe(true);

    await app.close();
  });

  it("realtime events emitted in lifecycle order", async () => {
    const { runtime, realtime, app } = await setup();
    await runtime.runSingleLifecycleForTest();

    const names = realtime.events.map((e) => e.eventName);
    const start = names.indexOf("ROUND_CREATED");
    const open = names.indexOf("BETTING_OPEN");
    const started = names.indexOf("ROUND_STARTED");
    const crashed = names.indexOf("ROUND_CRASHED");
    const settled = names.indexOf("ROUND_SETTLED");

    expect(start).toBeGreaterThanOrEqual(0);
    expect(open).toBeGreaterThan(start);
    expect(started).toBeGreaterThan(open);
    expect(crashed).toBeGreaterThan(started);
    expect(settled).toBeGreaterThan(crashed);

    const lastCrashIndex = names.lastIndexOf("ROUND_CRASHED");
    const lastTickIndex = names.lastIndexOf("MULTIPLIER_TICK");
    expect(lastTickIndex).toBeLessThan(lastCrashIndex);
    expect(names.slice(0, crashed)).not.toContain("ROUND_SETTLED");

    await app.close();
  });

  it("CASHOUT_ACCEPTED cannot happen after crash", async () => {
    const { app, runtime, realtime } = await setup();
    await runtime.runSingleLifecycleForTest();
    const history = (await app.inject({ method: "GET", url: "/game/crash/history" })).json();
    const settledRoundId = history.rounds[0]?.roundId as string | undefined;
    expect(settledRoundId).toBeTruthy();

    const res = await app.inject({
      method: "POST",
      url: "/game/crash/cashout",
      payload: { userId: "u1", roundId: settledRoundId }
    });

    expect(res.statusCode).toBe(409);
    expect(realtime.events.some((e) => e.eventName === "CASHOUT_ACCEPTED")).toBe(false);
    await app.close();
  });

  it("GET /ops/crash/debug returns usable snapshot", async () => {
    const { app, runtime } = await setup();
    await runtime.start();

    await app.inject({ method: "POST", url: "/game/crash/bet", payload: { userId: "", roundId: "", amountMinor: "x" } });

    const res = await app.inject({ method: "GET", url: "/ops/crash/debug" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.source).toBe("in_memory_runtime_debug");
    expect(body).toHaveProperty("historyWindowLimit");
    expect(body).toHaveProperty("activeRoundId");
    expect(body).toHaveProperty("activeRoundStatus");
    expect(body).toHaveProperty("activeRound");
    expect(body).toHaveProperty("activeBetsCount");
    expect(body).toHaveProperty("recentCrashMultipliers");
    expect(body).toHaveProperty("rejectionCounts");

    runtime.stop();
    await app.close();
  });

  it("history endpoint remains consistent across recent-round rotation", async () => {
    const { app, runtime } = await setup();
    await runtime.runSingleLifecycleForTest();
    await runtime.runSingleLifecycleForTest();

    const history = await app.inject({ method: "GET", url: "/game/crash/history" });
    const state = await app.inject({ method: "GET", url: "/game/crash/state" });

    expect(history.statusCode).toBe(200);
    expect(state.statusCode).toBe(200);

    const historyBody = history.json();
    const stateBody = state.json();

    expect(historyBody.source).toBe("in_memory_runtime_history");
    expect(Array.isArray(historyBody.rounds)).toBe(true);
    expect(historyBody.rounds.length).toBeGreaterThanOrEqual(1);
    expect(stateBody.activeRound).toBeNull();

    await app.close();
  });
});
