import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import GameWebView from './src/GameWebView';
import { initAds } from './src/adService';

export default function App() {
  useEffect(() => {
    initAds();
  }, []);

  // Notes on safe area:
  // - The outer <View> paints the full-bleed background color behind the notch
  //   and the home-indicator so the screen never flashes white while the
  //   WebView is loading or during screen rotation.
  // - <SafeAreaView> keeps the <GameWebView /> inside the readable area, so
  //   HUD elements drawn by the HTML canvas (score, buttons, settings) are
  //   not clipped by the iPhone X / 11 / 12 / ... notch or by the home
  //   indicator at the bottom.
  return (
    <View style={styles.container}>
      <StatusBar style="light" hidden translucent />
      <SafeAreaView style={styles.safe}>
        <GameWebView />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  safe: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
});
