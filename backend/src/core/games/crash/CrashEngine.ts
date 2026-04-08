import type { GameEngine } from "../base/GameEngine";
import type { CrashGameConfig } from "./CrashContracts";

export class CrashEngine implements GameEngine<CrashGameConfig> {
  async init(_config: CrashGameConfig): Promise<void> {
    throw new Error("Not implemented in Phase 1");
  }
  async createRound(): Promise<string> {
    throw new Error("Not implemented in Phase 1");
  }
  async openBetting(_roundId: string): Promise<void> {
    throw new Error("Not implemented in Phase 1");
  }
  async closeBetting(_roundId: string): Promise<void> {
    throw new Error("Not implemented in Phase 1");
  }
  async startRound(_roundId: string): Promise<void> {
    throw new Error("Not implemented in Phase 1");
  }
  async processTick(_roundId: string, _now: Date): Promise<void> {
    throw new Error("Not implemented in Phase 1");
  }
  async requestCashout(_userId: string, _roundId: string, _requestTime: Date): Promise<void> {
    throw new Error("Not implemented in Phase 1");
  }
  async settleRound(_roundId: string): Promise<void> {
    throw new Error("Not implemented in Phase 1");
  }
  async getRoundStatus(_roundId: string) {
    throw new Error("Not implemented in Phase 1");
  }
}
