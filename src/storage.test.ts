import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadHighScore, saveHighScore,
  loadCoins, saveCoins,
  loadStats, saveStats,
  loadSkinState, saveSkinState,
} from './storage';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('high score', () => {
  it('defaults to 0 when nothing is stored', async () => {
    expect(await loadHighScore()).toBe(0);
  });

  it('round-trips a saved score', async () => {
    await saveHighScore(4200);
    expect(await loadHighScore()).toBe(4200);
  });

  it('returns 0 for non-numeric garbage', async () => {
    await AsyncStorage.setItem('grow-io_high_score', 'not-a-number');
    expect(await loadHighScore()).toBe(0);
  });
});

describe('coins', () => {
  it('defaults to 0 when nothing is stored', async () => {
    expect(await loadCoins()).toBe(0);
  });

  it('round-trips a saved balance', async () => {
    await saveCoins(1234);
    expect(await loadCoins()).toBe(1234);
  });

  it('returns 0 for non-numeric garbage', async () => {
    await AsyncStorage.setItem('grow-io_coins', 'corrupt');
    expect(await loadCoins()).toBe(0);
  });
});

describe('stats', () => {
  it('defaults to all-zero', async () => {
    expect(await loadStats()).toEqual({ totalKills: 0, totalGames: 0, totalDeaths: 0 });
  });

  it('round-trips and clamps non-number fields to 0', async () => {
    await AsyncStorage.setItem(
      'grow-io_stats',
      JSON.stringify({ totalKills: 7, totalGames: 'x', totalDeaths: null }),
    );
    expect(await loadStats()).toEqual({ totalKills: 7, totalGames: 0, totalDeaths: 0 });
  });

  it('survives corrupt JSON', async () => {
    await AsyncStorage.setItem('grow-io_stats', '{not json');
    expect(await loadStats()).toEqual({ totalKills: 0, totalGames: 0, totalDeaths: 0 });
  });

  it('round-trips via saveStats', async () => {
    await saveStats({ totalKills: 3, totalGames: 9, totalDeaths: 5 });
    expect(await loadStats()).toEqual({ totalKills: 3, totalGames: 9, totalDeaths: 5 });
  });
});

describe('skin state', () => {
  it('defaults to Classic unlocked', async () => {
    expect(await loadSkinState()).toEqual({ current: 0, unlocked: [0] });
  });

  it('always keeps skin 0 unlocked even if persisted data drops it', async () => {
    await AsyncStorage.setItem(
      'grow-io_skin_state',
      JSON.stringify({ current: 2, unlocked: [2, 5] }),
    );
    const state = await loadSkinState();
    expect(state.unlocked).toContain(0);
    expect(state.current).toBe(2);
  });

  it('filters non-number entries out of unlocked', async () => {
    await AsyncStorage.setItem(
      'grow-io_skin_state',
      JSON.stringify({ current: 0, unlocked: [0, 'x', 3, null, 4] }),
    );
    expect((await loadSkinState()).unlocked).toEqual([0, 3, 4]);
  });

  it('round-trips via saveSkinState', async () => {
    await saveSkinState({ current: 3, unlocked: [0, 1, 3] });
    expect(await loadSkinState()).toEqual({ current: 3, unlocked: [0, 1, 3] });
  });
});
