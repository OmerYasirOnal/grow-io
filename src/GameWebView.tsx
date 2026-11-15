import { useRef, useCallback, useEffect, useState } from 'react';
import { StyleSheet, Platform, Image, View, AppState } from 'react-native';
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
import { trackEvent } from './analytics';
import { WATCHDOG, newWatchdogState, shouldRecover, PING_JS } from './webviewWatchdog';

const gameAsset = require('../game/index.html');
const splashArt = require('../assets/splash-icon.png');

interface GameMessage { type: string; data?: any; }

export default function GameWebView() {
  const webViewRef = useRef<WebView>(null);
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  // Remounting the WebView (new key) is how a frozen or crashed page recovers.
  const [webKey, setWebKey] = useState(0);
  const watchdog = useRef(newWatchdogState(Date.now()));
  const adOpenRef = useRef(false);
  const lastLightHapticAt = useRef(0);

  const recover = useCallback((reason: 'unresponsive' | 'terminated') => {
    const now = Date.now();
    watchdog.current.lastRecoveryAt = now;
    watchdog.current.lastPongAt = now;
    trackEvent('webview_recovered', { reason });
    setWebKey((k) => k + 1);
  }, []);

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
    setAdLifecycleListener((open) => {
      adOpenRef.current = open;
      sendToGame({ type: open ? 'AD_OPENED' : 'AD_CLOSED' });
    });
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
      // Coming back from the background: give the page a fresh grace period.
      if (next === 'active') watchdog.current.lastPongAt = Date.now();
      sendToGame({ type: 'APP_STATE', data: { active: next === 'active' } });
    });
    return () => sub.remove();
  }, [htmlUri, sendToGame]);

  // Watchdog: ping the page; remount it if it stops answering in the foreground.
  useEffect(() => {
    if (!htmlUri) return;
    watchdog.current.lastPongAt = Date.now();
    const id = setInterval(() => {
      const active = AppState.currentState === 'active';
      if (shouldRecover(watchdog.current, Date.now(), active, adOpenRef.current)) {
        recover('unresponsive');
        return;
      }
      if (active) webViewRef.current?.injectJavaScript(PING_JS);
    }, WATCHDOG.PING_MS);
    return () => clearInterval(id);
  }, [htmlUri, webKey, recover]);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg: GameMessage = JSON.parse(event.nativeEvent.data);
      // Any message proves the page is alive.
      watchdog.current.lastPongAt = Date.now();
      switch (msg.type) {
        case 'PONG':
          break;
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
          if (typeof msg.data?.event === 'string') trackEvent(msg.data.event, msg.data.props);
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
          // Second line of defence behind the game's own throttle. iOS drops
          // haptic traffic above ~32 Hz and each impact is several messages, so
          // light taps go out at most every 150 ms.
          if (msg.data !== 'heavy' && msg.data !== 'medium') {
            const now = Date.now();
            if (now - lastLightHapticAt.current < 150) break;
            lastLightHapticAt.current = now;
          }
          if (Platform.OS !== 'web') {
            const style = msg.data === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy
              : msg.data === 'medium' ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Light;
            Haptics.impactAsync(style).catch(() => {});
          }
          break;
      }
    } catch {}
  }, [sendToGame]);

  if (!htmlUri) {
    return (
      <View style={[styles.webview, styles.loading]}>
        {/* Same artwork and framing as the native splash, so the hand-off to
            the game (whose menu then plays its logo intro) has no visible jump. */}
        <Image source={splashArt} style={styles.splash} resizeMode="contain" />
      </View>
    );
  }

  return (
    <WebView
      key={webKey}
      ref={webViewRef}
      onContentProcessDidTerminate={() => recover('terminated')}
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
  splash: { width: '100%', aspectRatio: 1 },
});
