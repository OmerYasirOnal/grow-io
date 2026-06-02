import { readFileSync } from 'fs';
import { join } from 'path';

// game/index.html is a single non-module classic script — its pure functions
// cannot be imported. This file extracts v1.3 helpers the same way
// reconcileGame.test.ts does: read source → regex-extract → new Function → assert.

const html = readFileSync(join(__dirname, '..', 'game', 'index.html'), 'utf8');

// ─── helpers ────────────────────────────────────────────────────────────────

function extractFn(source: string, name: string): string {
  // Match `function <name>(<args>) { ... }` using a brace-depth walk so we
  // aren't tripped up by nested braces.
  const start = source.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`${name} not found in game/index.html`);
  let depth = 0;
  let i = start;
  while (i < source.length) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (depth === 0) break; }
    i++;
  }
  return source.slice(start, i + 1);
}

// ─── 1. levelForXp / xpForLevel ────────────────────────────────────────────

type LevelForXp = (x: number) => number;
type XpForLevel = (L: number) => number;

function loadLevelHelpers(): { levelForXp: LevelForXp; xpForLevel: XpForLevel } {
  // Extract XP_BASE const from source so the functions resolve it.
  const xpBaseMatch = html.match(/const XP_BASE\s*=\s*(\d+)/);
  if (!xpBaseMatch) throw new Error('XP_BASE not found in game/index.html');
  const XP_BASE_VAL = xpBaseMatch[1]; // e.g. "120"

  const fnLevel = extractFn(html, 'levelForXp');
  const fnXp = extractFn(html, 'xpForLevel');

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function(`
    const XP_BASE = ${XP_BASE_VAL};
    ${fnLevel}
    ${fnXp}
    return { levelForXp, xpForLevel };
  `) as () => { levelForXp: LevelForXp; xpForLevel: XpForLevel };
  return factory();
}

describe('levelForXp / xpForLevel (extracted from game/index.html)', () => {
  const { levelForXp, xpForLevel } = loadLevelHelpers();

  it('xpForLevel(1) === 0 (level 1 needs no prior XP)', () => {
    expect(xpForLevel(1)).toBe(0);
  });

  it('round-trips: levelForXp(xpForLevel(L)) === L for L=2..16', () => {
    for (let L = 2; L <= 16; L++) {
      expect(levelForXp(xpForLevel(L))).toBe(L);
    }
  });

  it('one XP below a level threshold returns L-1', () => {
    // xpForLevel(L) is the exact threshold; one below should still be L-1.
    for (let L = 2; L <= 16; L++) {
      const threshold = xpForLevel(L);
      if (threshold > 0) {
        expect(levelForXp(threshold - 1)).toBe(L - 1);
      }
    }
  });

  it('xpForLevel spot-check values (formula: XP_BASE*(L-1)*L/2)', () => {
    // XP_BASE=120: L2=120 L3=360 L4=720 L5=1200 L8=3360 L12=7920 L16=14400
    // Note: the inline comment in game/index.html lists L16=15120 which is stale;
    // the formula XP_BASE*(L-1)*L/2 = 120*15*8 = 14400 is the authoritative value.
    expect(xpForLevel(2)).toBe(120);
    expect(xpForLevel(3)).toBe(360);
    expect(xpForLevel(4)).toBe(720);
    expect(xpForLevel(5)).toBe(1200);
    expect(xpForLevel(8)).toBe(3360);
    expect(xpForLevel(12)).toBe(7920);
    expect(xpForLevel(16)).toBe(14400);
  });
});

// ─── 2. _parseHex ──────────────────────────────────────────────────────────

type ParseHex = (c: string) => { r: number; g: number; b: number };

function loadParseHex(): ParseHex {
  const fnSrc = extractFn(html, '_parseHex');
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function(`${fnSrc}\nreturn _parseHex;`) as () => ParseHex;
  return factory();
}

describe('_parseHex (extracted from game/index.html)', () => {
  const parseHex = loadParseHex();

  it('preserves 00 bytes — #00e5ff → {r:0, g:229, b:255} (v1.3 fix guard)', () => {
    expect(parseHex('#00e5ff')).toEqual({ r: 0, g: 229, b: 255 });
  });

  it('parses a fully-opaque non-zero color correctly — #ff7a18 → {r:255, g:122, b:24}', () => {
    expect(parseHex('#ff7a18')).toEqual({ r: 255, g: 122, b: 24 });
  });

  it('falls back to {255,255,255} on a garbage/NaN channel (#zzzzzz)', () => {
    expect(parseHex('#zzzzzz')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('expands 3-char shorthand — #fff → {r:255, g:255, b:255}', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('expands 3-char shorthand with non-trivial value — #0ef → {r:0, g:238, b:255}', () => {
    expect(parseHex('#0ef')).toEqual({ r: 0, g: 238, b: 255 });
  });

  it('handles missing/falsy input — falls back to white', () => {
    // @ts-expect-error testing runtime null/undefined guard
    expect(parseHex(null)).toEqual({ r: 255, g: 255, b: 255 });
  });
});

// ─── 3. skinRail ──────────────────────────────────────────────────────────

type SkinRail = (sk: { u: string }) => 'free' | 'earn' | 'coins';

function loadSkinRail(): SkinRail {
  const fnSrc = extractFn(html, 'skinRail');
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function(`${fnSrc}\nreturn skinRail;`) as () => SkinRail;
  return factory();
}

describe('skinRail (extracted from game/index.html)', () => {
  const skinRail = loadSkinRail();

  it('u==="free" → "free"', () => {
    expect(skinRail({ u: 'free' })).toBe('free');
  });

  it('s-prefixed u → "earn" (score-unlock rail)', () => {
    expect(skinRail({ u: 's1000' })).toBe('earn');
    expect(skinRail({ u: 's30000' })).toBe('earn');
  });

  it('k-prefixed u → "coins" (coins-only shop rail)', () => {
    expect(skinRail({ u: 'k20' })).toBe('coins');
  });

  it('l-prefixed u → "coins"', () => {
    expect(skinRail({ u: 'l100' })).toBe('coins');
    expect(skinRail({ u: 'l500' })).toBe('coins');
  });

  it('g-prefixed u → "coins"', () => {
    expect(skinRail({ u: 'g100' })).toBe('coins');
  });
});

// ─── 4. Daily-mission PRNG determinism ─────────────────────────────────────
// NOTE: _rollMissions itself is entangled with module-level state (MISSION_POOL,
// isTR, todayKey, L, missionDay, etc.) and cannot be cleanly extracted in
// isolation. We therefore test only the two standalone PRNG/hash helpers:
// _missionSeed (FNV-1a string hash) and _missionPrng (mulberry32 variant).
// This guards the core determinism property: same seed → same sequence.

type MissionPrng = (seed: number) => () => number;
type MissionSeed = (key: string) => number;

function loadPrngHelpers(): { _missionPrng: MissionPrng; _missionSeed: MissionSeed } {
  const fnPrng = extractFn(html, '_missionPrng');
  const fnSeed = extractFn(html, '_missionSeed');
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function(`
    ${fnPrng}
    ${fnSeed}
    return { _missionPrng, _missionSeed };
  `) as () => { _missionPrng: MissionPrng; _missionSeed: MissionSeed };
  return factory();
}

describe('_missionPrng / _missionSeed determinism (extracted from game/index.html)', () => {
  const { _missionPrng, _missionSeed } = loadPrngHelpers();

  it('same seed string yields the same first 5 values on two independent runs', () => {
    const key = '2026-6-2';
    const seed = _missionSeed(key);
    const rng1 = _missionPrng(seed);
    const rng2 = _missionPrng(seed);
    for (let i = 0; i < 5; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('different seed strings yield different first values', () => {
    const v1 = _missionPrng(_missionSeed('2026-6-1'))();
    const v2 = _missionPrng(_missionSeed('2026-6-2'))();
    expect(v1).not.toBe(v2);
  });

  it('PRNG output is in [0, 1)', () => {
    const rng = _missionPrng(_missionSeed('test-key'));
    for (let i = 0; i < 20; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('_missionSeed is stable: same input always produces the same integer', () => {
    expect(_missionSeed('2026-6-1')).toBe(_missionSeed('2026-6-1'));
    expect(_missionSeed('hello')).toBe(_missionSeed('hello'));
  });
});
