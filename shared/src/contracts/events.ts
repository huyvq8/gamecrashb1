export type GameEventName =
  | "ROUND_CREATED"
  | "BETTING_OPEN"
  | "ROUND_STARTED"
  | "MULTIPLIER_TICK"
  | "CASHOUT_ACCEPTED"
  | "ROUND_CRASHED"
  | "ROUND_SETTLED"
  | "BET_PLACED"
  | "BET_REJECTED"
  | "CASHOUT_REQUESTED"
  | "CASHOUT_REJECTED"
  | "PAYOUT_COMPLETED"
  | "LEDGER_DEBIT"
  | "LEDGER_CREDIT";

export interface GameEvent {
  eventId: string;
  gameKey: string;
  roundId: string | null;
  userId: string | null;
  eventName: GameEventName;
  payload: Record<string, unknown>;
  createdAt: string;
}
