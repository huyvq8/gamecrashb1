import { buildCrashApp } from "./app";

async function bootstrap(): Promise<void> {
  const { app, kernel } = await buildCrashApp();

  let runtimeStarted = false;
  let shuttingDown = false;

  try {
    const port = Number(process.env.PORT ?? process.env.HTTP_PORT ?? 3000);
    await app.listen({ port, host: "0.0.0.0" });
    console.log(`Server running on port ${port}`);

    await kernel.startAll();
    runtimeStarted = true;
  } catch (error) {
    if (runtimeStarted) {
      await kernel.stopAll();
    }
    await app.close();
    throw error;
  }

  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      if (runtimeStarted) {
        await kernel.stopAll();
      }
      await app.close();
      process.exit(0);
    } catch {
      process.exit(1);
    }
  };

  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });
}

void bootstrap();
