import { describe, expect, it } from "vitest";
import { defaultCrashConfig } from "../src/config/gameConfig";
import { RoundStatus } from "../src/core/games/base/GameRound";
import { InMemoryCrashBetRepository } from "../src/core/games/crash/CrashBetRepository";
import { BetValidationError, CashoutValidationError, CrashBettingService } from "../src/core/games/crash/CrashBettingService";
import { CrashEngine } from "../src/core/games/crash/CrashEngine";
import { InMemoryWalletAdapter } from "../src/wallet/InMemoryWalletAdapter";
import { InsufficientBalanceError } from "../src/wallet/WalletErrors";
import { buildBetDebitIdempotencyKey, buildPayoutCreditIdempotencyKey } from "../src/wallet/WalletIdempotency";

async function buildContext() {
  const engine = new CrashEngine();
  await engine.init(defaultCrashConfig);
  const roundId = await engine.createRound();

  const wallet = new InMemoryWalletAdapter();
  wallet.seedBalance("u1", "100000");

  const repo = new InMemoryCrashBetRepository();
  const service = new CrashBettingService(defaultCrashConfig, engine, wallet, repo);

  return { engine, roundId, wallet, repo, service };
}

describe("Crash betting and wallet flows", () => {
  it("rejects insufficient balance", async () => {
    const { service, roundId } = await buildContext();
    await expect(service.placeBet({ userId: "u1", roundId, amountMinor: "200000" })).rejects.toBeInstanceOf(
      BetValidationError
    );
  });

  it("debits valid bet and duplicate debit stays idempotent", async () => {
    const { service, roundId, wallet } = await buildContext();

    const before = await wallet.getBalance("u1");
    const bet = await service.placeBet({ userId: "u1", roundId, amountMinor: "1000" });
    const after = await wallet.getBalance("u1");

    expect(BigInt(after)).toBe(BigInt(before) - 1000n);

    await wallet.reserveOrDebitBet("u1", "1000", bet.betId);
    const afterDuplicate = await wallet.getBalance("u1");
    expect(afterDuplicate).toBe(after);

    const entries = (await wallet.getLedgerEntries({ userId: "u1", entryType: "DEBIT" })) as Array<{ idempotencyKey: string }>;
    expect(entries).toHaveLength(1);
    expect(entries[0]?.idempotencyKey).toBe(buildBetDebitIdempotencyKey(bet.betId));
  });

  it("enforces min/max bet limits", async () => {
    const { service, roundId } = await buildContext();

    await expect(service.placeBet({ userId: "u1", roundId, amountMinor: "1" })).rejects.toBeInstanceOf(BetValidationError);
    await expect(service.placeBet({ userId: "u1", roundId, amountMinor: "100000001" })).rejects.toBeInstanceOf(BetValidationError);
  });

  it("cashout before crash succeeds and credits payout", async () => {
    const { service, roundId, engine, wallet } = await buildContext();

    await service.placeBet({ userId: "u1", roundId, amountMinor: "1000" });
    await engine.startRound(roundId);

    const beforeCashout = BigInt(await wallet.getBalance("u1"));
    const result = await service.requestCashout({ userId: "u1", roundId, requestTime: new Date(Date.now() + 500) });

    expect(result.status).toBe("CASHED_OUT");
    expect(result.payoutAmountMinor).not.toBeNull();

    const afterCashout = BigInt(await wallet.getBalance("u1"));
    expect(afterCashout).toBeGreaterThan(beforeCashout);
  });

  it("duplicate cashout rejected", async () => {
    const { service, roundId, engine } = await buildContext();

    await service.placeBet({ userId: "u1", roundId, amountMinor: "1000" });
    await engine.startRound(roundId);

    await service.requestCashout({ userId: "u1", roundId, requestTime: new Date(Date.now() + 100) });
    await expect(service.requestCashout({ userId: "u1", roundId, requestTime: new Date(Date.now() + 110) })).rejects.toBeInstanceOf(
      CashoutValidationError
    );
  });

  it("cashout after crash rejected", async () => {
    const { service, roundId, engine } = await buildContext();

    await service.placeBet({ userId: "u1", roundId, amountMinor: "1000" });
    await engine.startRound(roundId);
    await engine.processTick(roundId, new Date(Date.now() + 600_000));

    expect(await engine.getRoundStatus(roundId)).toBe(RoundStatus.CRASHED);

    await expect(service.requestCashout({ userId: "u1", roundId, requestTime: new Date(Date.now() + 600_100) })).rejects.toBeInstanceOf(
      CashoutValidationError
    );
  });

  it("losing bet gets no payout and ledger only has debit", async () => {
    const { service, roundId, engine, wallet, repo } = await buildContext();

    const bet = await service.placeBet({ userId: "u1", roundId, amountMinor: "1000" });
    await engine.startRound(roundId);
    await engine.processTick(roundId, new Date(Date.now() + 600_000));
    await service.markRoundLosses(roundId);

    const updated = await repo.getBetById(bet.betId);
    expect(updated?.status).toBe("LOST");
    expect(updated?.payoutAmountMinor).toBeNull();

    const entries = (await wallet.getLedgerEntries({ userId: "u1" })) as Array<{ entryType: string }>;
    expect(entries.filter((e) => e.entryType === "DEBIT")).toHaveLength(1);
    expect(entries.filter((e) => e.entryType === "CREDIT")).toHaveLength(0);
  });

  it("ledger entries created for debit and credit", async () => {
    const { service, roundId, engine, wallet } = await buildContext();

    await service.placeBet({ userId: "u1", roundId, amountMinor: "1000" });
    await engine.startRound(roundId);
    await service.requestCashout({ userId: "u1", roundId, requestTime: new Date(Date.now() + 200) });

    const entries = (await wallet.getLedgerEntries({ userId: "u1" })) as Array<{ entryType: string; idempotencyKey: string }>;
    expect(entries.some((e) => e.entryType === "DEBIT")).toBe(true);
    expect(entries.some((e) => e.entryType === "CREDIT")).toBe(true);
    expect(entries.every((e) => e.idempotencyKey.length > 0)).toBe(true);
  });

  it("duplicate credit same idempotency key does not credit twice", async () => {
    const wallet = new InMemoryWalletAdapter();
    wallet.seedBalance("u3", "100");

    await wallet.creditPayout("u3", "50", "payout_1");
    const afterFirst = await wallet.getBalance("u3");
    await wallet.creditPayout("u3", "50", "payout_1");
    const afterSecond = await wallet.getBalance("u3");

    expect(afterFirst).toBe("150");
    expect(afterSecond).toBe("150");

    const entries = (await wallet.getLedgerEntries({ userId: "u3", entryType: "CREDIT" })) as Array<{ idempotencyKey: string }>;
    expect(entries).toHaveLength(1);
    expect(entries[0]?.idempotencyKey).toBe(buildPayoutCreditIdempotencyKey("payout_1"));
  });

  it("markRoundLosses is idempotent when called twice", async () => {
    const { service, roundId, engine, repo } = await buildContext();
    const bet = await service.placeBet({ userId: "u1", roundId, amountMinor: "1000" });

    await engine.startRound(roundId);
    await engine.processTick(roundId, new Date(Date.now() + 600_000));

    await service.markRoundLosses(roundId);
    await service.markRoundLosses(roundId);

    const updated = await repo.getBetById(bet.betId);
    expect(updated?.status).toBe("LOST");
    expect(updated?.payoutAmountMinor).toBeNull();
  });

  it("markRoundLosses does not overwrite CASHED_OUT bets", async () => {
    const { service, roundId, engine, repo } = await buildContext();
    const bet = await service.placeBet({ userId: "u1", roundId, amountMinor: "1000" });
    await engine.startRound(roundId);

    await service.requestCashout({ userId: "u1", roundId, requestTime: new Date(Date.now() + 100) });
    await engine.processTick(roundId, new Date(Date.now() + 600_000));
    await service.markRoundLosses(roundId);

    const updated = await repo.getBetById(bet.betId);
    expect(updated?.status).toBe("CASHED_OUT");
    expect(updated?.payoutAmountMinor).not.toBeNull();
  });

  it("wallet exposes explicit insufficient balance rejection", async () => {
    const wallet = new InMemoryWalletAdapter();
    wallet.seedBalance("u2", "5");
    await expect(wallet.reserveOrDebitBet("u2", "10", "bet_insufficient")).rejects.toBeInstanceOf(InsufficientBalanceError);
  });

  it("wallet-domain error boundary works without importing in-memory implementation details", async () => {
    const engine = new CrashEngine();
    await engine.init(defaultCrashConfig);
    const roundId = await engine.createRound();
    const repo = new InMemoryCrashBetRepository();

    const walletPortOnly = {
      getBalance: async () => "0",
      reserveOrDebitBet: async () => {
        throw new InsufficientBalanceError();
      },
      creditPayout: async () => undefined,
      getLedgerEntries: async () => []
    };

    const service = new CrashBettingService(defaultCrashConfig, engine, walletPortOnly, repo);
    await expect(service.placeBet({ userId: "u1", roundId, amountMinor: "1000" })).rejects.toBeInstanceOf(BetValidationError);
  });
});
