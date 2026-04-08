import type { PlatformGameModule } from "./PlatformContracts";
import { PlatformRegistry } from "./PlatformRegistry";

export class PlatformKernel {
  private readonly registry = new PlatformRegistry();

  registerGameModule(module: PlatformGameModule): void {
    this.registry.register(module);
  }

  getGameModule(gameKey: string): PlatformGameModule {
    return this.registry.get(gameKey);
  }

  async startAll(): Promise<void> {
    for (const module of this.registry.list()) {
      await module.start();
    }
  }

  async stopAll(): Promise<void> {
    for (const module of this.registry.list()) {
      await module.stop();
    }
  }
}
