import { readFileSync } from 'fs';
import { join } from 'path';

// v1.4 polish after device play: food never vanishes on screen, shields block
// one hit, big spawns grow in gradually, lobbies vary, more costumes.
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
const skins = new Function(`return (${/const SKINS = (\[[\s\S]*?\]);\n/.exec(html)![1]});`)() as
  { name: string; nameTR: string; r: string; power?: string; c: string[]; p: string }[];

describe('food recycling', () => {
  it('recycles an off-screen pellet before any visible one', () => {
    const make = new Function('foods', 'onScreen', `let foodEvict=0; ${extractFn(html, 'pickEvictSlot')}; return pickEvictSlot;`);
    const foods = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 5000, y: 5000 }, { x: 20, y: 20 }];
    const onScreen = (x: number) => x < 1000;
    const pick = make(foods, onScreen) as () => number;
    expect(pick()).toBe(2);
  });
  it('keeps ambient food below the hard cap so drops have room', () => {
    const target = +/const FOOD_TARGET = (\d+);/.exec(html)![1];
    const max = +/const MAX_FOOD = (\d+)/.exec(html)![1];
    expect(max - target).toBeGreaterThanOrEqual(150);
    expect(extractFn(html, 'spawnFood')).toContain('if(!force&&foods.length>=FOOD_TARGET)return;');
  });
});

describe('shield', () => {
  it('blocks exactly one hit and then breaks', () => {
    const make = new Function('spawnShock', 'sndPowerup', 'postMsg', 'addScorePopup', 'isTR',
      `${extractFn(html, 'shieldSave')}; return shieldSave;`);
    const noop = () => {};
    const shieldSave = make(noop, noop, noop, noop, false) as (o: unknown) => boolean;
    const o = { powerups: { shield: 5 }, invulnTimer: 0, isPlayer: false, segments: [{ x: 0, y: 0 }] };
    expect(shieldSave(o)).toBe(true);
    expect(o.powerups.shield).toBe(0);
    expect(o.invulnTimer).toBeGreaterThan(0);
    expect(shieldSave(o)).toBe(false);
  });
  it('no longer makes the snake intangible for the whole power-up', () => {
    expect(extractFn(html, 'checkCollisions')).toContain('if(s.invulnTimer<=0&&s.powerups.ghost<=0){');
  });
});

describe('gradual growth and lobbies', () => {
  it('starts big spawns small and grows them toward the target', () => {
    const setGrowth = new Function(`const SPAWN_LEN_CAP=6000; ${extractFn(html, 'setGrowth')}; return setGrowth;`)() as
      (o: Record<string, number>, t: number, f: number, s: number) => void;
    const o: Record<string, number> = {};
    setGrowth(o, 2000, 0.5, 25);
    expect(o.length).toBe(1000);
    expect(o.growTo).toBe(2000);
    expect(o.growRate).toBeCloseTo(40);
    setGrowth(o, 2e7, 0.5, 25);
    expect(o.growTo).toBe(6000);
  });
  it('rolls mixed, easy and sharp lobbies', () => {
    const lobbies = new Function(`return ${/const LOBBIES=(\[[^\]]+\]);/.exec(html)![1]};`)() as
      { name: string; w: number; lo: number; hi: number }[];
    expect(lobbies.map((l) => l.name)).toEqual(['mixed', 'easy', 'sharp']);
    lobbies.forEach((l) => { expect(l.lo).toBeLessThan(l.hi); expect(l.hi).toBeLessThanOrEqual(1); });
    expect(html).toContain('lobby=rollLobby();');
  });
  it('King and Boss grow into their size instead of spawning at full length', () => {
    expect(html).toContain('k.isKing=true;setGrowth(k,');
    expect(html).toMatch(/b\.isBoss=true;[\s\S]{0,400}setGrowth\(b,/);
  });
});

describe('costumes', () => {
  it('has unique English and Turkish names for every skin', () => {
    expect(new Set(skins.map((k) => k.name)).size).toBe(skins.length);
    expect(new Set(skins.map((k) => k.nameTR)).size).toBe(skins.length);
  });
  it('appends the costume pack after the heroes (saves store indices)', () => {
    expect(skins.length).toBe(38);
    expect(skins.slice(24, 28).every((k) => !!k.power)).toBe(true);
    expect(skins.slice(28).every((k) => !k.power)).toBe(true);
  });
  it('only uses patterns the renderer knows', () => {
    const known = new Set(['solid', 'neon', 'gradient', 'striped', 'dotted', 'rainbow']);
    skins.forEach((k) => expect(known.has(k.p)).toBe(true));
  });
});

describe('chapters (campaign)', () => {
  const chapters = new Function(`return ${/const CHAPTERS=(\[[\s\S]*?\]);\n/.exec(html)![1]};`)() as
    { key: string; en: string; tr: string; bots: number; lobby: string; goals: [string, number][]; reward: number; deco: string }[];
  it('has seven themed chapters with known goals', () => {
    expect(chapters).toHaveLength(7);
    const known = new Set(['eggs', 'gems', 'length', 'kills', 'king']);
    chapters.forEach((c) => {
      expect(c.goals.length).toBeGreaterThan(0);
      c.goals.forEach(([t, n]) => { expect(known.has(t)).toBe(true); expect(n).toBeGreaterThan(0); });
      expect(['easy', 'mixed', 'sharp']).toContain(c.lobby);
    });
    expect(new Set(chapters.map((c) => c.deco)).size).toBe(7);
  });
  it('gets harder and pays more as you go', () => {
    for (let i = 1; i < chapters.length; i++) {
      expect(chapters[i].reward).toBeGreaterThan(chapters[i - 1].reward);
      expect(chapters[i].bots).toBeGreaterThanOrEqual(chapters[i - 1].bots);
    }
  });
  it('only the last chapter needs the King, and it is reachable there', () => {
    expect(chapters.filter((c) => c.goals.some(([t]) => t === 'king')).map((c) => c.key)).toEqual(['galaxy']);
    expect(html).toContain("nextKingScore=ch.goals.some(function(g){return g[0]==='king';})?700:3000;");
  });
  it('persists progress in the blob store and clamps it on load', () => {
    const load = extractFn(html, 'loadChapters');
    expect(load).toContain("loadBlob('chap'");
    expect(load).toContain('Math.min(CHAPTERS.length');
    expect(html).toContain('loadChapters();');
  });
  it('keeps the chapter mode out of the plain mode cards', () => {
    expect(html).toContain("const MODE_CARDS = MODES.filter(function(m){return m.id!=='chapter';});");
  });
});

describe('chapter competition', () => {
  it('bots chase nests/gems in chapters and actually eat them', () => {
    const bot = extractFn(html, 'updateBot');
    expect(bot).toContain("if(mode==='chapter'&&Math.random()<0.3+0.45*bot.skill){");
    const upd = extractFn(html, 'updateChapter');
    expect(upd).toContain('botAte(');
    expect(upd.indexOf('botAte(')).toBeLessThan(upd.indexOf('if(!player||!player.alive)return;'));
  });
});

describe('Android back', () => {
  it('pauses a run, goes up a screen and only exits from the bare menu', () => {
    const fn = extractFn(html, 'handleBack');
    expect(fn).toContain("if(state==='playing'){pauseGame();return;}");
    expect(fn).toContain("postMsg({type:'EXIT_APP'})");
    expect(fn.indexOf('showSettings')).toBeLessThan(fn.indexOf("EXIT_APP"));
    expect(html).toContain("if(m.type==='BACK'){handleBack();return;}");
  });
});
