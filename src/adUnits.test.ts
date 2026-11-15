import { AD_UNITS, adUnitsFor } from './adPolicy';

const TEST = { interstitial: 't-i', rewarded: 't-r', appOpen: 't-a' };

describe('ad units per platform', () => {
  it('iOS release uses the production units', () => {
    expect(adUnitsFor('ios', false, TEST)).toEqual(AD_UNITS.ios);
  });
  it('dev / forced test builds always use Google test units', () => {
    expect(adUnitsFor('ios', true, TEST)).toEqual(TEST);
    expect(adUnitsFor('android', true, TEST)).toEqual(TEST);
  });
  it('Android never borrows the iOS units', () => {
    const u = adUnitsFor('android', false, TEST);
    expect(u.interstitial).not.toBe(AD_UNITS.ios.interstitial);
    expect(u.rewarded).not.toBe(AD_UNITS.ios.rewarded);
  });
  it('production units belong to the Grow.io publisher', () => {
    for (const id of Object.values(AD_UNITS.ios)) expect(id).toMatch(/^ca-app-pub-9920930529636149\/\d+$/);
    for (const id of Object.values(AD_UNITS.android)) if (id) expect(id).toMatch(/^ca-app-pub-9920930529636149\/\d+$/);
  });
});
