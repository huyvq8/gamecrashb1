import type { GameEngine } from "../base/GameEngine";
import { ROUND_TRANSITIONS, RoundStatus } from "../base/GameRound";
import type { CrashGameConfig } from "./CrashContracts";
import { hasCrashed, multiplierAtElapsedMs } from "./CrashMath";
import { DeterministicCrashRng } from "./CrashRng";
import { CrashRoundManager, type ManagedCrashRound } from "./CrashRoundManager";

export class CrashEngine implements GameEngine<CrashGameConfig> {
  private config: CrashGameConfig | null = null;
  private readonly roundManager = new CrashRoundManager();
  private rng: DeterministicCrashRng | null = null;
  private sequence = 0;

  async init(config: CrashGameConfig): Promise<void> {
    this.config = config;
    this.rng = new DeterministicCrashRng(config);
  }

  async createRound(): Promise<string> {
    const config = this.requireConfig();
    const rng = this.requireRng();
    const roundId = `round_${Date.now()}_${++this.sequence}`;
    const now = new Date();
    const bettingCloseAt = new Date(now.getTime() + config.bettingWindowMs);

    const round: ManagedCrashRound = {
      roundId,
      gameKey: config.gameKey,
      status: RoundStatus.BETTING_OPEN,
      bettingOpenAt: now,
      bettingCloseAt,
      startedAt: null,
      crashedAt: null,
      settledAt: null,
      configSnapshot: { ...config },
      crashMultiplier: rng.nextCrashMultiplier(),
      rngSeedRef: `seed_${roundId}`,
      serverSeedHash: null,
      fairnessVersion: "v1-placeholder",
      startTimeMs: null,
      bettingClosedAt: null
    };

    this.roundManager.create(round);
    return roundId;
  }

  async openBetting(roundId: string): Promise<void> {
    this.roundManager.update(roundId, (round) => {
      // Explicit idempotent rule: opening an already-open round is a no-op.
      if (round.status === RoundStatus.BETTING_OPEN) {
        return round;
      }
      this.assertTransition(round.status, RoundStatus.BETTING_OPEN);
      return round;
    });
  }

  async closeBetting(roundId: string): Promise<void> {
    this.roundManager.update(roundId, (round) => {
      if (round.status !== RoundStatus.BETTING_OPEN) {
        throw new Error(`closeBetting is only allowed in ${RoundStatus.BETTING_OPEN}`);
      }
      if (round.bettingClosedAt) {
        return round;
      }
      return {
        ...round,
        bettingClosedAt: new Date()
      };
    });
  }

  async startRound(roundId: string): Promise<void> {
    this.roundManager.update(roundId, (round) => {
      if (round.status === RoundStatus.IN_PROGRESS) {
        throw new Error("Round already in progress");
      }
      this.assertTransition(round.status, RoundStatus.IN_PROGRESS);

      return {
        ...round,
        status: RoundStatus.IN_PROGRESS,
        startedAt: new Date(),
        startTimeMs: Date.now()
      };
    });
  }

  async processTick(roundId: string, now: Date): Promise<void> {
    this.roundManager.update(roundId, (round) => {
      // Explicit idempotent rule: ticks outside IN_PROGRESS are no-ops.
      if (round.status !== RoundStatus.IN_PROGRESS) {
        return round;
      }
      if (!round.crashMultiplier) {
        throw new Error("Round crash multiplier not available");
      }
      if (round.startTimeMs === null) {
        throw new Error("Round has no start time");
      }

      const elapsedMs = BigInt(Math.max(0, now.getTime() - round.startTimeMs));
      const currentMultiplier = multiplierAtElapsedMs(elapsedMs);
      const crashed = hasCrashed(currentMultiplier, round.crashMultiplier);

      if (!crashed) {
        return round;
      }

      this.assertTransition(round.status, RoundStatus.CRASHED);
      return {
        ...round,
        status: RoundStatus.CRASHED,
        crashedAt: now
      };
    });
  }
  async requestCashout(_userId: string, _roundId: string, _requestTime: Date): Promise<void> {
    throw new Error("Cashout is not implemented in Phase 2 scope");
  }

  async settleRound(roundId: string): Promise<void> {
    this.roundManager.update(roundId, (round) => {
      if (round.status === RoundStatus.SETTLED) {
        throw new Error("Round already settled");
      }
      this.assertTransition(round.status, RoundStatus.SETTLED);
      return {
        ...round,
        status: RoundStatus.SETTLED,
        settledAt: new Date()
      };
    });
  }

  async getRoundStatus(roundId: string): Promise<RoundStatus> {
    return this.roundManager.get(roundId).status;
  }

  getActiveRound(): ManagedCrashRound | null {
    return this.roundManager.getActiveRound();
  }

  getRoundSnapshot(roundId: string): ManagedCrashRound {
    return this.roundManager.get(roundId);
  }

  private assertTransition(from: RoundStatus, to: RoundStatus): void {
    if (from === to) {
      return;
    }
    const allowed = ROUND_TRANSITIONS[from];
    if (!allowed.includes(to)) {
      throw new Error(`Invalid round status transition: ${from} -> ${to}`);
    }
  }

  private requireConfig(): CrashGameConfig {
    if (!this.config) {
      throw new Error("CrashEngine is not initialized");
    }
    return this.config;
  }

  private requireRng(): DeterministicCrashRng {
    if (!this.rng) {
      throw new Error("Crash RNG is not initialized");
    }
    return this.rng;
  }
}
