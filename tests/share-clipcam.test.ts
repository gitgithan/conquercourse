import { describe, expect, it } from 'vitest';
import { CLIP_RUNNER_FRAC, CLOSE_TALL, MARKER_BELOW, VIEW_TALL, VIEW_WIDE, clipCameraDistance, clipLayoutFor, clipRunnerFraction, clipViewMetres } from '../src/share/clip';

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

describe('the clip shows about 20 m of course (CC-160)', () => {
  const sizes: [number, number][] = [[1280, 720], [1920, 1080], [800, 1000], [390, 844], [2560, 1080]];
  for (const layout of [VIEW_TALL, VIEW_WIDE]) {
    for (const [w, h] of sizes) {
      it(`${layout.shape} ${layout.w}x${layout.h} from a ${w} x ${h} view: 20 m across`, () => {
        const d = clipCameraDistance(w, h, layout);
        expect(clipViewMetres(w, h, d, layout)).toBeCloseTo(20, 6);
      });
    }
  }
  it('the close view is still about 2.9 m across (?clipzoom=close)', () => {
    const d = clipCameraDistance(1280, 720);
    expect(clipViewMetres(1280, 720, d)).toBeLessThan(3.5);
  });
  it('the tall picture makes the runner small (a ring is drawn), the wide one keeps them readable', () => {
    const tall = clipRunnerFraction(1280, 720, clipCameraDistance(1280, 720, VIEW_TALL), VIEW_TALL);
    const wide = clipRunnerFraction(1280, 720, clipCameraDistance(1280, 720, VIEW_WIDE), VIEW_WIDE);
    expect(tall).toBeLessThan(MARKER_BELOW);
    expect(wide).toBeGreaterThan(0.12);
  });
  it('the camera is not nearer than the scenery allows (not closer than 12 m)', () => {
    expect(clipCameraDistance(1280, 720, VIEW_TALL)).toBeGreaterThan(12);
    expect(clipCameraDistance(1280, 720, VIEW_WIDE)).toBeGreaterThan(12);
  });
  it('the address picks the layout', () => {
    expect(clipLayoutFor('')).toBe(VIEW_TALL);
    expect(clipLayoutFor('?clipshape=wide')).toBe(VIEW_WIDE);
    expect(clipLayoutFor('?clipzoom=close')).toBe(CLOSE_TALL);
  });
});
