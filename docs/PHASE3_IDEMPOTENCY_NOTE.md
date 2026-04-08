# Phase 3 Idempotency Semantics

## Idempotency key formats

- Bet debit key format: `bet:debit:<bet_id>`
- Payout credit key format: `payout:credit:<payout_id>`

## Duplicate behavior

- A duplicate debit request with the same `bet_id` is a no-op:
  - balance is not decremented again
  - no additional ledger row is created
- A duplicate credit request with the same `payout_id` is a no-op:
  - balance is not incremented again
  - no additional ledger row is created

## Loss handling behavior

- `markRoundLosses(roundId)` updates only bets currently in `ACTIVE` status.
- Already `LOST` bets remain unchanged.
- `CASHED_OUT` bets are never overwritten to `LOST`.
- No ledger entries are created for losses in current contract.
