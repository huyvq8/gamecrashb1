export const runtimeConfig = {
  demoUserId: "u1",
  // Use bundled transparent SVG rocket in public
  rocketImageUrl: "/rocket.svg",
  /** `amountMinor` / balance: minor units per one display unit (chip "100" = 100 × scale minor). */
  minorUnitsPerDisplay: 100,
  /** Each Deposit adds this many display units (e.g. 10_000 → +$10,000 when ÷100). */
  depositDisplayUnits: 10_000
} as const;
