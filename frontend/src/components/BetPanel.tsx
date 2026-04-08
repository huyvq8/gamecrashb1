import React from "react";

export function BetPanel(props: {
  betAmount: string;
  onBetAmountChange: (value: string) => void;
  onPlaceBet: () => void;
  onCashout: () => void;
  canBet: boolean;
  canCashout: boolean;
  loading: boolean;
}) {
  return (
    <div>
      <input
        data-testid="bet-input"
        value={props.betAmount}
        onChange={(e) => props.onBetAmountChange(e.target.value)}
        disabled={props.loading}
      />
      <button data-testid="place-bet" onClick={props.onPlaceBet} disabled={!props.canBet || props.loading}>
        Place Bet
      </button>
      <button data-testid="cashout" onClick={props.onCashout} disabled={!props.canCashout || props.loading}>
        Cash Out
      </button>
    </div>
  );
}
