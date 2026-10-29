import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CROSSFADE_S, MUSIC_VOLUME, SCREENS, crossfadeGains, musicOn, screenFor } from '../src/ui/music';

// CC-132: the loops are numbers-checked, not heard: the seam of each loop must be no bigger than an ordinary step of the wave.
describe('music', () => {
  it('is off unless asked, and ?music=0 turns it off', () => {
    expect(musicOn('')).toBe(false);
    expect(musicOn('?course=x')).toBe(false);
    expect(musicOn('?music=1')).toBe(true);
    expect(musicOn('?music=0')).toBe(false);
  });
  it('plays quietly', () => {
    expect(MUSIC_VOLUME).toBeLessThanOrEqual(0.3);
    expect(CROSSFADE_S).toBeGreaterThan(0.5);
  });
  it('gives each mode a screen that has a track', () => {
    for (const m of ['course', 'map', 'editor', 'dojo', 'coaster', 'lab-search', 'park', 'gallery']) expect(SCREENS).toContain(screenFor(m));
    expect(screenFor('map')).toBe('map');
    expect(screenFor('dojo')).toBe('dojo');
    expect(screenFor('editor')).toBe('editor');
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
      expect(Math.abs(row!.seconds - row!.bars * 4 * 60 / row!.bpm), `${s} bars`).toBeLessThan(0.05);
      expect(row!.rms).toBeCloseTo(0.1, 2); // the same loudness on every screen
    }
  });
  it("keeps the Report loop soft: little energy above 5 kHz, well below what it had before the high-shelf", () => {
    const m = JSON.parse(readFileSync('public/assets/music/loops.json', 'utf8')) as { screen: string; hf_share_5k: number; hf_share_5k_before: number }[];
    const r = m.find((x) => x.screen === 'report')!;
    expect(r.hf_share_5k).toBeLessThan(0.001);
    expect(r.hf_share_5k).toBeLessThan(r.hf_share_5k_before / 5);
  });
});
