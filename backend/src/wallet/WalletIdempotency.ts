export const WALLET_IDEMPOTENCY_PREFIX = {
  BET_DEBIT: "bet:debit",
  PAYOUT_CREDIT: "payout:credit"
} as const;

export function buildBetDebitIdempotencyKey(betId: string): string {
  return `${WALLET_IDEMPOTENCY_PREFIX.BET_DEBIT}:${betId}`;
}

export function buildPayoutCreditIdempotencyKey(payoutId: string): string {
  return `${WALLET_IDEMPOTENCY_PREFIX.PAYOUT_CREDIT}:${payoutId}`;
}
