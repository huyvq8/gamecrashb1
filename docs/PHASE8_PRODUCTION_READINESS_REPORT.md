# Phase 8 — Production Readiness Report (Crash MVP)

## 1) System overview

### Engine
- `CrashEngine` is backend-authoritative for round lifecycle transitions and crash boundary checks.
- Deterministic crash outcome generation is provided by `DeterministicCrashRng`.
- Multiplier progression is deterministic and server-time driven via `CrashMath`.

### Wallet / ledger
- `InMemoryWalletAdapter` uses integer minor units (`bigint`) for debits/credits.
- Debit/credit idempotency is keyed by bet/payout IDs.
- Ledger entries are emitted for bet debit and payout credit.

### Runtime loop
- `CrashRuntime` controls round creation/open/start/tick/crash/settle and rotation.
- Runtime emits lifecycle events and records recent in-memory settled history.

### API
- Fastify routes expose state/history/bet/cashout/balance/debug.
- Input validation uses Zod; invalid payloads are rejected with explicit error shapes.

### Realtime
- Socket.IO gateway emits lifecycle and cashout-accepted events from backend transitions.
- In-memory gateway is available for tests.

### Frontend
- React MVP screen subscribes to backend APIs + realtime events.
- UI reconciles to backend truth and does not compute authoritative payout.

### Platform kernel
- `PlatformKernel` + `PlatformRegistry` + `PlatformGameModule` provide reusable game registration/lifecycle scaffolding.
- Crash is integrated as reference module via `createCrashGameModule`.

## 2) Known limitations

- Runtime and history are in-memory only.
- No durable DB-backed persistence is active for rounds/bets/ledger/runtime state.
- Single-process assumptions (no distributed coordination).
- No auth/user identity assurance beyond demo user approach.
- No rate limiting / anti-abuse middleware.
- No on-chain settlement/withdrawal.

## 3) Exploit / abuse vectors

- **Cashout boundary contention:** requests near crash boundary can stress timing consistency.
- **Replay/high-frequency request spam:** repeated bet/cashout attempts can load API path.
- **HTTP abuse:** no throttling means bots can flood endpoints.
- **WebSocket abuse:** excessive connections/subscriptions can consume memory/CPU.
- **Client manipulation:** users can forge UI state, but backend authority limits outcome fraud.
- **Restart loss risk:** process restart can lose in-memory balances/round/bet state.

## 4) Money safety review

- Idempotency exists for debit and credit operations via explicit keying conventions.
- Duplicate debit/credit requests do not mutate balances twice in wallet adapter.
- Loss handling marks only `ACTIVE` bets as `LOST`; `CASHED_OUT` bets are preserved.
- No payout on loss path is enforced.
- Ledger consistency is currently in-memory and process-local; crash/restart durability is not guaranteed.

## 5) Runtime risks

- **Restart behavior:** active round and pending bet state are lost without persistence.
- **Process crash mid-round:** no durable recovery/reconciliation state machine yet.
- **Memory growth risk:** long uptime with heavy traffic requires profiling/retention limits.
- **Timer drift:** event loop lag may impact tick cadence under load.

## 6) Scaling considerations

### ~100 users
- Likely acceptable on single process if request bursts are moderate.

### ~1,000 users
- Increased CPU pressure from tick fanout, JSON serialization, and event broadcasting.
- In-memory structures and single runtime loop become operationally fragile without observability.

### ~10,000 users
- Single-process model likely breaks (WS fanout, memory pressure, timer precision degradation).
- Horizontal scaling requires shared state, distributed pub/sub, and authoritative runtime partitioning.

### WebSocket scaling
- Requires connection limits, heartbeat tuning, backpressure handling, and likely pub/sub broker.

### Runtime loop bottlenecks
- Tick processing + event emission + round transitions centralized in one process.
- Needs metrics and bounded work per tick before high concurrency rollout.

## 7) Next-step roadmap

1. **Durable persistence activation**
   - Move runtime-critical state (rounds, bets, cashouts, ledger, events) to DB-backed repositories.
2. **Auth/user model**
   - Real user/session identity and authorization checks on money actions.
3. **Withdrawal/claim system**
   - Off-chain custody controls or on-chain settlement flow (with policy + audit).
4. **Provably fair**
   - Commit-reveal seed publication, verification tooling, algorithm versioning.
5. **Multi-game expansion**
   - Add second game module via kernel path to validate extracted framework in practice.
6. **Monitoring and alerting**
   - Structured logs, metrics, SLOs, anomaly alerts, incident playbooks.

## 8) Minimal production checklist

### MUST before real-money launch
- Enable durable persistence for balances/ledger/rounds/bets/cashouts/events.
- Add authentication, authorization, and user ownership checks.
- Add rate limiting and abuse controls for HTTP + WebSocket.
- Add reconciliation/recovery logic for restarts and partial failures.
- Add full integration/load testing and chaos/restart testing.
- Add audit/compliance logging and immutable money-movement traceability.
- Add secrets management and secure deployment baseline.

### Can wait (post-launch hardening if launch scope is constrained)
- Additional game modes.
- UI polish/advanced visualizations.
- Advanced analytics dashboards beyond core operational metrics.
