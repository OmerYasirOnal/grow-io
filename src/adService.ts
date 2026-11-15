import {
  InterstitialAd, RewardedAd, AppOpenAd, AdEventType, RewardedAdEventType, TestIds, MobileAds, AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
} from 'react-native-google-mobile-ads';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { AD_CONFIG, appOpenAllowed, interstitialAllowed, isAdExpired, retryDelayMs } from './adPolicy';
import { loadMeta, updateMeta } from './storage';

// Set to true in a debug/TestFlight build to verify the ad flow with Google's
// test creatives even when __DEV__ is false. MUST be false for App Store
// release — otherwise real users see test ads and you earn $0.
const FORCE_TEST_ADS = false;

const useTest = __DEV__ || FORCE_TEST_ADS;
const INTERSTITIAL_ID = useTest ? TestIds.INTERSTITIAL : 'ca-app-pub-9920930529636149/5392741755';
const REWARDED_ID = useTest ? TestIds.REWARDED : 'ca-app-pub-9920930529636149/5762833880';
// AdMob unit "Growio_AppOpen". An empty string disables the format.
const APP_OPEN_PROD_ID = 'ca-app-pub-9920930529636149/4414824391';
const APP_OPEN_ID = useTest ? TestIds.APP_OPEN : APP_OPEN_PROD_ID;

// Use the factory's return type for the instance type: the ad classes have
// protected constructors, so `InstanceType<typeof X>` fails to type-check.
type Interstitial = ReturnType<typeof InterstitialAd.createForAdRequest>;
type Rewarded = ReturnType<typeof RewardedAd.createForAdRequest>;
type AppOpen = ReturnType<typeof AppOpenAd.createForAdRequest>;

let interstitial: Interstitial | null = null;
let rewarded: Rewarded | null = null;
let appOpen: AppOpen | null = null;

let interstitialLoaded = false;
let rewardedLoaded = false;
let appOpenLoaded = false;
let interstitialLoading = false;
let rewardedLoading = false;
let appOpenLoading = false;
let interstitialLoadedAt = 0;
let rewardedLoadedAt = 0;
let appOpenLoadedAt = 0;
let lastInterstitialError: string | null = null;
let lastRewardedError: string | null = null;

// The reward type ('continue' | 'coins' | ...) requested for the in-flight
// rewarded ad, replayed to the callback so both sides agree on what to grant
// (no hardcoded assumption).
let pendingRewardType = 'continue';
let onRewardEarned: ((reward: string) => void) | null = null;
// Called when a rewarded ad that was accepted for showing never made it on
// screen, so the game can release its tap lock and tell the player.
let onRewardFailed: ((reward: string) => void) | null = null;
let rewardedOpened = false;
// The reward is earned mid-video but only DELIVERED when the ad closes, so the
// game never resumes (e.g. revives the snake) underneath a full-screen ad.
let rewardEarned = false;
let onInterstitialDone: (() => void) | null = null;

let lastInterstitialAt = 0;
let lastRewardedShowAt = 0;
let lastFullscreenClosedAt = 0;
let backgroundedAt = 0;
let adShowing = false;
// Which format owns the screen. A LOAD error of one format must never be
// mistaken for the dismissal of another format that is currently showing.
let showingKind: 'interstitial' | 'rewarded' | 'appOpen' | null = null;
let uiState = 'menu';

let interstitialRetryCount = 0;
let rewardedRetryCount = 0;
let appOpenRetryCount = 0;
let initialized = false;
let sdkReady = false;

// True while we wait for the game to show its short privacy primer before the
// system ATT prompt. The game reads this from AD_STATUS.
let privacyPending = false;
let privacyResolve: (() => void) | null = null;
// The fallback timer fired while a run was live: ask as soon as the run ends.
let privacyDeferred = false;
// True when Google requires an in-app entry point to the privacy options form
// (GDPR consent can be revoked, US-state users can opt out of data sale). The
// game shows a "privacy choices" row in Settings while this is set.
let privacyOptionsRequired = false;

// In-memory copy of the two counters the ad rules read. Persisted through
// updateMeta (field-level merge), never by writing this object back whole.
const meta = { launchCount: 0, lastAppOpenAt: 0 };

export interface AdStatus {
  interstitial: boolean;
  rewarded: boolean;
  interstitialLoading: boolean;
  rewardedLoading: boolean;
  sdkReady: boolean;
  usingTestAds: boolean;
  privacyPending: boolean;
  privacyOptionsRequired: boolean;
  lastInterstitialError: string | null;
  lastRewardedError: string | null;
}
let statusListener: ((s: AdStatus) => void) | null = null;
// Fired when any full-screen ad opens/closes so the host can pause the game
// and silence audio while the ad is on screen.
let lifecycleListener: ((open: boolean) => void) | null = null;

function snapshot(): AdStatus {
  return {
    interstitial: interstitialLoaded,
    rewarded: rewardedLoaded,
    interstitialLoading,
    rewardedLoading,
    sdkReady,
    usingTestAds: useTest,
    privacyPending,
    privacyOptionsRequired,
    lastInterstitialError,
    lastRewardedError,
  };
}

export function setAdStatusListener(cb: ((s: AdStatus) => void) | null): void {
  statusListener = cb;
  if (cb) cb(snapshot());
}

export function setAdLifecycleListener(cb: ((open: boolean) => void) | null): void {
  lifecycleListener = cb;
}

function emitStatus(): void {
  statusListener?.(snapshot());
}

type AdKind = 'interstitial' | 'rewarded' | 'appOpen';

function markAdOpened(kind: AdKind): void {
  showingKind = kind;
  if (adShowing) return;
  adShowing = true;
  lifecycleListener?.(true);
}

// Clears the on-screen flag only when `kind` is the format that owns the
// screen (or is about to: show() was called and OPENED has not fired yet).
function markAdClosed(kind: AdKind): void {
  if (showingKind !== kind) return;
  showingKind = null;
  if (!adShowing) return;
  adShowing = false;
  lastFullscreenClosedAt = Date.now();
  lifecycleListener?.(false);
}

// show() was called but the ad never reported OPENED (nor CLOSED / ERROR):
// release the screen claim and whoever is waiting, so one misbehaving
// presentation can never block every later ad or leave the game waiting.
function abortPendingShow(kind: AdKind): void {
  if (showingKind !== kind || adShowing) return;
  if (__DEV__) console.warn('[AdMob] abortPendingShow', kind);
  showingKind = null;
  // The stuck object is discarded: a fresh one is created and loaded.
  if (kind === 'interstitial') {
    finishInterstitial();
    createInterstitial();
    loadInterstitial();
  } else if (kind === 'rewarded') {
    finishRewarded();
    createRewarded();
    loadRewarded();
  } else {
    createAppOpen();
    loadAppOpen();
  }
  emitStatus();
}

function guardShow(kind: AdKind, shown: Promise<unknown> | void): void {
  if (shown && typeof (shown as Promise<unknown>).catch === 'function') {
    (shown as Promise<unknown>).catch(() => abortPendingShow(kind));
  }
  setTimeout(() => abortPendingShow(kind), 5000);
}

function errText(e: any, fallback: string): string {
  return e?.message || e?.code || (e ? String(e) : '') || fallback;
}

// ─── Interstitial ────────────────────────────────────────────────────────────

function finishInterstitial(): void {
  const done = onInterstitialDone;
  onInterstitialDone = null;
  done?.();
}

function createInterstitial(): void {
  interstitial?.removeAllListeners();
  interstitialLoaded = false;
  interstitialLoading = false;
  interstitialLoadedAt = 0;
  const ad = InterstitialAd.createForAdRequest(INTERSTITIAL_ID);
  interstitial = ad;
  ad.addAdEventListener(AdEventType.LOADED, () => {
    interstitialLoaded = true;
    interstitialLoading = false;
    interstitialLoadedAt = Date.now();
    interstitialRetryCount = 0;
    lastInterstitialError = null;
    if (__DEV__) console.log('[AdMob] interstitial LOADED');
    emitStatus();
  });
  ad.addAdEventListener(AdEventType.OPENED, () => markAdOpened('interstitial'));
  ad.addAdEventListener(AdEventType.CLOSED, () => {
    interstitialLoaded = false;
    markAdClosed('interstitial');
    finishInterstitial();
    emitStatus();
    loadInterstitial();
  });
  ad.addAdEventListener(AdEventType.ERROR, (error: any) => {
    interstitialLoaded = false;
    interstitialLoading = false;
    interstitialRetryCount++;
    lastInterstitialError = errText(error, 'unknown');
    console.warn('[AdMob] interstitial ERROR:', lastInterstitialError);
    // A show-time failure must still release the game waiting on this ad.
    markAdClosed('interstitial');
    finishInterstitial();
    emitStatus();
    setTimeout(loadInterstitial, retryDelayMs(interstitialRetryCount));
  });
}

function loadInterstitial(): void {
  if (!interstitial || interstitialLoading || interstitialLoaded) return;
  interstitialLoading = true;
  emitStatus();
  try {
    interstitial.load();
  } catch (e: any) {
    interstitialLoading = false;
    interstitialRetryCount++;
    lastInterstitialError = errText(e, 'load() threw');
    console.warn('[AdMob] interstitial load() threw:', lastInterstitialError);
    emitStatus();
    setTimeout(loadInterstitial, retryDelayMs(interstitialRetryCount));
  }
}

// ─── Rewarded ────────────────────────────────────────────────────────────────

function finishRewarded(): void {
  const cb = onRewardEarned;
  const failCb = onRewardFailed;
  const earned = rewardEarned;
  const opened = rewardedOpened;
  onRewardEarned = null;
  onRewardFailed = null;
  rewardEarned = false;
  rewardedOpened = false;
  if (__DEV__) console.log('[AdMob] finishRewarded earned=', earned, 'opened=', opened, 'cb=', !!cb);
  if (earned && cb) cb(pendingRewardType);
  // Closed early by the player = opened but not earned: nothing to report
  // (AD_CLOSED already told the game). Never opened = a failure to report.
  else if (!earned && !opened && failCb) failCb(pendingRewardType);
}

function createRewarded(): void {
  rewarded?.removeAllListeners();
  rewardedLoaded = false;
  rewardedLoading = false;
  rewardedLoadedAt = 0;
  const ad = RewardedAd.createForAdRequest(REWARDED_ID);
  rewarded = ad;
  ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
    rewardedLoaded = true;
    rewardedLoading = false;
    rewardedLoadedAt = Date.now();
    rewardedRetryCount = 0;
    lastRewardedError = null;
    if (__DEV__) console.log('[AdMob] rewarded LOADED');
    emitStatus();
  });
  ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
    if (__DEV__) console.log('[AdMob] rewarded EARNED');
    rewardEarned = true;
  });
  ad.addAdEventListener(AdEventType.OPENED, () => {
    if (__DEV__) console.log('[AdMob] rewarded OPENED');
    rewardedOpened = true;
    markAdOpened('rewarded');
  });
  ad.addAdEventListener(AdEventType.CLOSED, () => {
    if (__DEV__) console.log('[AdMob] rewarded CLOSED, earned=', rewardEarned);
    rewardedLoaded = false;
    markAdClosed('rewarded');
    finishRewarded();
    emitStatus();
    loadRewarded();
  });
  ad.addAdEventListener(AdEventType.ERROR, (error: any) => {
    rewardedLoaded = false;
    rewardedLoading = false;
    rewardedRetryCount++;
    lastRewardedError = errText(error, 'unknown');
    console.warn('[AdMob] rewarded ERROR:', lastRewardedError);
    markAdClosed('rewarded');
    // Grants the reward if it was already earned before the failure.
    finishRewarded();
    emitStatus();
    setTimeout(loadRewarded, retryDelayMs(rewardedRetryCount));
  });
}

function loadRewarded(): void {
  if (!rewarded || rewardedLoading || rewardedLoaded) return;
  rewardedLoading = true;
  emitStatus();
  try {
    rewarded.load();
  } catch (e: any) {
    rewardedLoading = false;
    rewardedRetryCount++;
    lastRewardedError = errText(e, 'load() threw');
    console.warn('[AdMob] rewarded load() threw:', lastRewardedError);
    emitStatus();
    setTimeout(loadRewarded, retryDelayMs(rewardedRetryCount));
  }
}

// ─── App open ────────────────────────────────────────────────────────────────

function createAppOpen(): void {
  if (!APP_OPEN_ID) return;
  appOpen?.removeAllListeners();
  appOpenLoaded = false;
  appOpenLoading = false;
  appOpenLoadedAt = 0;
  const ad = AppOpenAd.createForAdRequest(APP_OPEN_ID);
  appOpen = ad;
  ad.addAdEventListener(AdEventType.LOADED, () => {
    appOpenLoaded = true;
    appOpenLoading = false;
    appOpenLoadedAt = Date.now();
    appOpenRetryCount = 0;
  });
  ad.addAdEventListener(AdEventType.OPENED, () => markAdOpened('appOpen'));
  ad.addAdEventListener(AdEventType.CLOSED, () => {
    appOpenLoaded = false;
    markAdClosed('appOpen');
    loadAppOpen();
  });
  ad.addAdEventListener(AdEventType.ERROR, () => {
    appOpenLoaded = false;
    appOpenLoading = false;
    appOpenRetryCount++;
    markAdClosed('appOpen');
    // App open is opportunistic: back off slowly instead of hammering requests.
    if (appOpenRetryCount <= 3) setTimeout(loadAppOpen, retryDelayMs(appOpenRetryCount + 2));
  });
}

function loadAppOpen(): void {
  if (!appOpen || appOpenLoading || appOpenLoaded) return;
  // Do not even request the format while the player is in the new-user grace.
  if (meta.launchCount <= AD_CONFIG.appOpenSkipFirstLaunches) return;
  appOpenLoading = true;
  try {
    appOpen.load();
  } catch {
    appOpenLoading = false;
  }
}

function maybeShowAppOpen(): void {
  if (!sdkReady || !appOpen || !appOpenLoaded) return;
  const now = Date.now();
  const ok = appOpenAllowed({
    now,
    backgroundedAt,
    lastAppOpenAt: meta.lastAppOpenAt,
    lastFullscreenClosedAt,
    launchCount: meta.launchCount,
    uiState,
    adShowing: adShowing || showingKind !== null,
  });
  if (!ok) return;
  try {
    showingKind = 'appOpen';
    guardShow('appOpen', appOpen.show());
    meta.lastAppOpenAt = now;
    updateMeta({ lastAppOpenAt: now });
  } catch {
    showingKind = null;
    appOpenLoaded = false;
    loadAppOpen();
  }
}

// ─── Freshness + app lifecycle ───────────────────────────────────────────────

// Discard ad objects that sat in memory past their paid lifetime and fetch
// fresh ones. Never touches an ad that is currently on screen.
function refreshStaleAds(): void {
  if (!sdkReady || adShowing || showingKind) return;
  const now = Date.now();
  if (interstitialLoaded && isAdExpired(interstitialLoadedAt, now, AD_CONFIG.adMaxAgeMs)) {
    createInterstitial();
    emitStatus();
  }
  if (rewardedLoaded && isAdExpired(rewardedLoadedAt, now, AD_CONFIG.adMaxAgeMs)) {
    createRewarded();
    emitStatus();
  }
  if (appOpenLoaded && isAdExpired(appOpenLoadedAt, now, AD_CONFIG.appOpenMaxAgeMs)) {
    createAppOpen();
  }
  loadInterstitial();
  loadRewarded();
  loadAppOpen();
}

function onAppStateChange(next: AppStateStatus): void {
  if (next === 'background') {
    backgroundedAt = Date.now();
    return;
  }
  if (next !== 'active') return;
  // The very first init may have been skipped (no consent / offline): retry.
  if (!initialized) {
    initAds().catch(() => {});
    return;
  }
  refreshStaleAds();
  maybeShowAppOpen();
  backgroundedAt = 0;
}

// ─── Privacy: UMP consent, then ATT ──────────────────────────────────────────

// Returns true when ads may be requested. A consent error never blocks ads:
// the UMP SDK falls back to the consent state of the previous session.
async function gatherConsent(): Promise<boolean> {
  try {
    await AdsConsent.gatherConsent();
  } catch (e: any) {
    if (__DEV__) console.warn('[AdMob] consent gathering failed:', errText(e, 'unknown'));
  }
  return readConsentInfo();
}

async function readConsentInfo(): Promise<boolean> {
  try {
    const info = await AdsConsent.getConsentInfo();
    const required =
      info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
    if (required !== privacyOptionsRequired) {
      privacyOptionsRequired = required;
      emitStatus();
    }
    return info.canRequestAds !== false;
  } catch {
    return true;
  }
}

// Opens Google's privacy options form (revoke GDPR consent / US-state opt-out).
// Only reachable from the game's Settings screen, never during a run.
export async function showPrivacyOptions(): Promise<void> {
  if (!privacyOptionsRequired || adShowing) return;
  try {
    await AdsConsent.showPrivacyOptionsForm();
  } catch (e: any) {
    if (__DEV__) console.warn('[AdMob] privacy options form failed:', errText(e, 'unknown'));
  }
  const canRequestAds = await readConsentInfo();
  // A user who had not answered before may have just consented.
  if (canRequestAds && !initialized) initAds();
}

// Under GDPR the ATT prompt only makes sense when the user consented to
// purpose 1 (store/access information on a device).
async function attAllowedByConsent(): Promise<boolean> {
  try {
    const gdprApplies = await AdsConsent.getGdprApplies();
    if (!gdprApplies) return true;
    return (await AdsConsent.getPurposeConsents()).startsWith('1');
  } catch {
    return true;
  }
}

async function requestATT(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    const { requireOptionalNativeModule } = require('expo-modules-core');
    if (!requireOptionalNativeModule('ExpoTrackingTransparency')) return;
    const mod = await import('expo-tracking-transparency');
    const current = await mod.getTrackingPermissionsAsync();
    if (current.status !== 'undetermined') return;
    if (!(await attAllowedByConsent())) return;
    // Let the game explain the prompt first (after the tutorial, in context)
    // instead of throwing the system alert at a cold launch. The fallback
    // timer guarantees ads are never blocked by a missing game message.
    privacyPending = true;
    emitStatus();
    await new Promise<void>((resolve) => {
      privacyResolve = resolve;
      setTimeout(() => {
        // Never put the system alert on top of a live run.
        if (uiState === 'playing') privacyDeferred = true;
        else resolve();
      }, AD_CONFIG.privacyFallbackMs);
    });
    privacyResolve = null;
    privacyDeferred = false;
    privacyPending = false;
    emitStatus();
    await mod.requestTrackingPermissionsAsync();
  } catch {
    // Native module unavailable (e.g. stale simulator binary) — silently skip.
    privacyPending = false;
  }
}

// Called when the game has shown its privacy primer and the player tapped
// Continue: the system ATT prompt may appear now.
export function notifyPrivacyReady(): void {
  privacyResolve?.();
}

// ─── Init ────────────────────────────────────────────────────────────────────

let appStateHooked = false;
let launchCounted = false;

export async function initAds(): Promise<void> {
  if (initialized) return;
  initialized = true;

  if (!appStateHooked) {
    appStateHooked = true;
    AppState.addEventListener('change', onAppStateChange);
  }

  // Count a launch once per process, however many times init is retried.
  if (!launchCounted) {
    launchCounted = true;
    const stored = await loadMeta();
    meta.launchCount = stored.launchCount + 1;
    meta.lastAppOpenAt = stored.lastAppOpenAt;
    updateMeta({ launchCount: meta.launchCount });
  }

  if (__DEV__) console.log('[AdMob] init starting. useTest=', useTest, 'launch=', meta.launchCount);

  const canRequestAds = await gatherConsent();
  if (!canRequestAds) {
    // No consent answer yet: stay un-initialised and retry on next foreground.
    initialized = false;
    return;
  }

  await requestATT();

  try {
    const adapterStatuses = await MobileAds().initialize();
    sdkReady = true;
    if (__DEV__) console.log('[AdMob] SDK initialized. Adapter statuses:', JSON.stringify(adapterStatuses));
    emitStatus();
  } catch (e: any) {
    console.warn('[AdMob] SDK init failed:', errText(e, 'unknown'));
    initialized = false;
    return;
  }

  createInterstitial();
  createRewarded();
  createAppOpen();
  loadInterstitial();
  loadRewarded();
  loadAppOpen();
}

// ─── Show ────────────────────────────────────────────────────────────────────

// Returns true when the ad is going on screen; `onDone` then fires once it is
// closed (or failed to present). Returns false when nothing is shown, in which
// case `onDone` is NOT called and the caller should continue immediately.
export function showInterstitial(onDone?: () => void): boolean {
  if (!sdkReady || !interstitial || adShowing || showingKind) return false;
  const now = Date.now();
  if (!interstitialAllowed({ now, lastInterstitialAt, lastFullscreenClosedAt, launchCount: meta.launchCount })) return false;
  if (interstitialLoaded && isAdExpired(interstitialLoadedAt, now, AD_CONFIG.adMaxAgeMs)) {
    createInterstitial();
    emitStatus();
  }
  if (!interstitialLoaded) {
    loadInterstitial();
    return false;
  }
  try {
    onInterstitialDone = onDone ?? null;
    showingKind = 'interstitial';
    guardShow('interstitial', interstitial.show());
    lastInterstitialAt = now;
    return true;
  } catch (e: any) {
    onInterstitialDone = null;
    showingKind = null;
    interstitialLoaded = false;
    lastInterstitialError = errText(e, 'show() threw');
    console.warn('[AdMob] interstitial show() threw:', lastInterstitialError);
    emitStatus();
    loadInterstitial();
    return false;
  }
}

export function showRewarded(
  reward: string,
  callback: (reward: string) => void,
  onFailed?: (reward: string) => void,
): boolean {
  if (!sdkReady || !rewarded || adShowing || showingKind) return false;
  const now = Date.now();
  if (now - lastRewardedShowAt < AD_CONFIG.rewardedDedupeMs) return false;
  if (rewardedLoaded && isAdExpired(rewardedLoadedAt, now, AD_CONFIG.adMaxAgeMs)) {
    createRewarded();
    emitStatus();
  }
  if (!rewardedLoaded) {
    loadRewarded();
    return false;
  }
  try {
    pendingRewardType = reward;
    onRewardEarned = callback;
    onRewardFailed = onFailed ?? null;
    rewardEarned = false;
    rewardedOpened = false;
    showingKind = 'rewarded';
    guardShow('rewarded', rewarded.show());
    lastRewardedShowAt = now;
    return true;
  } catch (e: any) {
    rewardedLoaded = false;
    onRewardEarned = null;
    onRewardFailed = null;
    showingKind = null;
    lastRewardedError = errText(e, 'show() threw');
    console.warn('[AdMob] rewarded show() threw:', lastRewardedError);
    emitStatus();
    loadRewarded();
    return false;
  }
}

// The game reports its screen so an app-open ad never lands on a live run.
export function setUiState(state: string): void {
  uiState = state;
  if (privacyDeferred && state !== 'playing') {
    privacyDeferred = false;
    privacyResolve?.();
  }
}

export function getAdStatus(): AdStatus {
  return snapshot();
}

// Debug builds only: Google's on-device inspector for ad units and bidders.
export function openAdInspector(): void {
  if (!__DEV__ || !sdkReady) return;
  MobileAds().openAdInspector().catch(() => {});
}
