import { describe, expect, it } from 'vitest';
import { adviseLane, type Advice, type LaneSetting } from '../src/slice/advice';
import { laneToCourse, sliceProfile } from '../src/slice/slice';
import { meter, searchIdealRun, workSeconds } from '../src/sim/ideal';
import { newPiece, worldSamples, type Piece } from '../src/slice/world';
import { box } from './helpers/pieces';

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
    const w0 = meter.ticks;
    const advice = adviseLane(ps, lane);
    expect(meter.ticks - w0).toBeLessThan(workSeconds(6)); // a work guard, not a clock: the same on a slow machine
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
