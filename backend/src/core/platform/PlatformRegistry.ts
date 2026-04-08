import type { PlatformGameModule } from "./PlatformContracts";

export class PlatformRegistry {
  private readonly modules = new Map<string, PlatformGameModule>();

  register(module: PlatformGameModule): void {
    if (this.modules.has(module.gameKey)) {
      throw new Error(`Platform module already registered: ${module.gameKey}`);
    }
    this.modules.set(module.gameKey, module);
  }

  get(gameKey: string): PlatformGameModule {
    const module = this.modules.get(gameKey);
    if (!module) {
      throw new Error(`Platform module not found: ${gameKey}`);
    }
    return module;
  }

  list(): PlatformGameModule[] {
    return [...this.modules.values()];
  }
}
