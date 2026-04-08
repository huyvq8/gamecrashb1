# Phase 7 Framework Extraction Note

## What became generic

- `PlatformKernel`: game-module lifecycle coordinator (`registerGameModule`, `startAll`, `stopAll`).
- `PlatformRegistry`: reusable module registry with duplicate-key protection.
- `PlatformGameModule` contract: minimal runtime-safe interface for any game module.
- `createCrashGameModule`: adapter that plugs Crash runtime into platform kernel without changing Crash semantics.

## What intentionally remains Crash-specific

- Crash RNG distribution and multiplier math.
- Crash round runtime loop and event payload specifics.
- Crash API routes and frontend screen behavior.
- Wallet money semantics and idempotency behavior (shared but not over-generalized).

## How to add a second game quickly (example: Mines)

1. Create game module files:
   - `backend/src/core/games/mines/MinesEngine.ts`
   - `backend/src/core/games/mines/MinesRuntime.ts`
   - `backend/src/core/games/mines/MinesModuleFactory.ts`
2. Implement module adapter returning `PlatformGameModule`:
   - `gameKey: "mines"`
   - `start()` and `stop()` wired to Mines runtime.
3. Register module in app composition path:
   - call `kernel.registerGameModule(createMinesGameModule({ runtime }))`.
4. Add Mines API surface (separate routes) and reuse existing shared boundaries:
   - wallet adapter,
   - realtime gateway,
   - rejection tracker,
   - platform kernel lifecycle.
5. Add frontend touchpoint:
   - new page/component and API/socket bindings for Mines endpoints/events.
