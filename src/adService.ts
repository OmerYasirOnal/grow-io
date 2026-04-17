import {
  InterstitialAd, RewardedAd, AdEventType, RewardedAdEventType, TestIds,
} from 'react-native-google-mobile-ads';

// Production AdMob ad unit IDs (Snake Grow.io)
const INTERSTITIAL_ID = __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-9920930529636149/5392741755';
const REWARDED_ID = __DEV__ ? TestIds.REWARDED : 'ca-app-pub-9920930529636149/5762833880';

const interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_ID, {
  requestNonPersonalizedAdsOnly: false,
});
const rewarded = RewardedAd.createForAdRequest(REWARDED_ID, {
  requestNonPersonalizedAdsOnly: false,
});

let interstitialLoaded = false;
let rewardedLoaded = false;
let onRewardEarned: ((reward: string) => void) | null = null;
let lastInterstitialAt = 0;
const MIN_INTERSTITIAL_INTERVAL_MS = 60_000; // throttle so AdMob doesn't penalize the app

let interstitialRetryCount = 0;
let rewardedRetryCount = 0;
let initialized = false;

function loadInterstitial(): void {
  try {
    interstitial.load();
  } catch (_e) {
    setTimeout(loadInterstitial, Math.min(60_000, 1000 * 2 ** Math.min(interstitialRetryCount, 6)));
    interstitialRetryCount++;
  }
}

function loadRewarded(): void {
  try {
    rewarded.load();
  } catch (_e) {
    setTimeout(loadRewarded, Math.min(60_000, 1000 * 2 ** Math.min(rewardedRetryCount, 6)));
    rewardedRetryCount++;
  }
}

export function initAds(): void {
  if (initialized) return;
  initialized = true;

  // Interstitial events
  interstitial.addAdEventListener(AdEventType.LOADED, () => {
    interstitialLoaded = true;
    interstitialRetryCount = 0;
  });
  interstitial.addAdEventListener(AdEventType.CLOSED, () => {
    interstitialLoaded = false;
    loadInterstitial();
  });
  interstitial.addAdEventListener(AdEventType.ERROR, () => {
    interstitialLoaded = false;
    interstitialRetryCount++;
    setTimeout(loadInterstitial, Math.min(60_000, 2000 * Math.min(interstitialRetryCount, 6)));
  });
  loadInterstitial();

  // Rewarded events
  rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
    rewardedLoaded = true;
    rewardedRetryCount = 0;
  });
  rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
    if (onRewardEarned) onRewardEarned('continue');
    onRewardEarned = null;
  });
  rewarded.addAdEventListener(AdEventType.CLOSED, () => {
    rewardedLoaded = false;
    onRewardEarned = null;
    loadRewarded();
  });
  rewarded.addAdEventListener(AdEventType.ERROR, () => {
    rewardedLoaded = false;
    rewardedRetryCount++;
    setTimeout(loadRewarded, Math.min(60_000, 2000 * Math.min(rewardedRetryCount, 6)));
  });
  loadRewarded();
}

export function showInterstitial(): boolean {
  const now = Date.now();
  if (now - lastInterstitialAt < MIN_INTERSTITIAL_INTERVAL_MS) {
    return false;
  }
  if (!interstitialLoaded) {
    loadInterstitial();
    return false;
  }
  try {
    interstitial.show();
    lastInterstitialAt = now;
    return true;
  } catch (_e) {
    interstitialLoaded = false;
    loadInterstitial();
    return false;
  }
}

export function showRewarded(callback: (reward: string) => void): boolean {
  if (!rewardedLoaded) {
    loadRewarded();
    return false;
  }
  try {
    onRewardEarned = callback;
    rewarded.show();
    return true;
  } catch (_e) {
    rewardedLoaded = false;
    onRewardEarned = null;
    loadRewarded();
    return false;
  }
}

export function isInterstitialReady(): boolean {
  return interstitialLoaded;
}

export function isRewardedReady(): boolean {
  return rewardedLoaded;
}
