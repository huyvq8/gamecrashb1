import type { PlatformGameModule } from "../../platform/PlatformContracts";
import type { CrashRuntime } from "./runtime/CrashRuntime";

export interface CrashModuleServices {
  runtime: CrashRuntime;
}

export function createCrashGameModule(services: CrashModuleServices): PlatformGameModule {
  return {
    gameKey: "crash",
    async start() {
      await services.runtime.start();
    },
    async stop() {
      services.runtime.stop();
    }
  };
}
