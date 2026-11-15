// Firebase Analytics bridge for the game's TRACK messages.
//
// The native module is required lazily so Jest (and any build without the
// Firebase pods) never crashes: when it is missing, logging is a no-op.

type Props = Record<string, unknown> | null | undefined;

let analyticsMod: any | undefined;

function getAnalytics(): any | null {
  if (analyticsMod === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('@react-native-firebase/analytics');
      analyticsMod = mod.getAnalytics ? mod.getAnalytics() : mod.default();
    } catch {
      analyticsMod = null;
    }
  }
  return analyticsMod;
}

// Firebase rules: event and param names are letters, digits and underscores,
// start with a letter, at most 40 chars; string values at most 100 chars.
export function cleanName(name: string): string | null {
  const s = String(name || '')
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/^[^A-Za-z]+/, '')
    .slice(0, 40);
  if (!s || /^(firebase_|google_|ga_)/.test(s)) return null;
  return s;
}

export function cleanParams(props: Props): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (!props || typeof props !== 'object') return out;
  let n = 0;
  for (const [k, v] of Object.entries(props)) {
    if (n >= 25) break;
    const key = cleanName(k);
    if (!key) continue;
    if (typeof v === 'number' && isFinite(v)) out[key] = v;
    else if (typeof v === 'boolean') out[key] = v ? 1 : 0;
    else if (typeof v === 'string') out[key] = v.slice(0, 100);
    else continue;
    n++;
  }
  return out;
}

export function trackEvent(event: string, props?: Props): void {
  const name = cleanName(event);
  if (!name) return;
  const params = cleanParams(props);
  if (__DEV__) console.log('[track]', name, params);
  const a = getAnalytics();
  if (!a) return;
  try {
    const p = a.logEvent(name, params);
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    // Analytics must never break the game.
  }
}
