import { describe, expect, it } from "vitest";
import { defaultCrashConfig } from "../src/config/gameConfig";
import { RoundStatus } from "../src/core/games/base/GameRound";
import { CrashEngine } from "../src/core/games/crash/CrashEngine";
import { CrashRoundManager } from "../src/core/games/crash/CrashRoundManager";

describe("Crash lifecycle runtime", () => {
  it("valid transitions pass and invalid transitions throw", async () => {
    const engine = new CrashEngine();
    await engine.init(defaultCrashConfig);
    const roundId = await engine.createRound();

    await expect(engine.startRound(roundId)).resolves.toBeUndefined();
    await expect(engine.openBetting(roundId)).rejects.toThrow(/Invalid round status transition/i);
  });

  it("settleRound only allowed from CRASHED", async () => {
    const engine = new CrashEngine();
    await engine.init(defaultCrashConfig);
    const roundId = await engine.createRound();

    await expect(engine.settleRound(roundId)).rejects.toThrow(/Invalid round status transition/i);

    await engine.startRound(roundId);
    await engine.processTick(roundId, new Date(Date.now() + 300_000));

    expect(await engine.getRoundStatus(roundId)).toBe(RoundStatus.CRASHED);
    await expect(engine.settleRound(roundId)).resolves.toBeUndefined();
    await expect(engine.settleRound(roundId)).rejects.toThrow(/already settled/i);
  });

  it("openBetting is explicit idempotent while BETTING_OPEN", async () => {
    const engine = new CrashEngine();
    await engine.init(defaultCrashConfig);
    const roundId = await engine.createRound();

    await expect(engine.openBetting(roundId)).resolves.toBeUndefined();
    expect(await engine.getRoundStatus(roundId)).toBe(RoundStatus.BETTING_OPEN);
  });

  it("round manager active round lifecycle works", () => {
    const manager = new CrashRoundManager();
    manager.create({
      roundId: "r1",
      gameKey: "crash",
      status: RoundStatus.BETTING_OPEN,
      bettingOpenAt: new Date(),
      bettingCloseAt: new Date(),
      startedAt: null,
      crashedAt: null,
      settledAt: null,
      configSnapshot: {},
      crashMultiplier: "2.000000",
      rngSeedRef: "seed",
      serverSeedHash: null,
      fairnessVersion: "v1",
      startTimeMs: null,
      bettingClosedAt: null
    });

    expect(manager.getActiveRound()?.roundId).toBe("r1");

    manager.update("r1", (r) => ({ ...r, status: RoundStatus.SETTLED, settledAt: new Date() }));
    expect(manager.getActiveRound()).toBeNull();
  });
});
