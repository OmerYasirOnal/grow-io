import { readFileSync } from 'fs';
import { join } from 'path';
import { Script } from 'vm';

// A syntax error anywhere in game/index.html stops the whole game from
// loading, and the per-function tests above extract only pieces of it. Compile
// every inline <script> as a whole so a missing comma can never ship.
const html = readFileSync(join(__dirname, '..', 'game', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

describe('game/index.html scripts', () => {
  it('has the iPad shim and the game script', () => {
    expect(scripts.length).toBeGreaterThanOrEqual(2);
  });
  it.each(scripts.map((src, i) => [i, src]))('script %i compiles', (_i, src) => {
    expect(() => new Script(src as string)).not.toThrow();
  });
});
