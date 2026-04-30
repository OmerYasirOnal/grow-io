import AsyncStorage from '@react-native-async-storage/async-storage';

const HIGH_SCORE_KEY = 'grow-io_high_score';
const COINS_KEY = 'grow-io_coins';
const STATS_KEY = 'grow-io_stats';
const SKIN_STATE_KEY = 'grow-io_skin_state';
const QUESTS_KEY = 'grow-io_quests';
const INVENTORY_KEY = 'grow-io_inventory';
const SELECTED_MAP_KEY = 'grow-io_selected_map';

export async function loadHighScore(): Promise<number> {
  try { const val = await AsyncStorage.getItem(HIGH_SCORE_KEY); return val ? parseInt(val, 10) : 0; }
  catch { return 0; }
}

export async function saveHighScore(score: number): Promise<void> {
  try { await AsyncStorage.setItem(HIGH_SCORE_KEY, score.toString()); } catch {}
}

export async function loadCoins(): Promise<number> {
  try { const val = await AsyncStorage.getItem(COINS_KEY); return val ? parseInt(val, 10) : 0; }
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

export interface Quest {
  id: string; type: string; target: number; progress: number;
  reward: number; claimed: boolean; tier: number;
}
export interface QuestState { date: string; quests: Quest[]; }

export async function loadQuests(): Promise<QuestState | null> {
  try {
    const raw = await AsyncStorage.getItem(QUESTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.date !== 'string' || !Array.isArray(parsed.quests)) return null;
    return parsed as QuestState;
  } catch { return null; }
}

export async function saveQuests(state: QuestState): Promise<void> {
  try { await AsyncStorage.setItem(QUESTS_KEY, JSON.stringify(state)); } catch {}
}

export interface Inventory { revives: number; doubleCoins: number; scoreMult: number; }

export async function loadInventory(): Promise<Inventory> {
  try {
    const raw = await AsyncStorage.getItem(INVENTORY_KEY);
    if (!raw) return { revives: 0, doubleCoins: 0, scoreMult: 0 };
    const parsed = JSON.parse(raw);
    return {
      revives: typeof parsed.revives === 'number' ? parsed.revives : 0,
      doubleCoins: typeof parsed.doubleCoins === 'number' ? parsed.doubleCoins : 0,
      scoreMult: typeof parsed.scoreMult === 'number' ? parsed.scoreMult : 0,
    };
  } catch { return { revives: 0, doubleCoins: 0, scoreMult: 0 }; }
}

export async function saveInventory(inv: Inventory): Promise<void> {
  try { await AsyncStorage.setItem(INVENTORY_KEY, JSON.stringify(inv)); } catch {}
}

export async function loadSelectedMap(): Promise<string> {
  try { return (await AsyncStorage.getItem(SELECTED_MAP_KEY)) || 'neon'; } catch { return 'neon'; }
}

export async function saveSelectedMap(id: string): Promise<void> {
  try { await AsyncStorage.setItem(SELECTED_MAP_KEY, id); } catch {}
}
