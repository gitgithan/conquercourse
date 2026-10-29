import { describe, expect, it } from 'vitest';
import { CLIP_RUNNER_FRAC, clipCameraDistance, clipRunnerFraction } from '../src/share/clip';

describe('the clip camera is close (CC-137)', () => {
  const sizes: [number, number][] = [[1280, 720], [1920, 1080], [800, 1000], [390, 844], [2560, 1080]];
  for (const [w, h] of sizes) {
    it(`${w} x ${h}: the runner is at least a third of the frame height`, () => {
      const d = clipCameraDistance(w, h);
      expect(clipRunnerFraction(w, h, d)).toBeGreaterThanOrEqual(1 / 3);
      expect(clipRunnerFraction(w, h, d)).toBeCloseTo(CLIP_RUNNER_FRAC, 6);
    });
  }
  it('is much closer than the normal side camera (25 m) and still farther than the runner is tall', () => {
    const d = clipCameraDistance(1280, 720);
    expect(d).toBeLessThan(8);
    expect(d).toBeGreaterThan(2);
  });
  it('the old view was about a twentieth', () => {
    expect(clipRunnerFraction(1280, 720, 25)).toBeLessThan(0.07);
  });
});
