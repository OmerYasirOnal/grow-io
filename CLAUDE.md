# CLAUDE.md

Guidance for working in this repo. See `README.md` for the full overview.

## What this is

A **shipped** iOS snake.io-style game. Thin Expo/React Native shell hosting the entire
game as one HTML5 canvas file in a WebView. Treat it as production: changes ship to real
users on the App Store. Prefer small, surgical, well-verified changes.

## Where things live

- `game/index.html` — **the whole game** (~4500 lines, vanilla JS + Canvas 2D, single
  `'use strict'` script). All gameplay, UI, menus, skins, economy, bots, audio.
- `src/GameWebView.tsx` — WebView host + the native⇄web `postMessage` bridge.
- `src/adService.ts` — AdMob (interstitial + rewarded + optional app-open), UMP consent, ATT.
  `FORCE_TEST_ADS` must be `false` for App Store releases.
- `src/adPolicy.ts` — pure, unit-tested ad rules; every threshold lives in `AD_CONFIG`.
- `src/review.ts` — store review prompt (once per marketing version).
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
- **One settlement path.** `settleRun()` owns records + payouts and is delta-based, because a
  revived run reaches it twice (and quit-from-pause calls it too). Never grant XP / top-score /
  "double" coins anywhere else, and reset its `run*` trackers in `startGame`.
- **`update()` returns right after the death frame.** Nothing may spawn or advance once
  `state!=='playing'`. `kingActive`/`bossActive` stay truthful at death (a revive resumes with them).
- **Layout functions are the single source of truth.** `menuLayout()`, `deathLayout()`,
  `primerLayout()` feed both the draw code and the tap handler. Add a rect there, not two
  hand-copied sets of coordinates.
- **Ad flow contract.** Interstitials are requested only by `leaveDeathScreen()` (never at the moment
  of death); every rewarded placement goes through `requestRewarded()`. The reward arrives when the ad
  CLOSES. While `adOpen` the loop skips `update()`. Bridge: game→native `SHOW_INTERSTITIAL`,
  `SHOW_REWARDED_AD`, `PRIVACY_READY`, `OPEN_PRIVACY_OPTIONS`, `UI_STATE`, `REQUEST_REVIEW`, `TRACK`; native→game `AD_STATUS`
  (incl. `privacyPending`), `AD_OPENED`, `AD_CLOSED`, `INTERSTITIAL_SHOWN|FAILED|CLOSED`,
  `AD_REWARD_EARNED`, `AD_FAILED`, `APP_STATE`.
- **Economy is data.** Skin prices come from `RARITY` (one price per rarity), income from the
  `ECONOMY` constants block (`FOOD_COIN_RATE`, `KILL_COIN`, `MISSION_*`, `COIN_AD_REWARDS`...). Change
  the table/constant, never a call site. Food coins accrue through `coinCarry` (fractional): do not
  reintroduce a per-pellet `Math.max(1, ...)`. `SKINS` is **append-only** (saves store indices).
- **Shop and death screen** read `shopLayout()` / `shopSkinState()` / `deathLayout()`. The skin grid
  scrolls, so its taps fire on touch END (`shopTouch`); every other screen still taps on touch start.
- **Interstitial cadence** is `interstitialEligible(sessionRuns, runsSinceAd, ...)`: every second run
  or one long run; any full-screen ad resets `runsSinceAd`. Never reward an interstitial (AdMob policy).
- **Coin glyph:** draw text containing the coin with `coinText()` (inline vector coin), not `fillText`.
- **Fonts are embedded** as base64 `@font-face` (offline-safe). Do not reintroduce network fonts.
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
`drawMenu`, plus `docs/appstore-metadata.md`). Keep these three in sync (a Jest test checks the
stamp against `app.json`). Adding a native module (e.g. `expo-store-review`) needs a new store
build; it cannot ship as an OTA update.
