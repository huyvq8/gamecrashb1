/**
 * Compact USD display from minor units (cents). Keeps CTA width stable for large payouts.
 * Examples: 271108 → 2.7K | 1050000 → 10.5K | 100000000 → 1M
 */
export function formatCompactUsdFromMinor(minorStr: string): string {
  const n = Number(minorStr);
  if (!Number.isFinite(n)) return "0.00";
  const dollars = n / 100;
  const ad = Math.abs(dollars);
  const sign = dollars < 0 ? "-" : "";

  if (ad < 1000) {
    return (
      sign +
      ad.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    );
  }
  if (ad < 1_000_000) {
    const k = dollars / 1000;
    const ak = Math.abs(k);
    let body: string;
    if (ak >= 100) body = k.toFixed(0);
    else if (ak >= 10) body = (Math.round(k * 10) / 10).toFixed(1).replace(/\.0$/, "");
    else body = (Math.round(k * 10) / 10).toFixed(1).replace(/\.0$/, "");
    return sign + body + "K";
  }
  const m = dollars / 1_000_000;
  const am = Math.abs(m);
  let body: string;
  if (am >= 100) body = m.toFixed(0);
  else if (am >= 10) body = (Math.round(m * 10) / 10).toFixed(1).replace(/\.0$/, "");
  else body = (Math.round(m * 10) / 10).toFixed(1).replace(/\.0$/, "");
  return sign + body + "M";
}

/** Full precision for title/aria (matches legacy money() without $). */
export function formatFullUsdFromMinor(minorStr: string): string {
  if (!minorStr) return "0.00";
  return (Number(minorStr) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
