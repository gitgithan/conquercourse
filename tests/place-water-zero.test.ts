import { describe, expect, it } from 'vitest';
import { laneProfile, liftToRoof, newPiece } from '../src/slice/world';
import { setRoofStart } from '../src/slice/slice';

// A place that arrives from the Slicer with its cut height must read the same lane when the water is moved to 0 and the place sinks by that height.
describe('water at 0 after the Slicer', () => {
  it('sinking the place by the cut height gives the same lane at level 0', () => {
    const positions: number[] = [], indices: number[] = [];
    const box = (x0: number, x1: number, h: number) => { const b = positions.length / 3; for (const [x, y, z] of [[x0, 0, -2], [x1, 0, -2], [x1, h, -2], [x0, h, -2], [x0, 0, 2], [x1, 0, 2], [x1, h, 2], [x0, h, 2]]) positions.push(x, y, z); for (const t of [[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [3, 2, 6], [3, 6, 7], [0, 5, 1], [0, 4, 5], [1, 5, 6], [1, 6, 2], [0, 3, 7], [0, 7, 4]]) indices.push(b + t[0], b + t[1], b + t[2]); };
    box(-6, -1, 3); box(0, 5, 3.4);
    const up = newPiece('a', { positions, indices });
    const down = { ...newPiece('a', { positions, indices }), y: -3 };
    const a = laneProfile([up], { angle: 0, offset: 0, level: 3 });
    const b = laneProfile([down], { angle: 0, offset: 0, level: 0 });
    expect(b.cells.map((h) => (h === null ? null : Math.round(h * 100) / 100))).toEqual(a.cells.map((h) => (h === null ? null : Math.round(h * 100) / 100)));
  });
});

// CC-165: Valletta's roofs stand 5.62 m above its base but its proved cut is 6 m; with the roof start the lane read empty until the place is lifted to the water line.
describe('a place proved a little under its cut', () => {
  it('reads empty at the cut, then reads once lifted', () => {
    const positions: number[] = [], indices: number[] = [];
    const b = 0, top = 5.62;
    for (const [x, y, z] of [[-6, b, -2], [6, b, -2], [6, top, -2], [-6, top, -2], [-6, b, 2], [6, b, 2], [6, top, 2], [-6, top, 2]]) positions.push(x, y, z);
    for (const t of [[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [3, 2, 6], [3, 6, 7], [0, 4, 5], [0, 5, 1], [0, 3, 7], [0, 7, 4], [1, 5, 6], [1, 6, 2]]) indices.push(...t);
    const p = { ...newPiece('v', { positions, indices }), y: -6 };
    const lane = { angle: 0, offset: 0, level: 0 };
    setRoofStart(true);
    try {
      expect(laneProfile([p], lane).length).toBe(0);
      const lift = liftToRoof([p], lane);
      expect(lift).toBeGreaterThan(0.37);
      expect(lift).toBeLessThan(0.4);
      expect(laneProfile([{ ...p, y: p.y + lift }], lane).length).toBeGreaterThan(8);
      expect(liftToRoof([{ ...p, y: p.y + lift }], lane)).toBe(0);
    } finally { setRoofStart(false); }
  });
});
