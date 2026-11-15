import { useRef, useCallback, useEffect, useState } from 'react';
import { StyleSheet, Platform, ActivityIndicator, View, AppState } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Asset } from 'expo-asset';
import * as Haptics from 'expo-haptics';
import {
  loadHighScore, saveHighScore, loadCoins, saveCoins,
  loadStats, saveStats, loadSkinState, saveSkinState,
  type Stats, type SkinState,
} from './storage';
import {
  showInterstitial, showRewarded, getAdStatus,
  setAdStatusListener, setAdLifecycleListener,
  notifyPrivacyReady, setUiState, openAdInspector, showPrivacyOptions,
} from './adService';
import { requestStoreReview } from './review';

const gameAsset = require('../game/index.html');

interface GameMessage { type: string; data?: any; }

export default function GameWebView() {
  const webViewRef = useRef<WebView>(null);
  const [htmlUri, setHtmlUri] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const asset = Asset.fromModule(gameAsset);
      await asset.downloadAsync();
      setHtmlUri(asset.localUri || asset.uri);
    })();
  }, []);

  const sendToGame = useCallback((msg: GameMessage) => {
    webViewRef.current?.injectJavaScript(
      `window.postMessage(${JSON.stringify(JSON.stringify(msg))}, '*'); true;`
    );
  }, []);

  useEffect(() => {
    if (!htmlUri) return;
    const timer = setTimeout(() => {
      loadHighScore().then((s) => sendToGame({ type: 'HIGH_SCORE_LOADED', data: s }));
      loadCoins().then((c) => sendToGame({ type: 'COINS_LOADED', data: c }));
      loadStats().then((s) => sendToGame({ type: 'STATS_LOADED', data: s }));
      loadSkinState().then((s) => sendToGame({ type: 'SKIN_STATE_LOADED', data: s }));
    }, 500);
    return () => clearTimeout(timer);
  }, [htmlUri, sendToGame]);

  useEffect(() => {
    if (!htmlUri) return;
    setAdStatusListener((s) => sendToGame({ type: 'AD_STATUS', data: s }));
    // The game pauses and mutes itself while a full-screen ad is on screen.
    setAdLifecycleListener((open) => sendToGame({ type: open ? 'AD_OPENED' : 'AD_CLOSED' }));
    return () => {
      setAdStatusListener(null);
      setAdLifecycleListener(null);
    };
  }, [htmlUri, sendToGame]);

  // Tell the game when the app leaves/returns to the foreground so it can
  // pause a live run and stop audio instead of running blind in the background.
  useEffect(() => {
    if (!htmlUri) return;
    const sub = AppState.addEventListener('change', (next) => {
      sendToGame({ type: 'APP_STATE', data: { active: next === 'active' } });
    });
    return () => sub.remove();
  }, [htmlUri, sendToGame]);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg: GameMessage = JSON.parse(event.nativeEvent.data);
      switch (msg.type) {
        case 'SHOW_INTERSTITIAL': {
          // SHOWN is followed by INTERSTITIAL_CLOSED once the ad is dismissed;
          // FAILED means nothing was shown and the game continues right away.
          const shown = showInterstitial(() => sendToGame({ type: 'INTERSTITIAL_CLOSED' }));
          sendToGame({ type: shown ? 'INTERSTITIAL_SHOWN' : 'INTERSTITIAL_FAILED' });
          break;
        }
        case 'PRIVACY_READY':
          notifyPrivacyReady();
          break;
        case 'OPEN_PRIVACY_OPTIONS':
          showPrivacyOptions();
          break;
        case 'UI_STATE':
          if (typeof msg.data === 'string') setUiState(msg.data);
          break;
        case 'REQUEST_REVIEW':
          requestStoreReview();
          break;
        case 'TRACK':
          // Analytics hook: forward to the analytics SDK once one is chosen.
          if (__DEV__) console.log('[track]', msg.data?.event, msg.data?.props ?? '');
          break;
        case 'OPEN_AD_INSPECTOR':
          openAdInspector();
          break;
        case 'SHOW_REWARDED_AD': {
          const requestedReward = msg.data?.reward || 'continue';
          const shown = showRewarded(
            requestedReward,
            (reward) => sendToGame({ type: 'AD_REWARD_EARNED', data: { reward } }),
            // Accepted but never made it on screen: release the game's tap lock.
            (reward) => sendToGame({ type: 'AD_FAILED', data: { reward } }),
          );
          if (!shown) sendToGame({ type: 'AD_FAILED', data: { reward: requestedReward } });
          break;
        }
        case 'CHECK_AD_READY': {
          sendToGame({ type: 'AD_STATUS', data: getAdStatus() });
          break;
        }
        case 'SAVE_HIGH_SCORE':
          if (typeof msg.data === 'number') saveHighScore(msg.data);
          break;
        case 'LOAD_HIGH_SCORE':
          loadHighScore().then((s) => sendToGame({ type: 'HIGH_SCORE_LOADED', data: s }));
          break;
        case 'SAVE_COINS':
          if (typeof msg.data === 'number') saveCoins(msg.data);
          break;
        case 'LOAD_COINS':
          loadCoins().then((c) => sendToGame({ type: 'COINS_LOADED', data: c }));
          break;
        case 'SAVE_STATS':
          if (msg.data && typeof msg.data === 'object') saveStats(msg.data as Stats);
          break;
        case 'LOAD_STATS':
          loadStats().then((s) => sendToGame({ type: 'STATS_LOADED', data: s }));
          break;
        case 'SAVE_SKIN_STATE':
          if (msg.data && typeof msg.data === 'object') saveSkinState(msg.data as SkinState);
          break;
        case 'LOAD_SKIN_STATE':
          loadSkinState().then((s) => sendToGame({ type: 'SKIN_STATE_LOADED', data: s }));
          break;
        case 'HAPTIC':
          if (Platform.OS !== 'web') {
            const style = msg.data === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy
              : msg.data === 'medium' ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Light;
            Haptics.impactAsync(style);
          }
          break;
      }
    } catch {}
  }, [sendToGame]);

  if (!htmlUri) {
    return (
      <View style={[styles.webview, styles.loading]}>
        <ActivityIndicator size="large" color="#00e5ff" />
      </View>
    );
  }

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: htmlUri }}
      style={styles.webview}
      onMessage={onMessage}
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled
      domStorageEnabled
      startInLoadingState={false}
      originWhitelist={['*']}
      allowFileAccess
      allowFileAccessFromFileURLs
      allowUniversalAccessFromFileURLs
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      allowsBackForwardNavigationGestures={false}
      hideKeyboardAccessoryView
      textInteractionEnabled={false}
      setSupportMultipleWindows={false}
      pullToRefreshEnabled={false}
      androidLayerType="hardware"
      applicationNameForUserAgent="AKISGames/1.0"
    />
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: '#0a0a1a' },
  loading: { justifyContent: 'center', alignItems: 'center' },
});
