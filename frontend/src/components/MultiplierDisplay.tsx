import React from "react";

export function MultiplierDisplay({ multiplier }: { multiplier: string }) {
  return <div data-testid="multiplier-display">Multiplier: {multiplier}x</div>;
}
