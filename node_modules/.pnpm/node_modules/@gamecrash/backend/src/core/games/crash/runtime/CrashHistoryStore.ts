import type { RoundStatus } from "../../base/GameRound";

export interface SettledRoundHistoryItem {
  roundId: string;
  status: RoundStatus;
  crashMultiplier: string | null;
  crashedAt: Date | null;
  settledAt: Date | null;
}

export class CrashHistoryStore {
  private readonly settled: SettledRoundHistoryItem[] = [];

  constructor(private readonly limit = 50) {}

  push(item: SettledRoundHistoryItem): void {
    this.settled.unshift(item);
    if (this.settled.length > this.limit) {
      this.settled.length = this.limit;
    }
  }

  list(): SettledRoundHistoryItem[] {
    return [...this.settled];
  }

  getLimit(): number {
    return this.limit;
  }
}
