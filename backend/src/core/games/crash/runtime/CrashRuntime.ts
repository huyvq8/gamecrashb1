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
    if (this.tickTimer) clearInterval(this.tickTimer);
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

  private async startTickLoop(roundId: string): Promise<void> {
    this.tickTimer = setInterval(async () => {
      const now = new Date();
      await this.engine.processTick(roundId, now);
      const snapshot = this.engine.getRoundSnapshot(roundId);

      if (snapshot.status === RoundStatus.IN_PROGRESS) {
        const elapsedMs = BigInt(Math.max(0, now.getTime() - (snapshot.startTimeMs ?? now.getTime())));
        const multiplier = multiplierAtElapsedMs(elapsedMs);
        await this.realtime.publishEvent("MULTIPLIER_TICK", { roundId, multiplier, serverTime: now.toISOString() });
        return;
      }

      if (snapshot.status === RoundStatus.CRASHED) {
        if (this.tickTimer) clearInterval(this.tickTimer);
        this.tickTimer = null;
        await this.finalizeRound(roundId);
      }
    }, this.config.tickIntervalMs);
  }

  private async runTicksUntilCrash(roundId: string): Promise<void> {
    while (true) {
      const now = new Date(Date.now() + 1000);
      await this.engine.processTick(roundId, now);
      const snapshot = this.engine.getRoundSnapshot(roundId);

      if (snapshot.status === RoundStatus.IN_PROGRESS) {
        const elapsedMs = BigInt(Math.max(0, now.getTime() - (snapshot.startTimeMs ?? now.getTime())));
        await this.realtime.publishEvent("MULTIPLIER_TICK", {
          roundId,
          multiplier: multiplierAtElapsedMs(elapsedMs),
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

    await this.realtime.publishEvent("ROUND_CRASHED", {
      roundId,
      crashMultiplier: crashed.crashMultiplier,
      crashedAt: crashed.crashedAt?.toISOString() ?? null
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
      crashMultiplier: settled.crashMultiplier
    });

    if (this.running) {
      this.loopTimer = setTimeout(async () => {
        await this.beginNextRound();
      }, 250);
    }
  }
}
