export interface WalletAdapter {
  getBalance(userId: string): Promise<string>;
  reserveOrDebitBet(userId: string, amountMinor: string, betId: string): Promise<void>;
  creditPayout(userId: string, amountMinor: string, payoutId: string): Promise<void>;
  getLedgerEntries(filters?: {
    userId?: string;
    roundId?: string;
    entryType?: "DEBIT" | "CREDIT";
  }): Promise<unknown[]>;
}
