import React from "react";

export function CrashTopBarV2(props: { balanceText: string; live: boolean }) {
  const { balanceText, live } = props;
  return (
    <div className="crash-v2-topbar">
      <div className="crash-v2-topbar-title">
        <span>CRASH</span>
        {live ? <span className="crash-v2-live">LIVE</span> : null}
      </div>
      <div style={{ display: "grid", gap: 2, justifyItems: "end" }}>
        <div className="crash-v2-balance">{balanceText}</div>
      </div>
    </div>
  );
}

