import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hookBeats, hookSeconds, type HookData } from '../demo/src/lib/hook';

const read = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
const measured = read('data/eval/cc-143-hook/music-measured.json') as { bpm: number; firstBeat: number };

describe('the 20 s hook is cut on the beat', () => {
  for (const f of ['demo/data/hook/hook20.json', 'demo/data/hook/hook20.916.json']) {
    const d = read(f) as HookData;
    it(`${f}: the tempo is the measured one, not a typed one`, () => {
      expect(d.music.bpm).toBe(measured.bpm);
      expect(d.music.start).toBe(measured.firstBeat);
    });
    it(`${f}: every shot is a whole number of beats, 1.5 to 3 s long, and the film is about 20 s`, () => {
      const beat = 60 / d.music.bpm;
      for (const s of d.shots) { expect(Number.isInteger(s.beats)).toBe(true); expect(s.beats * beat).toBeGreaterThanOrEqual(1.5); expect(s.beats * beat).toBeLessThanOrEqual(3); }
      expect(hookBeats(d)).toBe(d.shots.reduce((n, s) => n + s.beats, 0));
      expect(hookSeconds(d)).toBeGreaterThan(19); expect(hookSeconds(d)).toBeLessThan(21);
    });
    it(`${f}: every shot is tagged, and a clip shot names its clip`, () => {
      for (const s of d.shots) { expect(['REAL', 'META', 'GFX']).toContain(s.tag); if (!s.kind) expect(s.src).toBeTruthy(); }
    });
  }
});
