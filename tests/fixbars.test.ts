import { workSeconds } from '../src/sim/ideal';
import { describe, expect, it } from 'vitest';
import { fixBars } from '../src/slice/fixbars';
import { barMesh, type P } from '../src/slice/holds-world';
import { newPiece } from '../src/slice/world';
import { deck, lane } from './helpers/pieces';

const bar = (x: number, y: number): P => ({ ...newPiece('Bar', barMesh(), { x, z: 0 }), src: 'hold:bar', y });

describe('Fix it for bars', () => {
  it('moves bars that are too high to reach back into reach, and the result clears', () => {
    const ps: P[] = [deck(0, 8), deck(17, 8), bar(6.5, 4.4), bar(10, 4.4)];
    const r = fixBars(ps, lane, workSeconds(50));
    expect(r.ok).toBe(true);
    expect(r.steps.length).toBe(1);
    const lower = r.pieces.filter((p) => p.src === 'hold:bar' && p.y < 4.4);
    expect(lower.length).toBeGreaterThanOrEqual(1); // at least one bar is back in reach
  }, 180000); // 38 s and 27 s alone: it needs room when other tests share the machine
  it('leaves a lane that already works alone', () => {
    const ps: P[] = [deck(0, 8), deck(17, 8), bar(6.5, 2.86), bar(10, 2.86)];
    const r = fixBars(ps, lane);
    expect(r.ok).toBe(true);
    expect(r.steps).toEqual([]);
  }, 180000);
});
