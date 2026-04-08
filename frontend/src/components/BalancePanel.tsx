import React from "react";

export function BalancePanel({ balanceMinor }: { balanceMinor: string }) {
  return <div data-testid="balance-panel">Balance: {balanceMinor}</div>;
}
