import React from "react";
import type { HistoryRound } from "../types/crash";

export function RecentRounds({ rounds }: { rounds: HistoryRound[] }) {
  return (
    <ul data-testid="history-list">
      {rounds.map((round) => (
        <li key={round.roundId}>{round.roundId} - {round.status} - {round.crashMultiplier ?? "n/a"}</li>
      ))}
    </ul>
  );
}
