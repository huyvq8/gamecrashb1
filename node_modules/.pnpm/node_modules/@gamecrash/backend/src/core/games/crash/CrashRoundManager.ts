import { RoundStatus } from "../base/GameRound";
import type { CrashRound } from "./CrashContracts";

export interface ManagedCrashRound extends CrashRound {
  startTimeMs: number | null;
  bettingClosedAt: Date | null;
}

export class CrashRoundManager {
  private readonly rounds = new Map<string, ManagedCrashRound>();
  private activeRoundId: string | null = null;

  create(round: ManagedCrashRound): void {
    this.rounds.set(round.roundId, round);
    this.activeRoundId = round.roundId;
  }

  get(roundId: string): ManagedCrashRound {
    const round = this.rounds.get(roundId);
    if (!round) {
      throw new Error(`Round not found: ${roundId}`);
    }
    return round;
  }

  update(roundId: string, updater: (round: ManagedCrashRound) => ManagedCrashRound): ManagedCrashRound {
    const current = this.get(roundId);
    const next = updater(current);
    this.rounds.set(roundId, next);

    if (next.status === RoundStatus.SETTLED && this.activeRoundId === roundId) {
      this.activeRoundId = null;
    }

    return next;
  }

  getActiveRound(): ManagedCrashRound | null {
    if (!this.activeRoundId) {
      return null;
    }
    return this.get(this.activeRoundId);
  }
}
