export type CrashBetStatus = "ACTIVE" | "CASHED_OUT" | "LOST" | "REJECTED";

export interface CrashBetRecord {
  betId: string;
  userId: string;
  roundId: string;
  amountMinor: string;
  placedAt: Date;
  status: CrashBetStatus;
  cashoutMultiplier: string | null;
  payoutAmountMinor: string | null;
  rejectionReason: string | null;
  cashoutId: string | null;
}

export interface CrashBetRepository {
  createBet(record: CrashBetRecord): Promise<void>;
  getBetById(betId: string): Promise<CrashBetRecord | null>;
  getActiveBet(userId: string, roundId: string): Promise<CrashBetRecord | null>;
  updateBet(record: CrashBetRecord): Promise<void>;
  listRoundBets(roundId: string): Promise<CrashBetRecord[]>;
}

export class InMemoryCrashBetRepository implements CrashBetRepository {
  private readonly bets = new Map<string, CrashBetRecord>();

  async createBet(record: CrashBetRecord): Promise<void> {
    if (this.bets.has(record.betId)) {
      throw new Error(`Bet already exists: ${record.betId}`);
    }
    this.bets.set(record.betId, record);
  }

  async getBetById(betId: string): Promise<CrashBetRecord | null> {
    return this.bets.get(betId) ?? null;
  }

  async getActiveBet(userId: string, roundId: string): Promise<CrashBetRecord | null> {
    for (const bet of this.bets.values()) {
      if (bet.userId === userId && bet.roundId === roundId && bet.status === "ACTIVE") {
        return bet;
      }
    }
    return null;
  }

  async updateBet(record: CrashBetRecord): Promise<void> {
    if (!this.bets.has(record.betId)) {
      throw new Error(`Cannot update missing bet: ${record.betId}`);
    }
    this.bets.set(record.betId, record);
  }

  async listRoundBets(roundId: string): Promise<CrashBetRecord[]> {
    const result: CrashBetRecord[] = [];
    for (const bet of this.bets.values()) {
      if (bet.roundId === roundId) {
        result.push(bet);
      }
    }
    return result;
  }
}
