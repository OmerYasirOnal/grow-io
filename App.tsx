import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import GameWebView from './src/GameWebView';
import { initAds } from './src/adService';

export default function App() {
  useEffect(() => {
    initAds().catch((err) => {
      if (__DEV__) console.warn('[adService] initAds failed:', err);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar style="light" hidden translucent />
        {/* Full bleed: the game draws behind the notch / home indicator and
            keeps its UI clear of them itself (env(safe-area-inset-*) in
            game/index.html). A SafeAreaView here left flat black bands. */}
        <View style={styles.safe}>
          <GameWebView />
        </View>
      </View>
    </SafeAreaProvider>
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
