export const WALLET_IDEMPOTENCY_PREFIX = {
  BET_DEBIT: "bet:debit",
  BET_REFUND_CREDIT: "bet:refund",
  PAYOUT_CREDIT: "payout:credit",
  DEPOSIT_CREDIT: "deposit:credit"
} as const;

export function buildBetDebitIdempotencyKey(betId: string): string {
  return `${WALLET_IDEMPOTENCY_PREFIX.BET_DEBIT}:${betId}`;
}

export function buildBetRefundCreditIdempotencyKey(betId: string): string {
  return `${WALLET_IDEMPOTENCY_PREFIX.BET_REFUND_CREDIT}:${betId}`;
}

export function buildPayoutCreditIdempotencyKey(payoutId: string): string {
  return `${WALLET_IDEMPOTENCY_PREFIX.PAYOUT_CREDIT}:${payoutId}`;
}

export function buildDepositCreditIdempotencyKey(depositId: string): string {
  return `${WALLET_IDEMPOTENCY_PREFIX.DEPOSIT_CREDIT}:${depositId}`;
}
