# Phase 4 Runtime + Realtime Note

## Hosting model

- Fastify HTTP server and Socket.IO share the same underlying Node server (`app.server`).
- Runtime ownership is backend-only; frontend does not drive lifecycle timing or outcomes.

## Runtime loop ownership

- `CrashRuntime` is the single-process orchestrator for:
  - round creation/open betting
  - betting close/start
  - multiplier tick progression
  - crash detection boundary
  - settlement and next-round rotation

## Event emission sources

- Lifecycle events (`ROUND_CREATED`, `BETTING_OPEN`, `ROUND_STARTED`, `MULTIPLIER_TICK`, `ROUND_CRASHED`, `ROUND_SETTLED`) are emitted by backend runtime transitions.
- `CASHOUT_ACCEPTED` is emitted only from successful backend cashout handling.

## In-memory limitations (explicit)

- `/game/crash/history` is in-memory runtime history only (bounded window).
- `/ops/crash/debug` is in-memory debug snapshot only.
- No claim of durable persistence is made in Phase 4.
