import { describe, expect, it } from 'vitest';
import { clampTrackY, limitTrackPoint, sectionPoints, TRACK_TOP, trackPiece, type TrackPts } from '../src/slice/track-world';
import { laneProfile } from '../src/slice/world';

describe('a dragged dot is stopped, and says why', () => {
  const pts: TrackPts = [[0, 9], [7, 5], [14, 1], [22, 0.6]];
  it('the lowest dot cannot go under the lane level', () => {
    expect(limitTrackPoint(pts, 3, 22, -3, 0, 1)).toMatchObject({ y: 0.6, block: 'floor' }); // lowest dot is already on the ground
    expect(limitTrackPoint(pts, 3, 22, -3, 2, 1)).toMatchObject({ y: 0, block: 'floor' }); // lifted 2 m: it may go down to local 0 at most
    expect(limitTrackPoint(pts, 3, 22, 3, 0, 1).block).toBe('');
  });
  it('a dot keeps its spacing from the next one', () => {
    expect(limitTrackPoint(pts, 2, 21.8, 1, 0, 1)).toMatchObject({ x: 21.5, block: 'spacing' });
    expect(limitTrackPoint(pts, 2, 10, 1, 0, 1).block).toBe('');
  });
  it('there is no design top, only the 1000 m safety value', () => {
    expect(limitTrackPoint(pts, 1, 7, 600, 0, 1)).toMatchObject({ y: 600, block: '' });
    expect(limitTrackPoint(pts, 1, 7, 5000, 0, 1)).toMatchObject({ y: 1000, block: 'ceiling' });
  });
});

describe('coaster height', () => {
  it('stops a point at the top and at the floor', () => {
    expect(TRACK_TOP).toBe(1000);
    expect(clampTrackY(40)).toBe(40);
    expect(clampTrackY(5000)).toBe(1000);
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
