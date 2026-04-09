import type { LedgerEntryType } from "./BalanceLedger";
import type { WalletAdapter } from "./WalletAdapter";
import { InsufficientBalanceError } from "./WalletErrors";
import {
  buildBetDebitIdempotencyKey,
  buildBetRefundCreditIdempotencyKey,
  buildDepositCreditIdempotencyKey,
  buildPayoutCreditIdempotencyKey
} from "./WalletIdempotency";

interface WalletBalanceRecord {
  userId: string;
  balanceMinor: bigint;
}

interface InMemoryLedgerEntry {
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

/** Demo balance: 10_000 UI units if frontend uses ÷100 (matches runtimeConfig.minorUnitsPerDisplay). */
const DEFAULT_TEST_BALANCE_MINOR = 1_000_000n;

function parseMinorUnits(value: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new Error("Amount must be a positive integer minor-unit string");
  }
  return BigInt(value);
}

export class InMemoryWalletAdapter implements WalletAdapter {
  private readonly balances = new Map<string, WalletBalanceRecord>();
  private readonly ledger: InMemoryLedgerEntry[] = [];
  private readonly debitIdempotency = new Map<string, InMemoryLedgerEntry>();
  private readonly creditIdempotency = new Map<string, InMemoryLedgerEntry>();
  private readonly depositIdempotency = new Map<string, InMemoryLedgerEntry>();
  private ledgerSequence = 0;

  seedBalance(userId: string, balanceMinor: string): void {
    this.balances.set(userId, { userId, balanceMinor: parseMinorUnits(balanceMinor) });
  }

  async getBalance(userId: string): Promise<string> {
    const record = this.getOrCreateBalance(userId);
    return record.balanceMinor.toString();
  }

  async reserveOrDebitBet(userId: string, amountMinor: string, betId: string): Promise<void> {
    const amount = parseMinorUnits(amountMinor);
    if (amount <= 0n) {
      throw new Error("Bet amount must be greater than zero");
    }

    if (this.debitIdempotency.has(betId)) {
      return;
    }

    const balanceRecord = this.getOrCreateBalance(userId);
    if (balanceRecord.balanceMinor < amount) {
      throw new InsufficientBalanceError();
    }

    balanceRecord.balanceMinor -= amount;
    const entry = this.createLedgerEntry({
      userId,
      roundId: null,
      betId,
      cashoutId: null,
      entryType: "DEBIT",
      amountMinor: amount.toString(),
      idempotencyKey: buildBetDebitIdempotencyKey(betId)
    });

    this.debitIdempotency.set(betId, entry);
  }

  async refundBetDebit(userId: string, betId: string): Promise<void> {
    const debitEntry = this.debitIdempotency.get(betId);
    if (!debitEntry) {
      throw new Error(`No bet debit to refund: ${betId}`);
    }

    const amount = parseMinorUnits(debitEntry.amountMinor);
    const balanceRecord = this.getOrCreateBalance(userId);
    balanceRecord.balanceMinor += amount;
    this.debitIdempotency.delete(betId);

    this.createLedgerEntry({
      userId,
      roundId: null,
      betId,
      cashoutId: null,
      entryType: "CREDIT",
      amountMinor: amount.toString(),
      idempotencyKey: buildBetRefundCreditIdempotencyKey(betId)
    });
  }

  async creditPayout(userId: string, amountMinor: string, payoutId: string): Promise<void> {
    const amount = parseMinorUnits(amountMinor);
    if (amount <= 0n) {
      throw new Error("Payout amount must be greater than zero");
    }

    if (this.creditIdempotency.has(payoutId)) {
      return;
    }

    const balanceRecord = this.getOrCreateBalance(userId);
    balanceRecord.balanceMinor += amount;

    const entry = this.createLedgerEntry({
      userId,
      roundId: null,
      betId: null,
      cashoutId: payoutId,
      entryType: "CREDIT",
      amountMinor: amount.toString(),
      idempotencyKey: buildPayoutCreditIdempotencyKey(payoutId)
    });

    this.creditIdempotency.set(payoutId, entry);
  }

  async creditDeposit(userId: string, amountMinor: string, depositId: string): Promise<void> {
    const amount = parseMinorUnits(amountMinor);
    if (amount <= 0n) {
      throw new Error("Deposit amount must be greater than zero");
    }
    if (this.depositIdempotency.has(depositId)) {
      return;
    }
    const balanceRecord = this.getOrCreateBalance(userId);
    balanceRecord.balanceMinor += amount;
    const entry = this.createLedgerEntry({
      userId,
      roundId: null,
      betId: `deposit:${depositId}`,
      cashoutId: null,
      entryType: "CREDIT",
      amountMinor: amount.toString(),
      idempotencyKey: buildDepositCreditIdempotencyKey(depositId)
    });
    this.depositIdempotency.set(depositId, entry);
  }

  async getLedgerEntries(filters?: { userId?: string; roundId?: string; entryType?: "DEBIT" | "CREDIT" }): Promise<unknown[]> {
    return this.ledger.filter((entry) => {
      if (filters?.userId && entry.userId !== filters.userId) return false;
      if (filters?.roundId && entry.roundId !== filters.roundId) return false;
      if (filters?.entryType && entry.entryType !== filters.entryType) return false;
      return true;
    });
  }

  private getOrCreateBalance(userId: string): WalletBalanceRecord {
    const existing = this.balances.get(userId);
    if (existing) {
      return existing;
    }
    const created = { userId, balanceMinor: DEFAULT_TEST_BALANCE_MINOR };
    this.balances.set(userId, created);
    return created;
  }

  private createLedgerEntry(input: Omit<InMemoryLedgerEntry, "ledgerEntryId" | "createdAt">): InMemoryLedgerEntry {
    const entry: InMemoryLedgerEntry = {
      ...input,
      ledgerEntryId: `ledger_${++this.ledgerSequence}`,
      createdAt: new Date()
    };
    this.ledger.push(entry);
    return entry;
  }
}
