import AsyncStorage from '@react-native-async-storage/async-storage';

const HIGH_SCORE_KEY = 'grow-io_high_score';

export async function loadHighScore(): Promise<number> {
  try { const val = await AsyncStorage.getItem(HIGH_SCORE_KEY); return val ? parseInt(val, 10) : 0; }
  catch { return 0; }
}

export async function saveHighScore(score: number): Promise<void> {
  try { await AsyncStorage.setItem(HIGH_SCORE_KEY, score.toString()); } catch {}
}
