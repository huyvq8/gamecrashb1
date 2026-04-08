import type { GameEngine } from "./GameEngine";

export class GameRegistry {
  private readonly engines = new Map<string, GameEngine<unknown>>();

  register(gameKey: string, engine: GameEngine<unknown>): void {
    if (this.engines.has(gameKey)) {
      throw new Error(`Game engine already registered: ${gameKey}`);
    }

    this.engines.set(gameKey, engine);
  }

  get(gameKey: string): GameEngine<unknown> {
    const engine = this.engines.get(gameKey);
    if (!engine) {
      throw new Error(`Game engine not found: ${gameKey}`);
    }

    return engine;
  }

  listGameKeys(): string[] {
    return Array.from(this.engines.keys());
  }
}
