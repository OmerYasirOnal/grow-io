import AsyncStorage from '@react-native-async-storage/async-storage';

const HIGH_SCORE_KEY = 'grow-io_high_score';
const COINS_KEY = 'grow-io_coins';
const STATS_KEY = 'grow-io_stats';
const SKIN_STATE_KEY = 'grow-io_skin_state';

export async function loadHighScore(): Promise<number> {
  try { const n = parseInt((await AsyncStorage.getItem(HIGH_SCORE_KEY)) ?? '', 10); return Number.isFinite(n) ? n : 0; }
  catch { return 0; }
}

export async function saveHighScore(score: number): Promise<void> {
  try { await AsyncStorage.setItem(HIGH_SCORE_KEY, score.toString()); } catch {}
}

export async function loadCoins(): Promise<number> {
  try { const n = parseInt((await AsyncStorage.getItem(COINS_KEY)) ?? '', 10); return Number.isFinite(n) ? n : 0; }
  catch { return 0; }
}

export async function saveCoins(coins: number): Promise<void> {
  try { await AsyncStorage.setItem(COINS_KEY, coins.toString()); } catch {}
}

export interface Stats { totalKills: number; totalGames: number; totalDeaths: number; }

export async function loadStats(): Promise<Stats> {
  try {
    const raw = await AsyncStorage.getItem(STATS_KEY);
    if (!raw) return { totalKills: 0, totalGames: 0, totalDeaths: 0 };
    const parsed = JSON.parse(raw);
    return {
      totalKills: typeof parsed.totalKills === 'number' ? parsed.totalKills : 0,
      totalGames: typeof parsed.totalGames === 'number' ? parsed.totalGames : 0,
      totalDeaths: typeof parsed.totalDeaths === 'number' ? parsed.totalDeaths : 0,
    };
  } catch {
    return { totalKills: 0, totalGames: 0, totalDeaths: 0 };
  }
}

export async function saveStats(stats: Stats): Promise<void> {
  try { await AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch {}
}

export interface SkinState { current: number; unlocked: number[]; }

export async function loadSkinState(): Promise<SkinState> {
  try {
    const raw = await AsyncStorage.getItem(SKIN_STATE_KEY);
    if (!raw) return { current: 0, unlocked: [0] };
    const parsed = JSON.parse(raw);
    const current = typeof parsed.current === 'number' ? parsed.current : 0;
    const unlocked = Array.isArray(parsed.unlocked)
      ? parsed.unlocked.filter((n: unknown) => typeof n === 'number')
      : [0];
    if (!unlocked.includes(0)) unlocked.push(0);
    return { current, unlocked };
  } catch {
    return { current: 0, unlocked: [0] };
  }
}

export async function saveSkinState(state: SkinState): Promise<void> {
  try { await AsyncStorage.setItem(SKIN_STATE_KEY, JSON.stringify(state)); } catch {}
}
