# Grow.io

A snake.io / slither.io–style arena game for iOS. You steer a growing snake around a
circular neon arena, eat food to grow, and eliminate rival bot snakes by cutting across
their path. Single-player vs. up to 12 bots, with skins, power-ups, a coin economy,
daily bonuses, score-scaled difficulty, King/Boss events, and an ad-gated revive.

- **Studio:** AKIS Games (Ömer Yasir Önal)
- **Bundle ID:** `com.omeryasir.growio` · **App Store:** [6762146110](https://appstoreconnect.apple.com/apps/6762146110)
- **Languages:** Turkish / English (auto-detected from device locale)

## Architecture

The app is a thin **Expo / React Native** shell hosting the entire game as a single
self-contained **HTML5 canvas** file inside a `WebView`:

```
App.tsx
└─ src/GameWebView.tsx     WebView host + native⇄web postMessage bridge
   ├─ src/adService.ts     Google AdMob (interstitial + rewarded)
   ├─ src/storage.ts       AsyncStorage persistence (high score, coins, stats, skins)
   └─ game/index.html      THE GAME — ~2200 lines of vanilla JS + Canvas 2D, no engine
```

**Almost all gameplay, UI, menus, economy, and logic live in `game/index.html`.** The
React Native side only bridges three native capabilities: ads, haptics, and persistence.

### The native ⇄ web bridge

The game talks to native via `window.ReactNativeWebView.postMessage` and listens on
`window.addEventListener('message', …)`. Message types:

| Direction | Types |
|-----------|-------|
| game → native | `HAPTIC`, `SAVE_HIGH_SCORE`/`LOAD_HIGH_SCORE`, `SAVE_COINS`/`LOAD_COINS`, `SAVE_STATS`/`LOAD_STATS`, `SAVE_SKIN_STATE`/`LOAD_SKIN_STATE`, `CHECK_AD_READY`, `SHOW_INTERSTITIAL`, `SHOW_REWARDED_AD` (`reward: 'continue' \| 'coins'`) |
| native → game | `HIGH_SCORE_LOADED`, `COINS_LOADED`, `STATS_LOADED`, `SKIN_STATE_LOADED`, `AD_STATUS`, `AD_REWARD_EARNED` (`reward`), `AD_FAILED` |

**Persistence is dual-layer:** the game writes to its own `localStorage` *and* mirrors to
native `AsyncStorage`. `localStorage` is authoritative for the device; native is a backup
adopted only on first load when local is empty (fresh install / cleared cache). See
`reconcileLoadedCoins` in `game/index.html`.

## Develop

```bash
npm install

# Run the full app on the iOS simulator (native modules: ads, haptics)
npm run ios            # = expo run:ios

# Or iterate on the game alone in a desktop browser (fast loop, no native bridge):
npx http-server game -p 8091 -c-1   # then open http://127.0.0.1:8091/index.html
```

The game degrades gracefully without the native bridge (ads no-op, persistence falls back
to `localStorage`), so the browser preview is a high-fidelity way to work on gameplay.

## Test & verify

```bash
npm test          # Jest unit tests for the TypeScript layer (src/*.test.ts)
npm run typecheck # tsc --noEmit (must be clean)
```

The monolithic `game/index.html` has no in-repo test harness; verify game changes by
running the browser preview above and exercising the relevant flow. Top-level `function`
declarations in the game are reachable as `window.<name>` for quick console assertions
(e.g. `window.skinPrice({u:'s30000'})`), but `let`/`const` globals are not.

## Release

- **Builds:** EAS Build. `eas.json` uses `appVersionSource: "remote"` with
  `autoIncrement: true` for iOS — **the build number is managed remotely by EAS**; the
  `buildNumber` in `app.json` is not authoritative. Bump the marketing `version` in
  `app.json` for a new release.
- **Store metadata & screenshots:** `docs/appstore-metadata.md`, `fastlane/`,
  `scripts/generate-screenshots.js`.
- **Privacy:** `docs/privacy-policy.html`. Monetized via AdMob (IDFA / ATT prompt).
