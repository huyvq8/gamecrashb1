export type LedgerEntryType = "DEBIT" | "CREDIT";

export interface BalanceLedgerEntry {
  ledgerEntryId: string;
  userId: string;
  roundId: string | null;
  betId: string | null;
  cashoutId: string | null;
  entryType: LedgerEntryType;
  amountMinor: string;
  idempotencyKey: string;
  createdAt: Date;
}
