import { RoundStatus } from "../../base/GameRound";
import { multiplierAtElapsedMs } from "../CrashMath";
import type { CrashBetRepository } from "../CrashBetRepository";
import type { CrashBettingService } from "../CrashBettingService";
import type { CrashEngine } from "../CrashEngine";
import type { CrashGameConfig } from "../CrashContracts";
import type { ManagedCrashRound } from "../CrashRoundManager";
import type { RealtimeGateway } from "../../../../realtime/RealtimeGateway";
import type { CrashHistoryStore } from "./CrashHistoryStore";

export class CrashRuntime {
  private running = false;
  private loopTimer: NodeJS.Timeout | null = null;
  private tickTimer: NodeJS.Timeout | null = null;
  private currentRoundId: string | null = null;
  private nextRoundStartsAt: Date | null = null;

  constructor(
    private readonly config: CrashGameConfig,
    private readonly engine: CrashEngine,
    private readonly bettingService: CrashBettingService,
    private readonly betRepository: CrashBetRepository,
    private readonly historyStore: CrashHistoryStore,
    private readonly realtime: RealtimeGateway
  ) {}

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    await this.beginNextRound();
  }

  stop(): void {
    this.running = false;
    if (this.loopTimer) clearTimeout(this.loopTimer);
    if (this.tickTimer) clearTimeout(this.tickTimer);
    this.loopTimer = null;
    this.tickTimer = null;
    this.currentRoundId = null;
  }

  getActiveRound(): ManagedCrashRound | null {
    if (!this.currentRoundId) return null;
    const round = this.engine.getRoundSnapshot(this.currentRoundId);
    if (round.status === RoundStatus.SETTLED) {
      return null;
    }
    return round;
  }

  async runSingleLifecycleForTest(): Promise<void> {
    const roundId = await this.createAndOpenRound();
    await this.engine.closeBetting(roundId);
    await this.engine.startRound(roundId);
    await this.realtime.publishEvent("ROUND_STARTED", { roundId, gameKey: this.config.gameKey });

    await this.runTicksUntilCrash(roundId);
    await this.finalizeRound(roundId);
  }

  async getDebugSnapshot(): Promise<{
    activeRound: ManagedCrashRound | null;
    activeBetsCount: number;
    recentCrashMultipliers: string[];
  }> {
    const activeRound = this.getActiveRound();
    let activeBetsCount = 0;
    if (activeRound) {
      const bets = await this.betRepository.listRoundBets(activeRound.roundId);
      activeBetsCount = bets.filter((b) => b.status === "ACTIVE").length;
    }

    return {
      activeRound,
      activeBetsCount,
      recentCrashMultipliers: this.historyStore
        .list()
        .map((x) => x.crashMultiplier)
        .filter((x): x is string => Boolean(x))
    };
  }

  private async beginNextRound(): Promise<void> {
    if (!this.running) return;

    const roundId = await this.createAndOpenRound();

    this.loopTimer = setTimeout(async () => {
      try {
        await this.engine.closeBetting(roundId);
        await this.engine.startRound(roundId);
        await this.realtime.publishEvent("ROUND_STARTED", { roundId, gameKey: this.config.gameKey });
        await this.startTickLoop(roundId);
      } catch {
        this.stop();
      }
    }, this.config.bettingWindowMs);
  }

  private async createAndOpenRound(): Promise<string> {
    const roundId = await this.engine.createRound();
    this.currentRoundId = roundId;

    await this.realtime.publishEvent("ROUND_CREATED", { roundId, gameKey: this.config.gameKey });
    await this.engine.openBetting(roundId);
    await this.realtime.publishEvent("BETTING_OPEN", {
      roundId,
      gameKey: this.config.gameKey,
      bettingCloseAt: this.engine.getRoundSnapshot(roundId).bettingCloseAt.toISOString()
    });

    return roundId;
  }

  private tickDelayForMultiplier(multiplier: string): number {
    const base = this.config.tickIntervalMs;
    const m = Number(multiplier);
    if (!Number.isFinite(m) || m < 1) return base;
    // Higher X → shorter delay (exponential curve needs tighter ticks so crash/cashout stay fair).
    const factor =
      m < 2 ? 1 : m < 4 ? 0.82 : m < 10 ? 0.62 : m < 25 ? 0.42 : m < 60 ? 0.28 : m < 150 ? 0.2 : 0.14;
    return Math.max(28, Math.round(base * factor));
  }

  private async runTickStep(roundId: string): Promise<void> {
    if (!this.running) return;

    const now = new Date();
    await this.engine.processTick(roundId, now);
    const snapshot = this.engine.getRoundSnapshot(roundId);

    if (snapshot.status === RoundStatus.IN_PROGRESS) {
      const elapsedMs = BigInt(Math.max(0, now.getTime() - (snapshot.startTimeMs ?? now.getTime())));
      const multiplier = multiplierAtElapsedMs(elapsedMs);
      await this.realtime.publishEvent("MULTIPLIER_TICK", { roundId, multiplier, serverTime: now.toISOString() });
      const delay = this.tickDelayForMultiplier(multiplier);
      this.tickTimer = setTimeout(() => {
        void this.runTickStep(roundId);
      }, delay);
      return;
    }

    if (snapshot.status === RoundStatus.CRASHED) {
      this.tickTimer = null;
      await this.finalizeRound(roundId);
    } else {
      this.tickTimer = null;
    }
  }

  private async startTickLoop(roundId: string): Promise<void> {
    if (this.tickTimer) {
      clearTimeout(this.tickTimer);
      this.tickTimer = null;
    }
    void this.runTickStep(roundId);
  }

  private async runTicksUntilCrash(roundId: string): Promise<void> {
    const started = this.engine.getRoundSnapshot(roundId);
    const startMs = started.startTimeMs;
    if (startMs === null) {
      throw new Error("runTicksUntilCrash: round has no startTimeMs");
    }
    /** Advance simulated clock (do not rely on wall clock — exponential curve needs many ms to hit crash). */
    const STEP_MS = 100n;
    let simElapsedMs = 0n;
    while (true) {
      simElapsedMs += STEP_MS;
      const now = new Date(Number(BigInt(startMs) + simElapsedMs));
      await this.engine.processTick(roundId, now);
      const snapshot = this.engine.getRoundSnapshot(roundId);

      if (snapshot.status === RoundStatus.IN_PROGRESS) {
        await this.realtime.publishEvent("MULTIPLIER_TICK", {
          roundId,
          multiplier: multiplierAtElapsedMs(simElapsedMs),
          serverTime: now.toISOString()
        });
        continue;
      }

      if (snapshot.status === RoundStatus.CRASHED) {
        break;
      }
    }
  }

  async finalizeRound(roundId: string): Promise<void> {
    const crashed = this.engine.getRoundSnapshot(roundId);
    await this.bettingService.markRoundLosses(roundId);

    // Next round starts immediately after settle (no idle cooldown). Clients use normal betting window countdown.
    const cooldownMs = 0;
    this.nextRoundStartsAt = new Date();

    await this.realtime.publishEvent("ROUND_CRASHED", {
      roundId,
      crashMultiplier: crashed.crashMultiplier,
      crashedAt: crashed.crashedAt?.toISOString() ?? null,
      nextRoundStartsAt: this.nextRoundStartsAt.toISOString()
    });

    await this.engine.settleRound(roundId);
    const settled = this.engine.getRoundSnapshot(roundId);
    this.currentRoundId = null;

    this.historyStore.push({
      roundId,
      status: settled.status,
      crashMultiplier: settled.crashMultiplier,
      crashedAt: settled.crashedAt,
      settledAt: settled.settledAt
    });

    await this.realtime.publishEvent("ROUND_SETTLED", {
      roundId,
      settledAt: settled.settledAt?.toISOString() ?? null,
      crashMultiplier: settled.crashMultiplier,
      nextRoundStartsAt: this.nextRoundStartsAt?.toISOString() ?? null
    });

    if (this.running) {
      this.loopTimer = setTimeout(() => {
        void this.beginNextRound();
      }, cooldownMs);
    }
  }
}
