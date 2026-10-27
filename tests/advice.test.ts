import { describe, expect, it } from 'vitest';
import { adviseLane, type Advice, type LaneSetting } from '../src/slice/advice';
import { laneToCourse, sliceProfile, type Mesh } from '../src/slice/slice';
import { searchIdealRun } from '../src/sim/ideal';
import { newPiece, worldSamples, type Piece } from '../src/slice/world';

function box(w: number, h: number, d: number): Mesh {
  const [x0, x1, y0, y1, z0, z1] = [-w / 2, w / 2, 0, h, -d / 2, d / 2];
  const p = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
  const q = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
  return { positions: p, indices: q };
}
const lane: LaneSetting = { angle: 0, offset: 0, level: 0 };
const clears = (ps: Piece[], l: LaneSetting) => { const pr = sliceProfile(worldSamples(ps), { x: 0, z: 0 }, l); return pr.length >= 8 && searchIdealRun(laneToCourse({ cells: [...pr.cells], length: pr.length })).cleared; };
const apply = (ps: Piece[], l: LaneSetting, a: Advice): { ps: Piece[]; lane: LaneSetting } => ({
  ps: ps.map((p) => (p.id === a.piece ? { ...p, x: p.x + (a.change.dx ?? 0), z: p.z + (a.change.dz ?? 0), y: p.y + (a.change.dy ?? 0), scale: a.change.scale ?? p.scale } : p)),
  lane: { angle: a.change.angle ?? l.angle, offset: a.change.offset ?? l.offset, level: a.change.level ?? l.level },
});

describe('lane advice', () => {
  // a low box, then a wall 1.6 m high right after it: no jump from a run climbs that
  const bad = () => [{ ...newPiece('Low box', box(4, 0.5, 1.5), { x: 3, z: 0 }) }, { ...newPiece('Tall wall', box(4, 1.6, 1.5), { x: 8, z: 0 }) }];
  it('says what to shift when a step is too tall, and the shift really clears', () => {
    const ps = bad();
    expect(clears(ps, lane)).toBe(false);
    const t0 = performance.now();
    const advice = adviseLane(ps, lane);
    expect(performance.now() - t0).toBeLessThan(4000);
    expect(advice.length).toBeGreaterThan(0);
    expect(advice.length).toBeLessThanOrEqual(3);
    for (const a of advice) { expect(a.verified).toBe(true); expect(a.text.length).toBeGreaterThan(10); const n = apply(ps, lane, a); expect(clears(n.ps, n.lane)).toBe(true); }
  });
  it('returns nothing when the lane already clears', () => {
    const ps = [{ ...newPiece('Low box', box(4, 0.5, 1.5), { x: 3, z: 0 }) }, { ...newPiece('Step', box(4, 0.9, 1.5), { x: 9, z: 0 }) }];
    expect(clears(ps, lane)).toBe(true);
    expect(adviseLane(ps, lane)).toEqual([]);
  });
});
