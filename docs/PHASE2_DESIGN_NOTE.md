# Phase 2 Design Note — Deterministic Crash Core

## Deterministic seed handling

- `DeterministicCrashRng` accepts a seed string.
- Seed is hashed using a deterministic FNV-like 64-bit routine to initialize internal PRNG state.
- PRNG progression uses deterministic xorshift operations on 64-bit state.
- Same config + same seed + same call order => same crash multiplier sequence.

## Fixed-point strategy

- Crash multipliers are represented as scaled integers with 6 decimal places (`scale = 1_000_000`).
- String multiplier inputs (e.g. `"2.50"`) are parsed to scaled bigint values.
- Random offset selection and multiplier comparisons are done in bigint domain.
- Output is serialized back to fixed 6-decimal string form.

## Crash multiplier band selection flow

1. Validate crash distribution config:
   - at least one bucket
   - each weight must be finite and > 0
   - each bucket must have `maxMultiplier > minMultiplier`
2. Convert each weight to scaled integer and compute total weight from actual config.
3. Draw a deterministic random point in `[0, totalWeight)`.
4. Select the first bucket whose cumulative normalized weight exceeds that point.
5. Draw deterministic offset within selected bucket range and produce multiplier.
