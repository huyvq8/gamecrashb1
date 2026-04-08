export enum LedgerEntryType {
  DEBIT = "DEBIT",
  CREDIT = "CREDIT"
}

export interface LedgerEntry {
  ledgerEntryId: string;
  userId: string;
  roundId: string | null;
  betId: string | null;
  cashoutId: string | null;
  entryType: LedgerEntryType;
  amountMinor: string;
  balanceBeforeMinor: string;
  balanceAfterMinor: string;
  idempotencyKey: string;
  createdAt: string;
}
