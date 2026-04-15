import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import GameWebView from './src/GameWebView';
import { initAds } from './src/adService';

export default function App() {
  useEffect(() => {
    initAds();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" hidden translucent />
      <GameWebView />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
});
