import {
  InterstitialAd, RewardedAd, AdEventType, RewardedAdEventType, TestIds, MobileAds,
} from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';

// Set to true in a debug/TestFlight build to verify the ad flow with Google's
// test creatives even when __DEV__ is false. MUST be false for App Store
// release — otherwise real users see test ads and you earn $0.
const FORCE_TEST_ADS = false;

const useTest = __DEV__ || FORCE_TEST_ADS;
const INTERSTITIAL_ID = useTest ? TestIds.INTERSTITIAL : 'ca-app-pub-9920930529636149/5392741755';
const REWARDED_ID = useTest ? TestIds.REWARDED : 'ca-app-pub-9920930529636149/5762833880';

let interstitial: InstanceType<typeof InterstitialAd> | null = null;
let rewarded: InstanceType<typeof RewardedAd> | null = null;

let interstitialLoaded = false;
let rewardedLoaded = false;
let interstitialLoading = false;
let rewardedLoading = false;
let lastInterstitialError: string | null = null;
let lastRewardedError: string | null = null;
let onRewardEarned: ((reward: string) => void) | null = null;
let lastInterstitialAt = 0;
let lastRewardedShowAt = 0;
const MIN_INTERSTITIAL_INTERVAL_MS = 60_000;
const REWARDED_SHOW_DEDUPE_MS = 1500;

let interstitialRetryCount = 0;
let rewardedRetryCount = 0;
let initialized = false;
let sdkReady = false;

export interface AdStatus {
  interstitial: boolean;
  rewarded: boolean;
  interstitialLoading: boolean;
  rewardedLoading: boolean;
  sdkReady: boolean;
  usingTestAds: boolean;
  lastInterstitialError: string | null;
  lastRewardedError: string | null;
}
let statusListener: ((s: AdStatus) => void) | null = null;

function snapshot(): AdStatus {
  return {
    interstitial: interstitialLoaded,
    rewarded: rewardedLoaded,
    interstitialLoading,
    rewardedLoading,
    sdkReady,
    usingTestAds: useTest,
    lastInterstitialError,
    lastRewardedError,
  };
}

export function setAdStatusListener(cb: ((s: AdStatus) => void) | null): void {
  statusListener = cb;
  if (cb) cb(snapshot());
}

function emitStatus(): void {
  statusListener?.(snapshot());
}

function loadInterstitial(): void {
  if (!interstitial) return;
  if (interstitialLoading || interstitialLoaded) return;
  interstitialLoading = true;
  emitStatus();
  try {
    interstitial.load();
  } catch (e: any) {
    interstitialLoading = false;
    interstitialRetryCount++;
    lastInterstitialError = e?.message || String(e) || 'load() threw';
    console.warn('[AdMob] interstitial load() threw:', lastInterstitialError);
    emitStatus();
    setTimeout(loadInterstitial, Math.min(60_000, 1000 * 2 ** Math.min(interstitialRetryCount, 6)));
  }
}

function loadRewarded(): void {
  if (!rewarded) return;
  if (rewardedLoading || rewardedLoaded) return;
  rewardedLoading = true;
  emitStatus();
  try {
    rewarded.load();
  } catch (e: any) {
    rewardedLoading = false;
    rewardedRetryCount++;
    lastRewardedError = e?.message || String(e) || 'load() threw';
    console.warn('[AdMob] rewarded load() threw:', lastRewardedError);
    emitStatus();
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

  console.log('[AdMob] init starting. useTest=', useTest, 'INTERSTITIAL_ID=', INTERSTITIAL_ID, 'REWARDED_ID=', REWARDED_ID);

  await requestATT();

  try {
    const adapterStatuses = await MobileAds().initialize();
    sdkReady = true;
    console.log('[AdMob] SDK initialized. Adapter statuses:', JSON.stringify(adapterStatuses));
    emitStatus();
  } catch (e: any) {
    console.warn('[AdMob] SDK init failed:', e?.message || e);
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
    interstitialLoading = false;
    interstitialRetryCount = 0;
    lastInterstitialError = null;
    console.log('[AdMob] interstitial LOADED');
    emitStatus();
  });
  interstitial.addAdEventListener(AdEventType.CLOSED, () => {
    interstitialLoaded = false;
    emitStatus();
    loadInterstitial();
  });
  interstitial.addAdEventListener(AdEventType.ERROR, (error: any) => {
    interstitialLoaded = false;
    interstitialLoading = false;
    interstitialRetryCount++;
    lastInterstitialError = error?.message || error?.code || String(error) || 'unknown';
    console.warn('[AdMob] interstitial ERROR:', lastInterstitialError, 'code=', error?.code);
    emitStatus();
    setTimeout(loadInterstitial, Math.min(60_000, 2000 * Math.min(interstitialRetryCount, 6)));
  });
  loadInterstitial();

  rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
    rewardedLoaded = true;
    rewardedLoading = false;
    rewardedRetryCount = 0;
    lastRewardedError = null;
    console.log('[AdMob] rewarded LOADED');
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
  rewarded.addAdEventListener(AdEventType.ERROR, (error: any) => {
    rewardedLoaded = false;
    rewardedLoading = false;
    rewardedRetryCount++;
    lastRewardedError = error?.message || error?.code || String(error) || 'unknown';
    console.warn('[AdMob] rewarded ERROR:', lastRewardedError, 'code=', error?.code);
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
  } catch (e: any) {
    interstitialLoaded = false;
    lastInterstitialError = e?.message || String(e) || 'show() threw';
    console.warn('[AdMob] interstitial show() threw:', lastInterstitialError);
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
  } catch (e: any) {
    rewardedLoaded = false;
    onRewardEarned = null;
    lastRewardedError = e?.message || String(e) || 'show() threw';
    console.warn('[AdMob] rewarded show() threw:', lastRewardedError);
    emitStatus();
    loadRewarded();
    return false;
  }
}

export function getAdStatus(): AdStatus {
  return snapshot();
}
