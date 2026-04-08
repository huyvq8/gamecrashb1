export enum BetStatus {
  ACTIVE = "ACTIVE",
  CASHED_OUT = "CASHED_OUT",
  LOST = "LOST",
  REJECTED = "REJECTED"
}

export interface Bet {
  betId: string;
  userId: string;
  roundId: string;
  amountMinor: string;
  placedAt: string;
  status: BetStatus;
  cashoutMultiplier: string | null;
  payoutAmountMinor: string | null;
  rejectionReason: string | null;
}

export interface Cashout {
  cashoutId: string;
  betId: string;
  userId: string;
  roundId: string;
  cashoutMultiplier: string;
  payoutAmountMinor: string;
  requestedAt: string;
  processedAt: string;
}
