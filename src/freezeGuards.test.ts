import { readFileSync } from 'fs';
import { join } from 'path';

// Guards added after a big-snake freeze report: a feeding frenzy must not flood
// the native bridge with haptics or pile up WebAudio voices.
const html = readFileSync(join(__dirname, '..', 'game', 'index.html'), 'utf8');

function extractFn(source: string, name: string): string {
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
const constLine = (name: string): string => {
  const m = new RegExp(`const ${name}\\s*=\\s*[^;]+;`).exec(html);
  if (!m) throw new Error(`${name} not found`);
  return m[0];
};

describe('haptic throttle (game/index.html)', () => {
  const hapticAllowed = new Function(
    `${constLine('HAPTIC_GAP_MS')} ${extractFn(html, 'hapticAllowed')}; return hapticAllowed;`,
  )() as (kind: string, now: number, last: number) => boolean;

  it('lets at most 5 light haptics a second through', () => {
    let last = -1e9, sent = 0;
    for (let t = 0; t < 1000; t += 5) { // a pellet every 5 ms
      if (hapticAllowed('light', t, last)) { sent++; last = t; }
    }
    expect(sent).toBeLessThanOrEqual(5);
    expect(sent).toBeGreaterThanOrEqual(4);
  });
  it('never drops heavy haptics (death, King, Boss)', () => {
    expect(hapticAllowed('heavy', 1, 0)).toBe(true);
  });
  it('lets unknown kinds through', () => {
    expect(hapticAllowed('other', 1, 0)).toBe(true);
  });
});

describe('audio voice cap (game/index.html)', () => {
  it('caps concurrent tones and frees a voice when it ends', () => {
    const tone = extractFn(html, 'tone');
    expect(html).toMatch(/const MAX_TONES=\d+/);
    expect(tone).toContain('activeTones>=MAX_TONES');
    expect(tone).toMatch(/onended=function\(\)\{activeTones=Math\.max\(0,activeTones-1\)/);
  });
  it('rate-limits the pellet blip', () => {
    expect(extractFn(html, 'sndCollect')).toContain('SND_COLLECT_GAP_MS');
  });
  it('postMsg routes every HAPTIC through the throttle', () => {
    expect(extractFn(html, 'postMsg')).toContain('hapticAllowed(');
  });
});

// The freeze itself: drawObjectivePointers restarted its overlap scan after
// every slide with no bound, so 2+ off-screen targets in one direction (King +
// Boss + treasure + rain) spun forever. placePointer must always terminate.
describe('placePointer (edge badge placement)', () => {
  const placePointer = new Function(
    `${constLine('POINTER_MAX_SLIDES')} ${extractFn(html, 'placePointer')}; return placePointer;`,
  )() as (px: number, py: number, placed: { x: number; y: number }[], top: number, bot: number,
    left: number, right: number, cx: number, cy: number) => { x: number; y: number };
  const W = 430, H = 932, top = 172, bot = H - 140, left = 26, right = W - 26;

  it('terminates when every badge wants the same spot (the old infinite loop)', () => {
    const placed: { x: number; y: number }[] = [];
    for (let i = 0; i < 6; i++) placed.push(placePointer(W / 2 + 10, bot, placed, top, bot, left, right, W / 2, H / 2));
    expect(placed).toHaveLength(6);
  });
  it('terminates for badges straddling the centre on the bottom edge', () => {
    const placed = [{ x: W / 2 - 30, y: bot }, { x: W / 2 + 30, y: bot }];
    const p = placePointer(W / 2, bot, placed, top, bot, left, right, W / 2, H / 2);
    expect(Number.isFinite(p.x)).toBe(true);
  });
  it('terminates when a side badge is pinned in a corner', () => {
    const placed = [{ x: left, y: top }, { x: left, y: top + 50 }, { x: left, y: top + 100 }];
    const p = placePointer(left, top, placed, top, bot, left, right, W / 2, H / 2);
    expect(p.y).toBeGreaterThanOrEqual(top);
    expect(p.y).toBeLessThanOrEqual(bot);
  });
  it('still separates two badges when there is room', () => {
    const placed = [{ x: right, y: 400 }];
    const p = placePointer(right, 400, placed, top, bot, left, right, W / 2, H / 2);
    expect(Math.abs(p.y - 400)).toBeGreaterThanOrEqual(48);
  });
  it('the draw code goes through placePointer (no inline restart loop left)', () => {
    const fn = extractFn(html, 'drawObjectivePointers');
    expect(fn).toContain('placePointer(');
    expect(fn).not.toMatch(/k=-1/);
  });
});
