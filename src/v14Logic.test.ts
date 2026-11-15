import { readFileSync } from 'fs';
import { join } from 'path';

// game/index.html is a single classic script, so its pure helpers are tested
// the same way v13Logic.test.ts does: read source → extract → new Function.

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

type Eligible = (
  runsThisSession: number, runsSinceLastAd: number, watchedRewarded: boolean,
  runSeconds: number, tutorialOpen: boolean,
) => boolean;

describe('interstitialEligible (extracted from game/index.html)', () => {
  const interstitialEligible = new Function(
    `${extractFn(html, 'interstitialEligible')}; return interstitialEligible;`,
  )() as Eligible;

  it('fires after every second run since the last full-screen ad', () => {
    expect(interstitialEligible(2, 2, false, 45, false)).toBe(true);
    expect(interstitialEligible(7, 3, false, 20, false)).toBe(true);
  });
  it('skips the run right after an ad unless that run was long', () => {
    expect(interstitialEligible(3, 1, false, 60, false)).toBe(false);
    expect(interstitialEligible(3, 1, false, 150, false)).toBe(true);
  });
  it('never fires after the first run of a session', () => {
    expect(interstitialEligible(1, 1, false, 400, false)).toBe(false);
  });
  it('never fires after a run where the player already watched a rewarded ad', () => {
    expect(interstitialEligible(5, 4, true, 200, false)).toBe(false);
  });
  it('never fires after a very short run or while the tutorial is open', () => {
    expect(interstitialEligible(5, 4, false, 19.9, false)).toBe(false);
    expect(interstitialEligible(5, 4, false, 120, true)).toBe(false);
  });
});

// The economy is data: prices come from the rarity table, coin-ad rewards from
// a fixed ladder. These guard the relationships the shop UI relies on.
describe('v1.4 economy tables', () => {
  const constSrc = (name: string): string => {
    const m = new RegExp(`const ${name}\\s*=\\s*([\\s\\S]*?);[ \\t]*(?://[^\\n]*)?\\n`).exec(html);
    if (!m) throw new Error(`${name} not found`);
    return m[1];
  };
  const RARITY = new Function(`return (${constSrc('RARITY')});`)() as Record<string, { price: number }>;
  const SKINS = new Function(`return (${constSrc('SKINS')});`)() as { name: string; u: string; r: string }[];
  const TRAILS = new Function(`return (${constSrc('TRAILS')});`)() as { id: string; price: number }[];
  const ladder = new Function(`return (${constSrc('COIN_AD_REWARDS')});`)() as number[];
  const skinPrice = new Function(
    'RARITY', 'isTR',
    `${extractFn(html, 'skinRail')}; ${extractFn(html, 'rarityOf')}; ${extractFn(html, 'skinPrice')}; return skinPrice;`,
  )(RARITY, false) as (sk: { u: string; r: string }) => number;
  const coinAdReward = new Function(
    'COIN_AD_REWARDS', `${extractFn(html, 'coinAdReward')}; return coinAdReward;`,
  )(ladder) as (n: number) => number;

  it('keeps the first 20 skins in their persisted order (saves store indices)', () => {
    expect(SKINS.slice(0, 20).map((s) => s.name)).toEqual([
      'Classic', 'Lime', 'Sunset', 'Hot Pink', 'Gold', 'Neon Blue', 'Neon Green', 'Ice', 'Lava', 'Royal',
      'Fire', 'Forest', 'Blood', 'Reaper', 'Phantom', 'Python', 'Cobra', 'Leviathan', 'Matrix', 'Rainbow',
    ]);
  });
  it('gives every skin a known rarity and a price that follows it', () => {
    for (const sk of SKINS) {
      expect(RARITY[sk.r]).toBeDefined();
      expect(skinPrice(sk)).toBe(sk.u === 'free' ? 0 : RARITY[sk.r].price);
      if (sk.u !== 'free') expect(skinPrice(sk)).toBeGreaterThan(0);
    }
  });
  it('orders rarity prices strictly upwards', () => {
    const p = ['common', 'rare', 'epic', 'legendary', 'mythic'].map((k) => RARITY[k].price);
    expect(p[0]).toBe(0);
    for (let i = 1; i < p.length; i++) expect(p[i]).toBeGreaterThan(p[i - 1]);
  });
  it('keeps trail prices ascending and the first trail free', () => {
    expect(TRAILS[0].price).toBe(0);
    for (let i = 1; i < TRAILS.length; i++) expect(TRAILS[i].price).toBeGreaterThan(TRAILS[i - 1].price);
  });
  it('pays a fixed, rising amount per coin ad and clamps past the ladder', () => {
    expect(ladder).toHaveLength(5);
    for (let i = 1; i < ladder.length; i++) expect(ladder[i]).toBeGreaterThan(ladder[i - 1]);
    expect(coinAdReward(0)).toBe(ladder[0]);
    expect(coinAdReward(4)).toBe(ladder[4]);
    expect(coinAdReward(99)).toBe(ladder[4]);
    expect(coinAdReward(-3)).toBe(ladder[0]);
  });
  it('makes one coin ad worth a meaningful share of the cheapest skin', () => {
    // A rewarded ad must never be a rounding error next to shop prices.
    expect(ladder[0] / RARITY.rare.price).toBeGreaterThanOrEqual(0.05);
  });
  it('makes the post-run double ad pay at least the floor, and nothing for a 0-coin run', () => {
    const floor = Number(constSrc('DOUBLE_MIN_REWARD'));
    const doubleReward = new Function(
      'DOUBLE_MIN_REWARD', `${extractFn(html, 'doubleReward')}; return doubleReward;`,
    )(floor) as (earned: number) => number;
    expect(doubleReward(0)).toBe(0);
    expect(doubleReward(6)).toBe(floor);
    expect(doubleReward(floor + 50)).toBe(floor + 50);
    // The death screen offers it for any run that earned coins.
    expect(html).toContain('const showDouble=lastRunEarned>0&&!doubleClaimed;');
  });
  it('no longer rounds every pellet up to a whole coin', () => {
    expect(html).not.toContain('Math.max(1,Math.floor(pts*0.3))');
    expect(html).toContain('coinCarry+=pts*FOOD_COIN_RATE');
  });
});

describe('v1.4 structural guards', () => {
  it('requests the interstitial only from leaveDeathScreen, never at the moment of death', () => {
    const killSnake = extractFn(html, 'killSnake');
    expect(killSnake).not.toContain('SHOW_INTERSTITIAL');
    expect(extractFn(html, 'leaveDeathScreen')).toContain("postMsg({type:'SHOW_INTERSTITIAL'})");
    expect(html.split("type:'SHOW_INTERSTITIAL'").length - 1).toBe(1);
  });
  it('routes every rewarded placement through requestRewarded (single in-flight lock)', () => {
    expect(html.split("type:'SHOW_REWARDED_AD'").length - 1).toBe(1);
    expect(extractFn(html, 'requestRewarded')).toContain('rewardPendingT');
  });
  it('offers no revive after a Rush timeout', () => {
    expect(extractFn(html, 'deathLayout')).toContain("killerName!=='time'");
  });
  it('loads no font or script from the network (works offline)', () => {
    expect(html).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
    expect(html).toContain("font-family:'Orbitron'");
    expect(html).toContain("font-family:'Rajdhani'");
  });
  it('wires the privacy options entry point on both sides of the bridge', () => {
    // Google requires an in-app way to reopen the consent form once a GDPR or
    // US-states message is published; the game row and the native handler must agree.
    expect(html.split("type:'OPEN_PRIVACY_OPTIONS'").length - 1).toBe(1);
    expect(html).toContain('privacyOptions:!!m.data.privacyOptionsRequired');
    const host = readFileSync(join(__dirname, 'GameWebView.tsx'), 'utf8');
    expect(host).toContain("case 'OPEN_PRIVACY_OPTIONS':");
    const ads = readFileSync(join(__dirname, 'adService.ts'), 'utf8');
    expect(ads).toContain('AdsConsent.showPrivacyOptionsForm()');
  });
  it('hides the privacy row unless the host reports it as required', () => {
    const settingsLayout = new Function(
      'W', 'H', 'sat', 'sab', 'adReady',
      `${extractFn(html, 'settingsLayout')}; return settingsLayout();`,
    );
    const off = settingsLayout(375, 812, 47, 34, { privacyOptions: false });
    const on = settingsLayout(375, 812, 47, 34, { privacyOptions: true });
    expect(off.privacy).toBeNull();
    // Two volume sliders, two toggles, language and DONE, stacked top to bottom.
    expect(off.sfx.y).toBeLessThan(off.music.y);
    expect(off.music.y).toBeLessThan(off.vib.y);
    expect(off.lang.y).toBeLessThan(off.done.y);
    expect(on.privacy.y).toBeGreaterThan(on.done.y + on.done.h);
    expect(on.privacy.y + on.privacy.h).toBeLessThan(812 - 34);
    // Small phone (iPhone SE 1st gen): the row must still fit on screen.
    const se = settingsLayout(320, 568, 20, 0, { privacyOptions: true });
    expect(se.privacy.y + se.privacy.h).toBeLessThan(568);
  });
  it('gives bots unique player-style names and caps the giants', () => {
    const names = new Function(`return (${/const BOT_NAMES = (\[[\s\S]*?\]);/.exec(html)![1]});`)() as string[];
    expect(names.length).toBeGreaterThanOrEqual(60);
    expect(new Set(names).size).toBe(names.length);
    expect(html).toContain("name:isPlayer?(isTR?'Sen':'You'):pickBotName(),");
    expect(html).toMatch(/const GIANT_MAX = [12];/);
  });
  it('keeps bonus zones fair: richer multipliers are smaller, shorter and rarer', () => {
    const types = new Function(`return (${/const ZONE_TYPES = (\[[\s\S]*?\]);/.exec(html)![1]});`)() as
      { mult: number; r: number; life: number[]; w: number }[];
    expect(types.map((z) => z.mult)).toEqual([1.2, 1.5, 2, 2.5]);
    for (let i = 1; i < types.length; i++) {
      expect(types[i].r).toBeLessThan(types[i - 1].r);
      expect(types[i].life[1]).toBeLessThan(types[i - 1].life[1]);
      expect(types[i].w).toBeLessThan(types[i - 1].w);
    }
  });
  it('gives every hero skin a known power and keeps bots out of hero skins', () => {
    const skins = new Function(`return (${/const SKINS = (\[[\s\S]*?\]);\n/.exec(html)![1]});`)() as
      { name: string; r: string; power?: string }[];
    const heroes = skins.filter((k) => k.power);
    expect(heroes.map((k) => k.power).sort()).toEqual(['blade', 'claws', 'jet', 'orbit']);
    heroes.forEach((k) => expect(k.r).toBe('hero'));
    // Hero skins are appended after every regular skin.
    const first = skins.findIndex((k) => k.power);
    expect(skins.slice(first).every((k) => k.power)).toBe(true);
    expect(html).toContain('b.skin=randInt(5,HERO_FIRST-1);');
    expect(html).toContain('b.skin=randInt(0,HERO_FIRST-1);');
  });
  it('keeps the in-game version stamp in sync with app.json', () => {
    const appVersion = JSON.parse(readFileSync(join(__dirname, '..', 'app.json'), 'utf8')).expo.version;
    expect(html).toContain(`'v${appVersion}'`);
  });
});
