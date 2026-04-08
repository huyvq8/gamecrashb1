# Phase 0 — Repo Audit & Implementation Plan

## Repository audit summary

- Repository is effectively empty except for `.gitkeep` and git metadata.
- No existing backend, frontend, database schema, or tests were found.
- No reusable in-repo game modules currently exist.

## Stack decision (based on repo reality)

Because the repository is empty, use a pragmatic MVP stack aligned with requested defaults:

- **Backend:** Node.js + TypeScript + Fastify
- **Realtime:** Socket.IO (server + browser client)
- **Persistence:** SQLite (MVP) with Prisma ORM for typed schema, migrations, and transactional behavior
- **Money math:** integer minor units (`bigint` for internal calculations where needed)
- **Validation:** Zod
- **Testing:** Vitest (unit/integration) + Supertest for API tests
- **Frontend:** React + Vite + TypeScript
- **Shared contracts:** `shared/` package for DTO/event/type consistency between backend and frontend

Rationale:
- Fast to bootstrap from zero while preserving production-credible patterns.
- Strong typing and schema safety across API, realtime, and persistence.
- SQLite is sufficient for MVP while retaining an easy migration path to PostgreSQL.

## High-level architecture plan

### Monorepo layout

```text
/backend
/frontend
/shared
/docs
```

### Backend module boundaries

```text
/backend/src
  /core
    /games/base        # reusable game interfaces and lifecycle contracts
    /games/crash       # crash-specific engine/math/rng/service
  /wallet              # wallet adapter + ledger service
  /realtime            # realtime gateway abstraction and Socket.IO adapter
  /config              # zod-validated config loader
  /telemetry           # structured game event logger
  /api                 # route handlers and request validation
  /db                  # prisma client + repositories
  /admin               # lightweight game config/ops endpoints
```

### Data model (MVP)

- `users`
- `game_rounds`
- `bets`
- `cashouts`
- `ledger_entries`
- `game_events`
- `game_config_snapshots`

### Reusable framework contracts to implement in Phase 1

1. `GameEngine` base contract and round lifecycle interfaces
2. `WalletAdapter` + `BalanceLedger` contracts
3. `RealtimeGateway` contract
4. repository contracts for rounds/bets/cashouts/events
5. `GameRegistry` for pluggable game engines

## Lifecycle/state machine design target

- `BETTING_OPEN` → `IN_PROGRESS` → `CRASHED` → `SETTLED`
- Single active round per game key
- Deterministic tick processing from server monotonic clock
- Cashout accepted only while `IN_PROGRESS` and before crash boundary
- Idempotent/atomic bet state transitions to prevent duplicate cashouts

## Economics and fairness plan

- Config-driven crash distribution with weighted buckets:
  - 60%: 1.00–2.00
  - 25%: 2.00–5.00
  - 10%: 5.00–20.00
  - 4%: 20.00–100.00
  - 1%: >100.00 (capped configurable upper bound in MVP)
- House edge configurable and applied in crash generation strategy layer
- Dedicated `CrashRng` module with testable seeded RNG abstraction
- Placeholder fairness fields for server seed hash / future commit-reveal flow

## Delivery plan by phase

- **Phase 1:** contracts, schemas, config, state machine doc
- **Phase 2:** crash engine core, RNG, multiplier growth, round persistence
- **Phase 3:** betting/cashout, wallet debit/credit, ledger, race protections
- **Phase 4:** HTTP + websocket realtime event flow, history/state endpoints, ops endpoint
- **Phase 5:** minimal functional frontend for betting/cashout and live round state
- **Phase 6:** full required tests + hardening pass
- **Phase 7:** extract/verify reusable platform primitives and game registration path
- **Phase 8:** final readiness report, risk analysis, extension roadmap

## Phase 0 explicit non-implementation

- No runtime server/frontend code implemented.
- No database schema or migrations implemented yet.
- No tests implemented yet.

## Planned run/test commands for upcoming phases

Bootstrap/run (after Phase 1+ setup):

```bash
pnpm install
pnpm -r build
pnpm --filter backend dev
pnpm --filter frontend dev
```

Test commands (to be enabled by Phase 2+):

```bash
pnpm --filter backend test
pnpm --filter backend test:coverage
pnpm --filter frontend test
pnpm -r lint
pnpm -r typecheck
```
