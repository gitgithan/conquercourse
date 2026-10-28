import { workSeconds } from '../src/sim/ideal';
import { describe, expect, it } from 'vitest';
import { fixBars } from '../src/slice/fixbars';
import { barMesh, type P } from '../src/slice/holds-world';
import type { Mesh } from '../src/slice/slice';
import { newPiece } from '../src/slice/world';

function box(w: number, h: number, d: number): Mesh {
  const [x0, x1, y0, y1, z0, z1] = [-w / 2, w / 2, 0, h, -d / 2, d / 2];
  const p = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
  const q = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
  return { positions: p, indices: q };
}
const bar = (x: number, y: number): P => ({ ...newPiece('Bar', barMesh(), { x, z: 0 }), src: 'hold:bar', y });
const deck = (x: number, w: number): P => ({ ...newPiece('Deck', box(w, 0.5, 1.8), { x, z: 0 }), src: 'x' });
const lane = { angle: 0, offset: 0, level: 0 };

describe('Fix it for bars', () => {
  it('moves bars that are too high to reach back into reach, and the result clears', () => {
    const ps: P[] = [deck(0, 8), deck(17, 8), bar(6.5, 4.4), bar(10, 4.4)];
    const r = fixBars(ps, lane, workSeconds(50));
    expect(r.ok).toBe(true);
    expect(r.steps.length).toBe(1);
    const lower = r.pieces.filter((p) => p.src === 'hold:bar' && p.y < 4.4);
    expect(lower.length).toBeGreaterThanOrEqual(1); // at least one bar is back in reach
  }, 60000);
  it('leaves a lane that already works alone', () => {
    const ps: P[] = [deck(0, 8), deck(17, 8), bar(6.5, 2.86), bar(10, 2.86)];
    const r = fixBars(ps, lane);
    expect(r.ok).toBe(true);
    expect(r.steps).toEqual([]);
  });
});
