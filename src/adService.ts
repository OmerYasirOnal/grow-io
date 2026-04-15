import {
  InterstitialAd, RewardedAd, AdEventType, RewardedAdEventType, TestIds,
} from 'react-native-google-mobile-ads';

// ⚠️ REPLACE with real AdMob IDs after creating ad units
const INTERSTITIAL_ID = __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-9920930529636149/5392741755';
const REWARDED_ID = __DEV__ ? TestIds.REWARDED : 'ca-app-pub-9920930529636149/5762833880';

const interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_ID);
const rewarded = RewardedAd.createForAdRequest(REWARDED_ID);
let interstitialLoaded = false, rewardedLoaded = false;
let onRewardEarned: ((reward: string) => void) | null = null;

export function initAds() {
  interstitial.addAdEventListener(AdEventType.LOADED, () => { interstitialLoaded = true; });
  interstitial.addAdEventListener(AdEventType.CLOSED, () => { interstitialLoaded = false; interstitial.load(); });
  interstitial.addAdEventListener(AdEventType.ERROR, () => { interstitialLoaded = false; setTimeout(() => interstitial.load(), 5000); });
  interstitial.load();

  rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => { rewardedLoaded = true; });
  rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { if (onRewardEarned) onRewardEarned('continue'); onRewardEarned = null; });
  rewarded.addAdEventListener(AdEventType.CLOSED, () => { rewardedLoaded = false; rewarded.load(); });
  rewarded.addAdEventListener(AdEventType.ERROR, () => { rewardedLoaded = false; setTimeout(() => rewarded.load(), 5000); });
  rewarded.load();
}

export function showInterstitial(): boolean { if (interstitialLoaded) { interstitial.show(); return true; } return false; }
export function showRewarded(callback: (reward: string) => void): boolean { if (rewardedLoaded) { onRewardEarned = callback; rewarded.show(); return true; } return false; }
