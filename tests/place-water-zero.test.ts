import { describe, expect, it } from 'vitest';
import { laneProfile, newPiece } from '../src/slice/world';

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
