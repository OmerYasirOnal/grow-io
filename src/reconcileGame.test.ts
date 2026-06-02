import { readFileSync } from 'fs';
import { join } from 'path';

// game/index.html is a single non-module classic script, so its pure functions
// cannot be imported. This test extracts the money-critical reconcileLoadedCoins
// straight from the game source and runs it, so `npm test` guards both refund
// vectors (a stale-high native can never RAISE coins; a stale-low can never erase
// them) even though there is no in-game test harness. If the function is renamed
// or its signature changes, this fails loudly.
type Reconcile = (localCoins: number, hadLocal: boolean, nativeCoins: number, firstLoad: boolean) => number;

function loadReconcileFromGame(): Reconcile {
  const html = readFileSync(join(__dirname, '..', 'game', 'index.html'), 'utf8');
  const m = html.match(/function reconcileLoadedCoins\([^)]*\)\s*\{[\s\S]*?\n\}/);
  if (!m) throw new Error('reconcileLoadedCoins not found in game/index.html');
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function(`${m[0]}\nreturn reconcileLoadedCoins;`) as () => Reconcile;
  return factory();
}

describe('reconcileLoadedCoins (extracted from game/index.html)', () => {
  const reconcile = loadReconcileFromGame();

  it('hadLocal=true keeps local, ignoring a stale-HIGH native (refund-raise vector closed)', () => {
    expect(reconcile(120, true, 9999, true)).toBe(120);
  });
  it('hadLocal=true keeps local, ignoring a stale-LOW native (no erase)', () => {
    expect(reconcile(120, true, 0, true)).toBe(120);
  });
  it('!hadLocal restores the native floor PLUS this-session local (disjoint, no double-count)', () => {
    expect(reconcile(40, false, 300, true)).toBe(340);
  });
  it('!hadLocal clamps a negative/garbage native to 0', () => {
    expect(reconcile(0, false, -5, true)).toBe(0);
  });
  it('non-firstLoad always keeps local (native never re-applies after boot)', () => {
    expect(reconcile(50, false, 999, false)).toBe(50);
  });
});
