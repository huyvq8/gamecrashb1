import { describe, expect, it, vi } from "vitest";
import { buildCrashApp } from "../src/app";
import { PlatformKernel } from "../src/core/platform/PlatformKernel";
import { createCrashGameModule } from "../src/core/games/crash/CrashModuleFactory";

describe("PlatformKernel", () => {
  it("registers and retrieves game modules", async () => {
    const start = vi.fn(async () => undefined);
    const stop = vi.fn(async () => undefined);

    const kernel = new PlatformKernel();
    kernel.registerGameModule({ gameKey: "alpha", start, stop });

    expect(kernel.getGameModule("alpha").gameKey).toBe("alpha");

    await kernel.startAll();
    await kernel.stopAll();

    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("crash module factory hooks runtime start/stop", async () => {
    const runtime = {
      start: vi.fn(async () => undefined),
      stop: vi.fn(() => undefined)
    };

    const module = createCrashGameModule({ runtime: runtime as never });
    await module.start();
    await module.stop();

    expect(module.gameKey).toBe("crash");
    expect(runtime.start).toHaveBeenCalledTimes(1);
    expect(runtime.stop).toHaveBeenCalledTimes(1);
  });

  it("buildCrashApp registers crash module in kernel", async () => {
    const appBundle = await buildCrashApp();
    expect(appBundle.kernel.getGameModule("crash").gameKey).toBe("crash");
    await appBundle.app.close();
  });
});
