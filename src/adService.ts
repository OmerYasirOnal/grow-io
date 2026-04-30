import {
  InterstitialAd, RewardedAd, AdEventType, RewardedAdEventType, TestIds, MobileAds,
} from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';

const INTERSTITIAL_ID = __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-9920930529636149/5392741755';
const REWARDED_ID = __DEV__ ? TestIds.REWARDED : 'ca-app-pub-9920930529636149/5762833880';

let interstitial: InstanceType<typeof InterstitialAd> | null = null;
let rewarded: InstanceType<typeof RewardedAd> | null = null;

let interstitialLoaded = false;
let rewardedLoaded = false;
let onRewardEarned: ((reward: string) => void) | null = null;
let lastInterstitialAt = 0;
let lastRewardedShowAt = 0;
const MIN_INTERSTITIAL_INTERVAL_MS = 60_000;
const REWARDED_SHOW_DEDUPE_MS = 1500;

let interstitialRetryCount = 0;
let rewardedRetryCount = 0;
let initialized = false;
let sdkReady = false;

export interface AdStatus { interstitial: boolean; rewarded: boolean; }
let statusListener: ((s: AdStatus) => void) | null = null;

export function setAdStatusListener(cb: ((s: AdStatus) => void) | null): void {
  statusListener = cb;
  // Only push initial state if the SDK actually reached the point where
  // ad instances exist. Before that, interstitialLoaded/rewardedLoaded are
  // both false anyway — but the listener should learn the true ready state
  // through emitStatus() once the LOADED events fire, not from this stale
  // synchronous push.
  if (cb && sdkReady) cb({ interstitial: interstitialLoaded, rewarded: rewardedLoaded });
}

function emitStatus(): void {
  if (!sdkReady) return;
  statusListener?.({ interstitial: interstitialLoaded, rewarded: rewardedLoaded });
}

function loadInterstitial(): void {
  if (!interstitial) return;
  try {
    interstitial.load();
  } catch {
    interstitialRetryCount++;
    setTimeout(loadInterstitial, Math.min(60_000, 1000 * 2 ** Math.min(interstitialRetryCount, 6)));
  }
}

function loadRewarded(): void {
  if (!rewarded) return;
  try {
    rewarded.load();
  } catch {
    rewardedRetryCount++;
    setTimeout(loadRewarded, Math.min(60_000, 1000 * 2 ** Math.min(rewardedRetryCount, 6)));
  }
}

async function requestATT(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    const { requireOptionalNativeModule } = require('expo-modules-core');
    if (!requireOptionalNativeModule('ExpoTrackingTransparency')) return;
    const mod = await import('expo-tracking-transparency');
    const current = await mod.getTrackingPermissionsAsync();
    if (current.status === 'undetermined') {
      await mod.requestTrackingPermissionsAsync();
    }
  } catch {
    // Native module unavailable (e.g. stale simulator binary) — silently skip.
  }
}

export async function initAds(): Promise<void> {
  if (initialized) return;
  initialized = true;

  await requestATT();

  try {
    await MobileAds().initialize();
    sdkReady = true;
    // Tell any listener that registered before init that the SDK is alive
    // (their initial cb call was suppressed because sdkReady was false).
    emitStatus();
  } catch {
    return;
  }

  interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_ID, {
    requestNonPersonalizedAdsOnly: false,
  });
  rewarded = RewardedAd.createForAdRequest(REWARDED_ID, {
    requestNonPersonalizedAdsOnly: false,
  });

  interstitial.addAdEventListener(AdEventType.LOADED, () => {
    interstitialLoaded = true;
    interstitialRetryCount = 0;
    emitStatus();
  });
  interstitial.addAdEventListener(AdEventType.CLOSED, () => {
    interstitialLoaded = false;
    emitStatus();
    loadInterstitial();
  });
  interstitial.addAdEventListener(AdEventType.ERROR, () => {
    interstitialLoaded = false;
    interstitialRetryCount++;
    emitStatus();
    setTimeout(loadInterstitial, Math.min(60_000, 2000 * Math.min(interstitialRetryCount, 6)));
  });
  loadInterstitial();

  rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
    rewardedLoaded = true;
    rewardedRetryCount = 0;
    emitStatus();
  });
  rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
    if (onRewardEarned) onRewardEarned('continue');
    onRewardEarned = null;
  });
  rewarded.addAdEventListener(AdEventType.CLOSED, () => {
    rewardedLoaded = false;
    onRewardEarned = null;
    emitStatus();
    loadRewarded();
  });
  rewarded.addAdEventListener(AdEventType.ERROR, () => {
    rewardedLoaded = false;
    rewardedRetryCount++;
    emitStatus();
    setTimeout(loadRewarded, Math.min(60_000, 2000 * Math.min(rewardedRetryCount, 6)));
  });
  loadRewarded();
}

export function showInterstitial(): boolean {
  if (!sdkReady || !interstitial) return false;
  const now = Date.now();
  if (now - lastInterstitialAt < MIN_INTERSTITIAL_INTERVAL_MS) return false;
  if (!interstitialLoaded) {
    loadInterstitial();
    return false;
  }
  try {
    interstitial.show();
    lastInterstitialAt = now;
    return true;
  } catch {
    interstitialLoaded = false;
    emitStatus();
    loadInterstitial();
    return false;
  }
}

export function showRewarded(callback: (reward: string) => void): boolean {
  if (!sdkReady || !rewarded) return false;
  const now = Date.now();
  if (now - lastRewardedShowAt < REWARDED_SHOW_DEDUPE_MS) return false;
  if (!rewardedLoaded) {
    loadRewarded();
    return false;
  }
  try {
    onRewardEarned = callback;
    rewarded.show();
    lastRewardedShowAt = now;
    return true;
  } catch {
    rewardedLoaded = false;
    onRewardEarned = null;
    emitStatus();
    loadRewarded();
    return false;
  }
}

export function isInterstitialReady(): boolean {
  return sdkReady && interstitialLoaded;
}

export function isRewardedReady(): boolean {
  return sdkReady && rewardedLoaded;
}
