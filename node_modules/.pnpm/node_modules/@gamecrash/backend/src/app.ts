import Fastify from "fastify";
import { Server as SocketIOServer } from "socket.io";
import { defaultCrashConfig } from "./config/gameConfig";
import { PlatformKernel } from "./core/platform/PlatformKernel";
import { InMemoryCrashBetRepository } from "./core/games/crash/CrashBetRepository";
import { CrashBettingService } from "./core/games/crash/CrashBettingService";
import { CrashEngine } from "./core/games/crash/CrashEngine";
import { createCrashGameModule } from "./core/games/crash/CrashModuleFactory";
import { CrashRuntime } from "./core/games/crash/runtime/CrashRuntime";
import { CrashHistoryStore } from "./core/games/crash/runtime/CrashHistoryStore";
import { RejectionTracker } from "./ops/RejectionTracker";
import { createServer } from "./api/createServer";
import { SocketIoRealtimeGateway } from "./realtime/SocketIoRealtimeGateway";
import { InMemoryWalletAdapter } from "./wallet/InMemoryWalletAdapter";

export async function buildCrashApp() {
  const kernel = new PlatformKernel();
  const engine = new CrashEngine();
  await engine.init(defaultCrashConfig);

  const wallet = new InMemoryWalletAdapter();
  const betRepository = new InMemoryCrashBetRepository();
  const historyStore = new CrashHistoryStore();
  const rejectionTracker = new RejectionTracker();

  const bettingService = new CrashBettingService(defaultCrashConfig, engine, wallet, betRepository);
  const app = Fastify();
  const io = new SocketIOServer(app.server, { cors: { origin: "*" } });
  const realtime = new SocketIoRealtimeGateway(io);

  const runtime = new CrashRuntime(defaultCrashConfig, engine, bettingService, betRepository, historyStore, realtime);
  kernel.registerGameModule(createCrashGameModule({ runtime }));

  createServer({
    app,
    runtime,
    historyStore,
    bettingService,
    betRepository,
    wallet,
    realtime,
    rejectionTracker
  });

  return { app, runtime, io, wallet, kernel };
}
