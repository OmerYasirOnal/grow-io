import { useRef, useCallback, useEffect, useState } from 'react';
import { StyleSheet, Platform, ActivityIndicator, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Asset } from 'expo-asset';
import * as Haptics from 'expo-haptics';
import { loadHighScore, saveHighScore, loadCoins, saveCoins } from './storage';
import { showInterstitial, showRewarded, isInterstitialReady, isRewardedReady } from './adService';

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
    }, 500);
    return () => clearTimeout(timer);
  }, [htmlUri, sendToGame]);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg: GameMessage = JSON.parse(event.nativeEvent.data);
      switch (msg.type) {
        case 'SHOW_INTERSTITIAL': {
          const shown = showInterstitial();
          sendToGame({ type: shown ? 'INTERSTITIAL_SHOWN' : 'INTERSTITIAL_FAILED' });
          break;
        }
        case 'SHOW_REWARDED_AD': {
          const requestedReward = msg.data?.reward || 'continue';
          const shown = showRewarded(() => sendToGame({ type: 'AD_REWARD_EARNED', data: { reward: requestedReward } }));
          if (!shown) sendToGame({ type: 'AD_FAILED' });
          break;
        }
        case 'CHECK_AD_READY': {
          sendToGame({
            type: 'AD_STATUS',
            data: { interstitial: isInterstitialReady(), rewarded: isRewardedReady() },
          });
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
