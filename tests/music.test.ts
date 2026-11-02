import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CROSSFADE_S, FADE_IN_S, MUSIC_VOLUME, SCREENS, crossfadeGains, musicOn, screenFor } from '../src/ui/music';

// CC-132: the loops are numbers-checked, not heard: the seam of each loop must be no bigger than an ordinary step of the wave.
describe('music', () => {
  it('is on by default for players, silent in automated browsers, and ?music=0 turns it off', () => {
    expect(musicOn('', false)).toBe(true);
    expect(musicOn('?course=x', false)).toBe(true);
    expect(musicOn('?music=1', false)).toBe(true);
    expect(musicOn('?music=0', false)).toBe(false);
    expect(musicOn('', true)).toBe(false); // tests stay silent
    expect(musicOn('?music=1', true)).toBe(true); // unless a flag asks for it
  });
  it('plays quietly', () => {
    expect(MUSIC_VOLUME).toBeLessThanOrEqual(0.3);
    expect(CROSSFADE_S).toBeGreaterThan(0.5);
    expect(FADE_IN_S).toBeGreaterThanOrEqual(2);
  });
  it('gives each mode a screen that has a track', () => {
    for (const m of ['course', 'map', 'editor', 'dojo', 'coaster', 'lab-search', 'park', 'gallery']) expect(SCREENS).toContain(screenFor(m));
    expect(screenFor('map')).toBe('map');
    expect(screenFor('dojo')).toBe('dojo');
    expect(screenFor('editor')).toBe('editor');
    expect(screenFor('gallery')).toBe('library');
    // CC-118: every Lab mode borrows the Dojo mood
    for (const m of ['search', 'optimization', 'ik', 'vision', 'camera', 'integration', 'timing', 'signal', 'gentest', 'detector', 'hashing', 'rl']) expect(screenFor(`lab-${m}`)).toBe('dojo');
  });
  it('crossfades with constant power, from all-out to all-in', () => {
    for (let i = 0; i <= 10; i++) { const g = crossfadeGains(i / 10); expect(g.out ** 2 + g.in ** 2).toBeCloseTo(1, 9); }
    expect(crossfadeGains(0)).toEqual({ out: 1, in: 0 });
    expect(crossfadeGains(2).in).toBeCloseTo(1, 9);
  });
  it('ships one measured loop per screen whose wrap is smooth and whose length is whole bars', () => {
    const manifest = JSON.parse(readFileSync('public/assets/music/loops.json', 'utf8')) as { screen: string; bpm: number; bars: number; seconds: number; seam_ratio: number; rms: number }[];
    for (const s of SCREENS) {
      const row = manifest.find((r) => r.screen === s);
      expect(row, s).toBeTruthy();
      expect(existsSync(`public/assets/music/${s}.ogg`), s).toBe(true);
      expect(row!.seam_ratio, `${s} seam`).toBeLessThan(4); // the jump at the wrap is within a few ordinary steps
      if (row!.bpm > 0) expect(Math.abs(row!.seconds - row!.bars * 4 * 60 / row!.bpm), `${s} bars`).toBeLessThan(0.05); // bpm 0 = free tempo (the Dojo cave loop): only the smooth wrap counts
      expect(row!.rms).toBeCloseTo(s === 'dojo' ? 0.05 : 0.1, 2); // the same loudness on every screen, except the Dojo cave loop, which the product owner asked for at half level
    }
  });
  it('keeps the bright loops soft: under 0.1% of the energy above 5 kHz on the Report and the library', () => {
    const m = JSON.parse(readFileSync('public/assets/music/loops.json', 'utf8')) as { screen: string; hf_share_5k: number }[];
    for (const s of ['report', 'library']) expect(m.find((x) => x.screen === s)!.hf_share_5k, s).toBeLessThan(0.001);
  });
});
