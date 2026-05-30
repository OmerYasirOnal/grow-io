# CLAUDE.md

Guidance for working in this repo. See `README.md` for the full overview.

## What this is

A **shipped** iOS snake.io-style game. Thin Expo/React Native shell hosting the entire
game as one HTML5 canvas file in a WebView. Treat it as production: changes ship to real
users on the App Store. Prefer small, surgical, well-verified changes.

## Where things live

- `game/index.html` — **the whole game** (~2200 lines, vanilla JS + Canvas 2D, single
  `'use strict'` script). All gameplay, UI, menus, skins, economy, bots, audio.
- `src/GameWebView.tsx` — WebView host + the native⇄web `postMessage` bridge.
- `src/adService.ts` — AdMob (interstitial + rewarded). `FORCE_TEST_ADS` must be `false`
  for App Store releases.
- `src/storage.ts` — AsyncStorage persistence. Native keys are `grow-io_*`.

## Gotchas (read before editing the game)

- **No module system.** The game is one classic script. Top-level `function` decls are on
  `window` (callable from the browser console / Playwright); `let`/`const` globals are
  **not**. There is no `import`/`export` and no in-repo test harness for game internals.
- **Strict mode is on.** Assigning to an undeclared variable throws — when removing a
  global, remove the declaration *and* every assignment, or none.
- **Dual persistence, local-authoritative.** The game writes both `localStorage` and
  native AsyncStorage. On load, `localStorage` wins for the device; native is backup-only
  (adopted just when local is empty). Don't reintroduce a "max-merge" that raises coins
  from native — it refunds spends. See `reconcileLoadedCoins`.
- **Reward type is threaded through the bridge.** `SHOW_REWARDED_AD` carries
  `reward: 'continue' | 'coins'`; `adService.showRewarded(reward, cb)` replays it on
  `EARNED_REWARD`. Keep both sides agreeing — don't hardcode `'continue'`.
- **King/Boss rewards use constants** (`KING_*_REWARD`, `BOSS_*_REWARD`) so the payout and
  the on-screen banner can't drift. Change the constant, not one site.
- **Frame-rate independence.** Per-frame timers/animations scale by the global `gdt`
  (frame delta), not fixed `+=` constants. Follow that pattern in the loop/draw code.

## Verify before claiming done

```bash
npm run typecheck    # tsc --noEmit — must be clean
npm test             # Jest (TS layer)
# Game changes: serve + smoke-test in a browser
npx http-server game -p 8091 -c-1   # open http://127.0.0.1:8091/index.html
```
For game logic, assert window-exposed pure functions in the browser console
(`window.reconcileLoadedCoins(...)`, `window.skinPrice(...)`) and click through the
affected screen. A JS error halts the whole script, so "functions are defined and the menu
renders" is a strong parse/smoke signal.

## Release

EAS Build with `appVersionSource: "remote"` + iOS `autoIncrement` — **EAS owns the build
number**; bump only the marketing `version` in `app.json` (and the in-game stamp in
`drawMenu`, plus `docs/appstore-metadata.md`). Keep these three in sync.
