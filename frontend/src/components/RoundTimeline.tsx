import React from "react";
import type { RoundStatus } from "../types/crash";

export function RoundTimeline({ status }: { status: RoundStatus | "IDLE" }) {
  return <div data-testid="round-status">Round status: {status}</div>;
}
