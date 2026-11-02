import { describe, expect, it } from 'vitest';
import { clears, fixLayout } from '../src/slice/fixit';
import { newPiece, scaleBy, type Piece } from '../src/slice/world';
import { box } from './helpers/pieces';

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
