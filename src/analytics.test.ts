import { cleanName, cleanParams, trackEvent } from './analytics';

(global as any).__DEV__ = false;

describe('analytics sanitising', () => {
  test('event names follow Firebase rules', () => {
    expect(cleanName('run_end')).toBe('run_end');
    expect(cleanName('skin-buy now')).toBe('skin_buy_now');
    expect(cleanName('9lives')).toBe('lives');
    expect(cleanName('firebase_x')).toBeNull();
    expect(cleanName('')).toBeNull();
    expect(cleanName('a'.repeat(60))!.length).toBe(40);
  });

  test('params keep numbers/strings, map booleans, drop objects', () => {
    expect(
      cleanParams({ mode: 'classic', score: 120, revived: true, x: { a: 1 }, n: NaN, s: 'z'.repeat(150) }),
    ).toEqual({ mode: 'classic', score: 120, revived: 1, s: 'z'.repeat(100) });
    expect(cleanParams(null)).toEqual({});
  });

  test('trackEvent is a no-op without the native module', () => {
    expect(() => trackEvent('run_end', { score: 1 })).not.toThrow();
  });
});
