import { describe, expect, it } from 'vitest';
import { findShortcuts } from '../src/sim/shortcuts';
import { courseFor } from '../src/slice/fixbars';
import { barMesh, type P } from '../src/slice/holds-world';
import { closeShortcut } from '../src/slice/shortcut-close';
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

describe('Close it for a shortcut', () => {
  it('pushes the far side on until the skip over bar 2 is gone and the planned line still clears', () => {
    const ps: P[] = [deck(0, 8), deck(14, 8), bar(6.5, 2.86), bar(10, 2.86)];
    const before = findShortcuts(courseFor(ps, lane)!, { onlyIds: ['skip-bar-2'], moveChoices: false });
    expect(before.shortcuts.map((s) => s.id)).toContain('skip-bar-2');
    const r = closeShortcut(ps, lane, { id: 'skip-bar-2', skipped: ['Bar 2'] });
    expect(r.ok).toBe(true);
    const moved = r.pieces.filter((p, i) => Math.abs(p.x - ps[i].x) > 1e-9);
    expect(moved.length).toBeGreaterThan(0);
    expect(moved.every((p) => p.x > 10)).toBe(true); // only what comes after bar 2 moved
    const after = findShortcuts(courseFor(r.pieces, lane)!, { onlyIds: ['skip-bar-2'], moveChoices: false });
    expect(after.shortcuts.map((s) => s.id)).not.toContain('skip-bar-2');
  }, 900_000);
  it('says so when the shortcut skips something that is not a bar', () => {
    const r = closeShortcut([deck(0, 8)], lane, { id: 'skip-wall', skipped: ['the wall'] });
    expect(r.ok).toBe(false);
    expect(r.steps[0]).toMatch(/other than a bar/);
  });
});
