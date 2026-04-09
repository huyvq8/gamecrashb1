import React, { useMemo } from "react";

/**
 * One-shot sci-fi crash burst; mount with a changing `key` from parent on each crash.
 * Anchored in CSS to the rocket stack (see .crash-explosion).
 */
export function CrashExplosionFx() {
  const sparks = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        angleDeg: (i * 360) / 14 + (i % 3) * 4.5,
        delayMs: 30 + (i % 5) * 18
      })),
    []
  );

  return (
    <div className="crash-explosion" aria-hidden>
      <div className="crash-explosion__flash" />
      <div className="crash-explosion__bloom" />
      <div className="crash-explosion__core" />
      <div className="crash-explosion__ring crash-explosion__ring--outer" />
      <div className="crash-explosion__ring crash-explosion__ring--shock" />
      <div className="crash-explosion__debris">
        {sparks.map((s) => (
          <span
            key={s.id}
            className="crash-explosion__spark"
            style={
              {
                "--spark-rot": `${s.angleDeg}deg`,
                "--spark-delay": `${s.delayMs}ms`
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
