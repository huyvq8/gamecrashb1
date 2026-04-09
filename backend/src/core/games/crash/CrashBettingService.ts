import { RoundStatus } from "../base/GameRound";
import type { CrashEngine } from "./CrashEngine";
import { crashMathInternals, multiplierAtElapsedMs } from "./CrashMath";
import type { CrashBetRecord, CrashBetRepository } from "./CrashBetRepository";
import type { CrashGameConfig } from "./CrashContracts";
import type { WalletAdapter } from "../../../wallet/WalletAdapter";
import { InsufficientBalanceError } from "../../../wallet/WalletErrors";

export class BetValidationError extends Error {}
export class CashoutValidationError extends Error {}

function parseMinorUnits(value: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new BetValidationError("Amount must be a positive integer minor-unit string");
  }
  return BigInt(value);
}

function parseMultiplierToScaled(value: string): bigint {
  return crashMathInternals.parseMultiplierToScaled(value);
}

function multiplierScaledToPayout(amountMinor: bigint, multiplierScaled: bigint): bigint {
  return (amountMinor * multiplierScaled) / crashMathInternals.MULTIPLIER_SCALE;
}

export class CrashBettingService {
  private betSequence = 0;
  private cashoutSequence = 0;

  constructor(
    private readonly config: CrashGameConfig,
    private readonly engine: CrashEngine,
    private readonly wallet: WalletAdapter,
    private readonly betRepository: CrashBetRepository
  ) {}

  async placeBet(input: { userId: string; roundId: string; amountMinor: string }): Promise<CrashBetRecord> {
    const amountMinor = parseMinorUnits(input.amountMinor);
    const minBet = parseMinorUnits(this.config.minBetMinor);
    const maxBet = parseMinorUnits(this.config.maxBetMinor);

    if (amountMinor <= 0n) {
      throw new BetValidationError("Bet amount must be greater than zero");
    }
    if (amountMinor < minBet) {
      throw new BetValidationError("Bet amount below minimum");
    }
    if (amountMinor > maxBet) {
      throw new BetValidationError("Bet amount above maximum");
    }

    const round = this.engine.getRoundSnapshot(input.roundId);
    if (round.status !== RoundStatus.BETTING_OPEN) {
      throw new BetValidationError("Betting window closed");
    }

    if (round.bettingCloseAt.getTime() <= Date.now() || round.bettingClosedAt) {
      throw new BetValidationError("Betting window closed");
    }

    const existing = await this.betRepository.getActiveBet(input.userId, input.roundId);
    if (existing) {
      throw new BetValidationError("User already has an active bet for this round");
    }

    const betId = `bet_${++this.betSequence}`;
    try {
      await this.wallet.reserveOrDebitBet(input.userId, amountMinor.toString(), betId);
    } catch (error) {
      if (error instanceof InsufficientBalanceError) {
        throw new BetValidationError("Insufficient balance");
      }
      throw error;
    }

    const record: CrashBetRecord = {
      betId,
      userId: input.userId,
      roundId: input.roundId,
      amountMinor: amountMinor.toString(),
      placedAt: new Date(),
      status: "ACTIVE",
      cashoutMultiplier: null,
      payoutAmountMinor: null,
      rejectionReason: null,
      cashoutId: null
    };

    await this.betRepository.createBet(record);
    return record;
  }

  /**
   * Change stake for an existing ACTIVE bet while the round is still BETTING_OPEN.
   * Refunds the old debit and applies the new one (same betId).
   */
  async replaceBet(input: { userId: string; roundId: string; amountMinor: string }): Promise<CrashBetRecord> {
    const amountMinor = parseMinorUnits(input.amountMinor);
    const minBet = parseMinorUnits(this.config.minBetMinor);
    const maxBet = parseMinorUnits(this.config.maxBetMinor);

    if (amountMinor <= 0n) {
      throw new BetValidationError("Bet amount must be greater than zero");
    }
    if (amountMinor < minBet) {
      throw new BetValidationError("Bet amount below minimum");
    }
    if (amountMinor > maxBet) {
      throw new BetValidationError("Bet amount above maximum");
    }

    const round = this.engine.getRoundSnapshot(input.roundId);
    if (round.status !== RoundStatus.BETTING_OPEN) {
      throw new BetValidationError("Betting window closed");
    }

    if (round.bettingCloseAt.getTime() <= Date.now() || round.bettingClosedAt) {
      throw new BetValidationError("Betting window closed");
    }

    const existing = await this.betRepository.getActiveBet(input.userId, input.roundId);
    if (!existing) {
      throw new BetValidationError("No active bet to replace");
    }

    if (existing.amountMinor === amountMinor.toString()) {
      return existing;
    }

    const previousAmountMinor = existing.amountMinor;

    await this.wallet.refundBetDebit(input.userId, existing.betId);
    try {
      await this.wallet.reserveOrDebitBet(input.userId, amountMinor.toString(), existing.betId);
    } catch (error) {
      try {
        await this.wallet.reserveOrDebitBet(input.userId, previousAmountMinor, existing.betId);
      } catch {
        // Best-effort restore; wallet may be inconsistent — surface original error
      }
      if (error instanceof InsufficientBalanceError) {
        throw new BetValidationError("Insufficient balance");
      }
      throw error;
    }

    const updated: CrashBetRecord = {
      ...existing,
      amountMinor: amountMinor.toString()
    };
    await this.betRepository.updateBet(updated);
    return updated;
  }

  async requestCashout(input: { userId: string; roundId: string; requestTime: Date }): Promise<CrashBetRecord> {
    const round = this.engine.getRoundSnapshot(input.roundId);
    if (round.status !== RoundStatus.IN_PROGRESS) {
      throw new CashoutValidationError("Round is not in progress");
    }
    if (!round.crashMultiplier) {
      throw new CashoutValidationError("Round crash multiplier unavailable");
    }
    if (round.startTimeMs === null) {
      throw new CashoutValidationError("Round start time unavailable");
    }

    const activeBet = await this.betRepository.getActiveBet(input.userId, input.roundId);
    if (!activeBet) {
      throw new CashoutValidationError("No active bet found for user in round");
    }

    if (activeBet.status !== "ACTIVE") {
      throw new CashoutValidationError("Bet is not active");
    }

    if (activeBet.cashoutId) {
      throw new CashoutValidationError("Duplicate cashout rejected");
    }

    const elapsedMs = BigInt(Math.max(0, input.requestTime.getTime() - round.startTimeMs));
    const currentMultiplier = multiplierAtElapsedMs(elapsedMs);

    if (parseMultiplierToScaled(currentMultiplier) >= parseMultiplierToScaled(round.crashMultiplier)) {
      throw new CashoutValidationError("Cashout rejected: round already crashed");
    }

    const payoutMinor = multiplierScaledToPayout(
      BigInt(activeBet.amountMinor),
      parseMultiplierToScaled(currentMultiplier)
    );
    const cashoutId = `cashout_${++this.cashoutSequence}`;
    await this.wallet.creditPayout(input.userId, payoutMinor.toString(), cashoutId);

    const updated: CrashBetRecord = {
      ...activeBet,
      status: "CASHED_OUT",
      cashoutMultiplier: currentMultiplier,
      payoutAmountMinor: payoutMinor.toString(),
      cashoutId
    };

    await this.betRepository.updateBet(updated);
    return updated;
  }

  async markRoundLosses(roundId: string): Promise<void> {
    const bets = await this.betRepository.listRoundBets(roundId);
    for (const bet of bets) {
      if (bet.status !== "ACTIVE") {
        continue;
      }
      await this.betRepository.updateBet({
        ...bet,
        status: "LOST",
        payoutAmountMinor: null,
        cashoutMultiplier: null,
        cashoutId: null
      });
    }
  }
}
