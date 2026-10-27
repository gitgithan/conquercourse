import { describe, expect, it } from 'vitest';
import { clears, fixLayout } from '../src/slice/fixit';
import { newPiece, scaleBy, type Piece } from '../src/slice/world';
import type { Mesh } from '../src/slice/slice';

function box(w: number, h: number, d: number): Mesh {
  const [x0, x1, y0, y1, z0, z1] = [-w / 2, w / 2, 0, h, -d / 2, d / 2];
  const p = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
  const q = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
  return { positions: p, indices: q };
}
const lane = { angle: 0, offset: 0, level: 0 };

describe('fix it', () => {
  it('turns a wall too tall to jump into a layout the simulator clears', () => {
    const ps: Piece[] = [newPiece('Low box', box(4, 0.5, 1.5), { x: 3, z: 0 }), newPiece('Tall wall', box(4, 1.6, 1.5), { x: 8, z: 0 })];
    expect(clears(ps, lane)).toBe(false);
    const r = fixLayout(ps, lane);
    expect(r.ok).toBe(true);
    expect(clears(r.pieces, r.lane)).toBe(true);
    expect(r.steps.length).toBeGreaterThan(0);
  });
  it('fixes a block made ten times too big', () => {
    const big = scaleBy(newPiece('Block', box(1, 0.5, 1), { x: 8, z: 0 }), 10);
    const ps: Piece[] = [newPiece('Low box', box(4, 0.5, 1.5), { x: 3, z: 0 }), big];
    const r = fixLayout(ps, lane);
    expect(r.ok).toBe(true);
  });
  it('leaves a layout that already works alone', () => {
    const ps: Piece[] = [newPiece('Low box', box(4, 0.5, 1.5), { x: 3, z: 0 }), newPiece('Step', box(4, 0.9, 1.5), { x: 9, z: 0 })];
    const r = fixLayout(ps, lane);
    expect(r.ok).toBe(true);
    expect(r.steps).toEqual([]);
  });
});
