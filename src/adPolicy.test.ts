import { AD_CONFIG, appOpenAllowed, interstitialAllowed, isAdExpired, retryDelayMs } from './adPolicy';

const T0 = 1_800_000_000_000;

describe('isAdExpired', () => {
  it('treats an ad that was never loaded as not expired', () => {
    expect(isAdExpired(0, T0, AD_CONFIG.adMaxAgeMs)).toBe(false);
  });
  it('expires an interstitial/rewarded ad before Google\'s 1 hour limit', () => {
    expect(AD_CONFIG.adMaxAgeMs).toBeLessThan(60 * 60_000);
    expect(isAdExpired(T0, T0 + AD_CONFIG.adMaxAgeMs - 1, AD_CONFIG.adMaxAgeMs)).toBe(false);
    expect(isAdExpired(T0, T0 + AD_CONFIG.adMaxAgeMs, AD_CONFIG.adMaxAgeMs)).toBe(true);
  });
  it('expires an app open ad before Google\'s 4 hour limit', () => {
    expect(AD_CONFIG.appOpenMaxAgeMs).toBeLessThan(4 * 3_600_000);
  });
});

describe('interstitialAllowed', () => {
  const base = { now: T0, lastInterstitialAt: 0, lastFullscreenClosedAt: 0, launchCount: 5 };
  it('allows the first interstitial for a returning player', () => {
    expect(interstitialAllowed(base)).toBe(true);
  });
  it('never shows during the new-player grace launches', () => {
    expect(interstitialAllowed({ ...base, launchCount: AD_CONFIG.interstitialSkipFirstLaunches })).toBe(false);
    expect(interstitialAllowed({ ...base, launchCount: AD_CONFIG.interstitialSkipFirstLaunches + 1 })).toBe(true);
  });
  it('enforces the minimum interval between interstitials', () => {
    const last = T0 - AD_CONFIG.interstitialMinIntervalMs + 1;
    expect(interstitialAllowed({ ...base, lastInterstitialAt: last })).toBe(false);
    expect(interstitialAllowed({ ...base, lastInterstitialAt: T0 - AD_CONFIG.interstitialMinIntervalMs })).toBe(true);
  });
  it('does not stack on top of a rewarded ad that just closed', () => {
    expect(interstitialAllowed({ ...base, lastFullscreenClosedAt: T0 - 5_000 })).toBe(false);
    expect(interstitialAllowed({ ...base, lastFullscreenClosedAt: T0 - AD_CONFIG.fullscreenQuietMs })).toBe(true);
  });
});

describe('appOpenAllowed', () => {
  const base = {
    now: T0,
    backgroundedAt: T0 - AD_CONFIG.appOpenMinBackgroundMs,
    lastAppOpenAt: 0,
    lastFullscreenClosedAt: 0,
    launchCount: 10,
    uiState: 'menu',
    adShowing: false,
  };
  it('allows on return from a long enough background stay', () => {
    expect(appOpenAllowed(base)).toBe(true);
  });
  it('never interrupts a live run', () => {
    expect(appOpenAllowed({ ...base, uiState: 'playing' })).toBe(false);
  });
  it('requires a real background stay (cold start and quick switches are excluded)', () => {
    expect(appOpenAllowed({ ...base, backgroundedAt: 0 })).toBe(false);
    expect(appOpenAllowed({ ...base, backgroundedAt: T0 - 1_000 })).toBe(false);
  });
  it('skips new players', () => {
    expect(appOpenAllowed({ ...base, launchCount: AD_CONFIG.appOpenSkipFirstLaunches })).toBe(false);
  });
  it('caps frequency and never stacks on another full-screen ad', () => {
    expect(appOpenAllowed({ ...base, lastAppOpenAt: T0 - 60_000 })).toBe(false);
    expect(appOpenAllowed({ ...base, lastFullscreenClosedAt: T0 - 1_000 })).toBe(false);
    expect(appOpenAllowed({ ...base, adShowing: true })).toBe(false);
  });
});

describe('retryDelayMs', () => {
  it('backs off exponentially and is capped at 60s', () => {
    expect(retryDelayMs(1)).toBe(2_000);
    expect(retryDelayMs(2)).toBe(4_000);
    expect(retryDelayMs(0)).toBe(2_000);
    expect(retryDelayMs(50)).toBe(60_000);
  });
});
