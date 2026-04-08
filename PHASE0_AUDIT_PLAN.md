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

## Architecture decisions (explicit)

1. **Fastify over Express/Nest**
   - Fastify provides strong performance, typed schema integration, and a thin abstraction suitable for explicit, testable service boundaries.
   - Express is viable but requires more manual typing/validation discipline for the same guardrails.
   - Nest is powerful but introduces higher framework overhead for a greenfield MVP where explicit module ownership is preferred.

2. **Socket.IO over native `ws`**
   - Socket.IO gives reliable reconnect semantics, room-based fanout, and event namespacing out of the box.
   - Native `ws` is lighter, but would require building reliability/reconnect/session conventions manually for the same operator experience.

3. **Prisma + SQLite for MVP**
   - Prisma provides typed client access, migrations, and transactional API safety suitable for money-affecting state updates.
   - SQLite reduces operational setup for MVP while still supporting transactional correctness.
   - Schema/migration design will stay PostgreSQL-compatible to allow a straightforward promotion path.

4. **Modular monolith over microservices**
   - Current scope is one real-time game with strict consistency requirements; cross-service split would add avoidable operational and consistency complexity.
   - A modular monolith preserves clear boundaries (`core`, `wallet`, `realtime`, `api`, `db`) while keeping round/bet/cashout consistency in-process.
   - Extraction to services remains possible later once load and domain boundaries justify it.

## High-level architecture plan

### Monorepo layout

```text
/workspace/gamecrashb1
  /backend
  /frontend
  /shared
  /docs
  PHASE0_AUDIT_PLAN.md
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

### Frontend folder plan (Phase 5 target)

```text
/frontend/src
  /components
    CrashGame.tsx
    BetPanel.tsx
    MultiplierDisplay.tsx
    RoundTimeline.tsx
    RecentRounds.tsx
    BalancePanel.tsx
  /lib
    apiClient.ts
    socketClient.ts
  /types
  main.tsx
```

### Shared contracts folder plan

```text
/shared/src
  /contracts
    api.ts
    events.ts
    rounds.ts
    bets.ts
    wallet.ts
  index.ts
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

### Explicit state machine rules

- Allowed transitions:
  - `BETTING_OPEN -> IN_PROGRESS`
  - `IN_PROGRESS -> CRASHED`
  - `CRASHED -> SETTLED`
- Forbidden transitions:
  - `BETTING_OPEN -> CRASHED` (must pass through `IN_PROGRESS`)
  - `BETTING_OPEN -> SETTLED`
  - `IN_PROGRESS -> SETTLED` (must pass through `CRASHED`)
  - Any transition out of `SETTLED`
- Any invalid transition request must be rejected and logged as an error-level game event.

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

## Money-safety decisions

- No floating-point arithmetic for bet, payout, balance, or ledger writes.
- Canonical amount representation: integer minor units (`bigint` in domain logic, persisted as integer-compatible columns/strings as needed by ORM constraints).
- Multiplier math may use decimal library for deterministic rounding, but final payouts are converted with explicit rounding policy to minor units before persistence.
- Idempotency requirements:
  - `reserveOrDebitBet(user_id, amount, bet_id)` must be idempotent by `bet_id`.
  - `creditPayout(user_id, amount, payout_id)` must be idempotent by `payout_id`.
  - Duplicate cashout requests must return prior terminal result without creating duplicate credits.
- Every money mutation must emit matching ledger and telemetry entries.

## Race-condition strategy

- Server-authoritative timing rule:
  - All decisions use server time only; client timestamps are ignored for settlement truth.
- Cashout vs crash boundary:
  - A cashout is valid only if processed before server-observed crash boundary for the active round.
  - If boundary is reached first, bet transitions to `LOST` and cashout is rejected.
- Atomic update approach:
  - Cashout uses conditional atomic update (`status=ACTIVE` precondition) in a DB transaction.
  - Crash resolution atomically marks remaining `ACTIVE` bets as `LOST`.
  - Transaction ordering ensures one terminal bet outcome: `CASHED_OUT` or `LOST`, never both.

## Config ownership decisions

- Source of truth location: backend config module (`/backend/src/config/gameConfig.ts`) with schema validation at process startup.
- Runtime tunables (house edge, min/max bet, timing windows, crash distribution buckets) are loaded from config and exposed read-only to engine modules.
- Each round snapshots effective config (`config_snapshot`) into persistent round record to guarantee replayability/auditability even if live config later changes.

## Fairness placeholder design

- Fields stored now per round:
  - `rng_seed_ref` (opaque seed identifier/reference)
  - `server_seed_hash` (optional commit hash placeholder)
  - `fairness_version` (algorithm/version tag)
  - `config_snapshot` (inputs used for outcome generation)
- Future commit-reveal extension path:
  - Pre-round: publish `hash(server_seed)` as commitment.
  - Post-round/periodic: reveal `server_seed` and optional `client_seed` mixing strategy.
  - Verification tool recomputes crash outcome from revealed seeds + versioned algorithm and compares against stored `crash_multiplier`.

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

## Phase 0 run/test commands (audit only)

Runtime commands are **N/A in Phase 0** because no backend/frontend project scaffolding exists yet.

Executed inspection commands:

```bash
pwd && rg --files | head -n 50
find .. -maxdepth 3 -name AGENTS.md -print
ls -la
git status --short && git branch --show-current
nl -ba PHASE0_AUDIT_PLAN.md | sed -n '1,220p'
```

Future test commands (post-implementation phases):

```bash
pnpm --filter backend test
pnpm --filter backend test:coverage
pnpm --filter frontend test
pnpm -r lint
pnpm -r typecheck
```
