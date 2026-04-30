import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
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
        <SafeAreaView style={styles.safe}>
          <GameWebView />
        </SafeAreaView>
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
