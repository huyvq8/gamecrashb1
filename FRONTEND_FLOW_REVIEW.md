# Web frontend flow review (main branch snapshot)

## Context
- Local container cannot fetch remote `origin` (GitHub blocked by CONNECT 403).
- This review is based on direct source inspection of `https://github.com/huyvq8/gamecrashb1` via web browsing.

## 1) Entry and composition flow
1. Frontend mounts `CrashScreenRebuild` from `main.tsx`.
2. `CrashScreenRebuild` composes 3 blocks:
   - Top: `CrashTopBar` (balance + history toggle)
   - Center: `CrashScene` + overlay `CrashCenterDisplay`
   - Bottom: `CrashBottomDock` (chips + bet/cashout CTA)
3. All state/actions come from `useCrashUiModel` and are passed down as props.

## 2) Data flow (API + realtime)
1. Initial load: `useCrashUiModel` runs `refreshBalance + refreshState + refreshHistory` in parallel.
2. REST endpoints used by `apiClient`:
   - `GET /game/crash/state`
   - `GET /game/crash/history`
   - `POST /game/crash/bet`
   - `POST /game/crash/cashout`
   - `GET /wallet/balance?userId=...`
3. Realtime: UI opens a socket client (`websocket` transport) and subscribes to:
   - `ROUND_CREATED`
   - `BETTING_OPEN`
   - `ROUND_STARTED`
   - `MULTIPLIER_TICK`
   - `CASHOUT_ACCEPTED`
   - `ROUND_CRASHED`
   - `ROUND_SETTLED`
   - `connect/reconnect` for re-sync.

## 3) UI phase/state flow
- Derived phase controls UX (`prepare`, `betting_open`, `running`, `crashed`, `result`, `cooldown`).
- `canPlaceBet`: only true when betting is open, selection > 0, and no active bet.
- `canCashOut`: only true when phase is running and active bet exists.

### Center behavior
- `running` => show live multiplier.
- `prepare/betting_open/cooldown` => show countdown.
- `crashed/result` => show multiplier if available, fallback countdown.

### Bottom CTA behavior
- No placed bet + open phase + selection => `Place Bet`.
- After placing (pre-run) => disabled `Bet Placed`.
- Running + active => `Cash Out` with live payout.
- Running + already cashed out => disabled `Cashed Out`.

## 4) What works well
- Clear container/presenter split: orchestration in hook, rendering in components.
- Re-sync strategy on socket reconnect is present.
- UX states for betting/cashout are explicit and deterministic.

## 5) Gaps / risks observed
1. `API_BASE` is hardcoded empty string; environment-based API switching is not shown.
2. Socket client does not show explicit namespace/URL config in this layer.
3. `runtimeConfig` currently hardcodes `demoUserId: "u1"` (not multi-user ready).
4. Error state exists in model but visible error rendering path is not obvious in rebuild screen.

## 6) Suggested improvements
1. Move API/socket endpoints to env-driven config (`VITE_API_BASE`, `VITE_WS_URL`).
2. Replace demo user id with auth/session source.
3. Add visible toast/banner for `error` from `useCrashUiModel`.
4. Add E2E test for full loop:
   - betting_open -> place bet -> running ticks -> cashout -> settled/history update.

## Conclusion
The frontend web flow is operationally coherent: it combines REST bootstrap + realtime events + phase-based UI transitions in a clean structure. Main next step is production hardening (runtime config, auth/user identity, and explicit error UX).
