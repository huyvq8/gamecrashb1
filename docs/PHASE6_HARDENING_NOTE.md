# Phase 6 Hardening Note

## Backend hardening

- Unified internal error normalization through Fastify error handler (`internal_error` contract).
- Tightened wallet balance response typing by validating/normalizing ledger payload shape before returning.
- Fixed stale active-round edge by clearing runtime current round on settle/stop and avoiding settled round exposure as active.

## Frontend hardening

- Moved demo user identity to explicit runtime config (`runtimeConfig.demoUserId`).
- Added reconnect and reconnect-error state reconciliation hooks to refresh backend truth.
- Reconciled stale local UI state on refresh:
  - reset multiplier to authoritative settled/crashed value or base value
  - clear stale active bet when backend no longer reports in-progress round
- Kept disabled/loading/error behavior explicit and deterministic.

## Limitations intentionally unchanged

- In-memory runtime/history/debug only.
- No DB persistence claims.
- No on-chain/provably-fair changes.
