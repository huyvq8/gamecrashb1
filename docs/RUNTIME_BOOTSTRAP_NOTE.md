# Runtime Bootstrap Note

## Server start location

Backend service bootstrap is in `backend/src/index.ts`.

It builds dependencies with:

`buildCrashApp()`

Then starts Fastify on:

`0.0.0.0:3000`

## Runtime loop activation

`kernel.startAll()` is called once after `app.listen(...)` succeeds.

This triggers the Crash runtime loop via the registered crash module.

## Graceful shutdown

`SIGINT` and `SIGTERM` are handled in `backend/src/index.ts`.

Shutdown flow:

1. `kernel.stopAll()`
2. `app.close()`
3. `process.exit(...)`

A guard prevents duplicate shutdown execution.
