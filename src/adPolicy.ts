// Pure ad-policy rules. No native imports, so Jest can exercise them directly.
// Every tunable threshold lives in AD_CONFIG so it can later be driven by a
// remote config service without touching the call sites.

export const AD_CONFIG = {
  // Minimum gap between two interstitials.
  interstitialMinIntervalMs: 90_000,
  // No interstitial at all during the first N app launches (new-player grace).
  interstitialSkipFirstLaunches: 1,
  // Google only pays for valid impressions: interstitial/rewarded objects held
  // longer than 1 hour must be discarded. Refresh a little early.
  adMaxAgeMs: 55 * 60_000,
  // App open ads expire after 4 hours.
  appOpenMaxAgeMs: 3.5 * 3_600_000,
  // App open ad only when the app was away for at least this long...
  appOpenMinBackgroundMs: 30_000,
  // ...and at most once per this window...
  appOpenMinIntervalMs: 4 * 3_600_000,
  // ...and never during the first N launches.
  appOpenSkipFirstLaunches: 2,
  // Never stack two full-screen ads: quiet period after any full-screen ad.
  fullscreenQuietMs: 60_000,
  // If the game never reports that its privacy primer was shown, ask for ATT
  // anyway after this long so ads are not blocked forever.
  privacyFallbackMs: 60_000,
  // Ignore duplicate rewarded show requests inside this window.
  rewardedDedupeMs: 1_500,
} as const;

export function isAdExpired(loadedAt: number, now: number, maxAgeMs: number): boolean {
  if (!loadedAt) return false;
  return now - loadedAt >= maxAgeMs;
}

export interface InterstitialGate {
  now: number;
  lastInterstitialAt: number;
  lastFullscreenClosedAt: number;
  launchCount: number;
}

export function interstitialAllowed(g: InterstitialGate): boolean {
  if (g.launchCount <= AD_CONFIG.interstitialSkipFirstLaunches) return false;
  if (g.lastInterstitialAt && g.now - g.lastInterstitialAt < AD_CONFIG.interstitialMinIntervalMs) return false;
  // A rewarded ad the player just chose to watch counts as an ad break too.
  if (g.lastFullscreenClosedAt && g.now - g.lastFullscreenClosedAt < AD_CONFIG.fullscreenQuietMs) return false;
  return true;
}

export interface AppOpenGate {
  now: number;
  backgroundedAt: number;
  lastAppOpenAt: number;
  lastFullscreenClosedAt: number;
  launchCount: number;
  uiState: string;
  adShowing: boolean;
}

export function appOpenAllowed(g: AppOpenGate): boolean {
  if (g.adShowing) return false;
  if (g.launchCount <= AD_CONFIG.appOpenSkipFirstLaunches) return false;
  // Never interrupt a live run; a paused run is fine to leave paused.
  if (g.uiState === 'playing') return false;
  if (!g.backgroundedAt || g.now - g.backgroundedAt < AD_CONFIG.appOpenMinBackgroundMs) return false;
  if (g.lastAppOpenAt && g.now - g.lastAppOpenAt < AD_CONFIG.appOpenMinIntervalMs) return false;
  if (g.lastFullscreenClosedAt && g.now - g.lastFullscreenClosedAt < AD_CONFIG.fullscreenQuietMs) return false;
  return true;
}

// Exponential backoff for failed loads: 2s, 4s, 8s ... capped at 60s.
export function retryDelayMs(retryCount: number): number {
  const n = Math.max(1, Math.min(retryCount, 6));
  return Math.min(60_000, 1000 * 2 ** n);
}
