import { describe, expect, it } from 'vitest';
import { beatTimes, bedVolume, snapToBeat, type Bed } from '../demo/src/lib/music';

const bed: Bed = { src: 'music/x.mp3', bpm: 120, firstBeat: 0.25, level: 0.8, duckLevel: 0.3, fadeIn: 1, fadeOut: 2 };

describe('music bed', () => {
  it('fades in, holds, and fades out', () => {
    expect(bedVolume(bed, [], 0, 20)).toBe(0);
    expect(bedVolume(bed, [], 10, 20)).toBeCloseTo(0.8);
    expect(bedVolume(bed, [], 20, 20)).toBe(0);
  });
  it('ducks inside a voice window and comes back', () => {
    const duck = [{ from: 5, to: 9 }];
    expect(bedVolume(bed, duck, 7, 20)).toBeCloseTo(0.3);
    expect(bedVolume(bed, duck, 4, 20)).toBeCloseTo(0.8);
    expect(bedVolume(bed, duck, 5.125, 20)).toBeLessThan(0.8);
    expect(bedVolume(bed, duck, 5.125, 20)).toBeGreaterThan(0.3);
  });
  it('lists beats and snaps cuts to them', () => {
    const beats = beatTimes(bed, 2);
    expect(beats[0]).toBeCloseTo(0.25);
    expect(beats[1] - beats[0]).toBeCloseTo(0.5);
    expect(snapToBeat(bed, 3.1)).toBeCloseTo(3.25);
    expect(snapToBeat(bed, 3.1, 4)).toBeCloseTo(2.25);
  });
});
