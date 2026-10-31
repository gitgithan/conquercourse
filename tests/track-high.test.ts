import { describe, expect, it } from 'vitest';
import { clampTrackY, sectionPoints, TRACK_TOP, trackPiece, type TrackPts } from '../src/slice/track-world';
import { laneProfile } from '../src/slice/world';

describe('coaster height', () => {
  it('stops a point at the top and at the floor', () => {
    expect(TRACK_TOP).toBe(100);
    expect(clampTrackY(40)).toBe(40);
    expect(clampTrackY(500)).toBe(100);
    expect(clampTrackY(-3)).toBe(0);
    expect(clampTrackY(7)).toBe(7);
  });
  for (const pts of [[[0, 9], [7, 5], [14, 1], [22, 0.6]], [[0, 9], [7, 50], [14, 1], [22, 0.6]], [[0, 50], [3, 50], [6, 0], [12, 0]], [[0, 9], [7, 5], [14, 0], [22, 0]]] as TrackPts[]) {
    it(`the line runs through each dot of ${JSON.stringify(pts)}`, () => {
      const p = trackPiece(pts, { x: 11, z: 0 });
      const prof = laneProfile([p], { angle: 0, offset: 0, level: 0 });
      const o = prof.origin ?? 0;
      for (const [u, y] of sectionPoints(p, pts, 11, 0)) {
        const k = Math.floor((u - o) / 0.1), near = [k - 1, k, k + 1].map((j) => prof.cells[j]).filter((h): h is number => h != null);
        expect(Math.min(...near.map((h) => Math.abs(h - y)))).toBeLessThan(0.3 + 0.03 * Math.max(...pts.map((q) => q[1]))) // a 0.1 m cell on a steep slope;
      }
    });
  }
});
