import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { CrashBetRepository } from "../core/games/crash/CrashBetRepository";
import { BetValidationError, CashoutValidationError, type CrashBettingService } from "../core/games/crash/CrashBettingService";
import type { CrashRuntime } from "../core/games/crash/runtime/CrashRuntime";
import type { CrashHistoryStore } from "../core/games/crash/runtime/CrashHistoryStore";
import type { RealtimeGateway } from "../realtime/RealtimeGateway";
import type { WalletAdapter } from "../wallet/WalletAdapter";
import type { RejectionTracker } from "../ops/RejectionTracker";

const betBodySchema = z.object({
  userId: z.string().min(1),
  roundId: z.string().min(1),
  amountMinor: z.string().regex(/^\d+$/)
});

const cashoutBodySchema = z.object({
  userId: z.string().min(1),
  roundId: z.string().min(1)
});

const balanceQuerySchema = z.object({
  userId: z.string().min(1)
});

const ledgerEntrySchema = z.object({
  ledgerEntryId: z.string(),
  userId: z.string(),
  roundId: z.string().nullable(),
  betId: z.string().nullable(),
  cashoutId: z.string().nullable(),
  entryType: z.enum(["DEBIT", "CREDIT"]),
  amountMinor: z.string(),
  idempotencyKey: z.string(),
  createdAt: z.coerce.date()
});

export function createServer(deps: {
  app?: FastifyInstance;
  runtime: CrashRuntime;
  historyStore: CrashHistoryStore;
  bettingService: CrashBettingService;
  betRepository: CrashBetRepository;
  wallet: WalletAdapter;
  realtime: RealtimeGateway;
  rejectionTracker: RejectionTracker;
}) {
  const app = deps.app ?? Fastify();

  app.get("/game/crash/state", async () => {
    const snapshot = await deps.runtime.getDebugSnapshot();
    return {
      source: "in_memory",
      activeRound: snapshot.activeRound,
      activeBetsCount: snapshot.activeBetsCount
    };
  });

  app.get("/game/crash/history", async () => {
    return {
      source: "in_memory_runtime_history",
      windowLimit: deps.historyStore.getLimit(),
      rounds: deps.historyStore.list()
    };
  });

  app.post("/game/crash/bet", async (request, reply) => {
    const parsed = betBodySchema.safeParse(request.body);
    if (!parsed.success) {
      deps.rejectionTracker.increment("bet_invalid_payload");
      return reply.status(400).send({ error: "invalid_payload", message: parsed.error.message });
    }

    try {
      const bet = await deps.bettingService.placeBet(parsed.data);
      return reply.status(201).send({ bet });
    } catch (error) {
      if (error instanceof BetValidationError) {
        deps.rejectionTracker.increment(`bet_rejected:${error.message}`);
        return reply.status(409).send({ error: "bet_rejected", message: error.message });
      }
      throw error;
    }
  });

  app.post("/game/crash/cashout", async (request, reply) => {
    const parsed = cashoutBodySchema.safeParse(request.body);
    if (!parsed.success) {
      deps.rejectionTracker.increment("cashout_invalid_payload");
      return reply.status(400).send({ error: "invalid_payload", message: parsed.error.message });
    }

    try {
      const bet = await deps.bettingService.requestCashout({
        userId: parsed.data.userId,
        roundId: parsed.data.roundId,
        requestTime: new Date()
      });
      await deps.realtime.publishEvent("CASHOUT_ACCEPTED", {
        gameKey: "crash",
        roundId: bet.roundId,
        userId: bet.userId,
        betId: bet.betId,
        payoutAmountMinor: bet.payoutAmountMinor,
        cashoutMultiplier: bet.cashoutMultiplier
      });

      return reply.status(200).send({ bet });
    } catch (error) {
      if (error instanceof CashoutValidationError) {
        deps.rejectionTracker.increment(`cashout_rejected:${error.message}`);
        return reply.status(409).send({ error: "cashout_rejected", message: error.message });
      }
      throw error;
    }
  });

  app.get("/wallet/balance", async (request, reply) => {
    const parsed = balanceQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_query", message: parsed.error.message });
    }

    const balanceMinor = await deps.wallet.getBalance(parsed.data.userId);
    const rawLedgerEntries = await deps.wallet.getLedgerEntries({ userId: parsed.data.userId });
    const ledgerEntries = z.array(ledgerEntrySchema).safeParse(rawLedgerEntries);
    return {
      userId: parsed.data.userId,
      balanceMinor,
      ledgerEntries: ledgerEntries.success ? ledgerEntries.data : []
    };
  });

  app.get("/ops/crash/debug", async () => {
    const snapshot = await deps.runtime.getDebugSnapshot();
    const activeRound = snapshot.activeRound;
    return {
      source: "in_memory_runtime_debug",
      historyWindowLimit: deps.historyStore.getLimit(),
      activeRoundId: activeRound?.roundId ?? null,
      activeRoundStatus: activeRound?.status ?? null,
      activeRound,
      activeBetsCount: snapshot.activeBetsCount,
      recentCrashMultipliers: snapshot.recentCrashMultipliers,
      rejectionCounts: deps.rejectionTracker.snapshot()
    };
  });

  app.setErrorHandler((error, _request, reply) => {
    reply.status(500).send({
      error: "internal_error",
      message: error.message || "Unexpected server error"
    });
  });

  return app;
}
