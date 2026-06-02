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

## Running locally (dev)

A **Debug** build (Xcode ▶ Run on a simulator/device) does **not** embed the JS bundle — it loads
from the **Metro** dev server (`AppDelegate.swift` returns the packager URL under `#if DEBUG`, and
the "Bundle React Native code and images" phase sets `SKIP_BUNDLING=1` in Debug). So start Metro
first:

```bash
npx expo start            # serves Metro on :8081
```

then **Reload (⌘R)** in the simulator. If Metro isn't running you'll see the RN red box
`No script URL provided … unsanitizedScriptURLString = (null)` — that is the missing dev server,
**not a bug**. **Release / store builds embed the bundle** (`react-native-xcode.sh` runs
`export:embed`), so EAS production builds and Xcode Archives load standalone with no packager.

**AdMob is iOS-only.** The `react-native-google-mobile-ads` plugin in `app.json` sets only
`iosAppId`; the recurring `No 'androidAppId' was provided …` log is **benign** (Android is never
built). Add an `androidAppId` only if/when an Android build is introduced.

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
