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

export interface Stats { totalKills: number; totalGames: number; totalDeaths: number; blob?: Record<string, unknown>; }

export async function loadStats(): Promise<Stats> {
  try {
    const raw = await AsyncStorage.getItem(STATS_KEY);
    if (!raw) return { totalKills: 0, totalGames: 0, totalDeaths: 0 };
    const parsed = JSON.parse(raw);
    const out: Stats = {
      totalKills: typeof parsed.totalKills === 'number' ? parsed.totalKills : 0,
      totalGames: typeof parsed.totalGames === 'number' ? parsed.totalGames : 0,
      totalDeaths: typeof parsed.totalDeaths === 'number' ? parsed.totalDeaths : 0,
    };
    if (parsed.blob && typeof parsed.blob === 'object' && !Array.isArray(parsed.blob)) out.blob = parsed.blob;
    return out;
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

// App-level bookkeeping that is not game state: launch counter (new-player ad
// grace), last app-open ad time, and which version already asked for a review.
const META_KEY = 'grow-io_meta';

export interface AppMeta { launchCount: number; lastAppOpenAt: number; reviewAskedVersion: string; }

const DEFAULT_META: AppMeta = { launchCount: 0, lastAppOpenAt: 0, reviewAskedVersion: '' };

export async function loadMeta(): Promise<AppMeta> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    if (!raw) return { ...DEFAULT_META };
    const p = JSON.parse(raw);
    return {
      launchCount: typeof p.launchCount === 'number' && p.launchCount >= 0 ? Math.floor(p.launchCount) : 0,
      lastAppOpenAt: typeof p.lastAppOpenAt === 'number' && p.lastAppOpenAt >= 0 ? p.lastAppOpenAt : 0,
      reviewAskedVersion: typeof p.reviewAskedVersion === 'string' ? p.reviewAskedVersion : '',
    };
  } catch {
    return { ...DEFAULT_META };
  }
}

// Serialised read-merge-write so two modules (ads, review) updating different
// fields can never overwrite each other's value with a stale copy.
let metaChain: Promise<unknown> = Promise.resolve();

export function updateMeta(patch: Partial<AppMeta>): Promise<AppMeta> {
  const run = async (): Promise<AppMeta> => {
    const next = { ...(await loadMeta()), ...patch };
    try { await AsyncStorage.setItem(META_KEY, JSON.stringify(next)); } catch {}
    return next;
  };
  const p = metaChain.then(run, run);
  metaChain = p;
  return p;
}
