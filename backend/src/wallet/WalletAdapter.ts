export interface WalletAdapter {
  getBalance(userId: string): Promise<string>;
  reserveOrDebitBet(userId: string, amountMinor: string, betId: string): Promise<void>;
  /** Undo a bet debit (same betId). Used when replacing stake during BETTING_OPEN. */
  refundBetDebit(userId: string, betId: string): Promise<void>;
  creditPayout(userId: string, amountMinor: string, payoutId: string): Promise<void>;
  /** Demo / cashier top-up (idempotent per depositId). */
  creditDeposit(userId: string, amountMinor: string, depositId: string): Promise<void>;
  getLedgerEntries(filters?: {
    userId?: string;
    roundId?: string;
    entryType?: "DEBIT" | "CREDIT";
  }): Promise<unknown[]>;
}
