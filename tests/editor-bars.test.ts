import { describe, expect, it } from 'vitest';
import { BAR_TO_BARS_AHEAD, barsAfterBar, barsOf, barsPiece, barsSpecOf, barsSrc, DEFAULT_BARS_SPEC, fitBarsTo, isBarsPiece, setBars } from '../src/slice/bars-world';
import { barMesh, holdsOf, type P } from '../src/slice/holds-world';
import { copySourceFrom, piecesFromSource } from '../src/slice/roundtrip';
import { roleCourse } from '../src/slice/roles';
import { newPiece, realSize, worldSamples } from '../src/slice/world';
import { fieldsOk } from '../src/course/schema';
import { DEFAULT_HANG } from '../src/sim/holds';
import { rungX, tryGrabBars } from '../src/sim/bars';
import { box, deck, lane } from './helpers/pieces';

// two decks 12 m apart with a row of monkey bars overhead across the gap
const world = (): P[] => [deck(0, 8), deck(20, 8), barsPiece({ n: 8, gap: 0.6 }, { x: 10, z: 0 }, 2.9)];

describe('monkey bars piece in the editor (CC-133)', () => {
  it('keeps its knobs in the src, so saving and copying keep them, and clamps what is out of range', () => {
    const spec = { n: 12, gap: 0.75 };
    expect(barsSpecOf(barsSrc(spec))).toEqual(spec);
    expect(barsSpecOf('bars:99:5')).toEqual({ n: 40, gap: 1 });
    expect(barsSpecOf('bars:1:0.1')).toEqual({ n: 2, gap: 0.3 });
    expect(barsSpecOf('plank:wood:6:0.04:0.6:0')).toBeUndefined();
    expect(barsSpecOf('hold:bar')).toBeUndefined();
  });
  it('is not ground, and a row turned across the lane is ignored', () => {
    const p = world()[2];
    expect(worldSamples([p]).length).toBe(0);
    expect(barsOf([p], lane).length).toBe(1);
    expect(barsOf([{ ...p, yaw: Math.PI / 2 }], lane)).toEqual([]);
  });
  it('the first rung is half a row before the piece, at the rung height', () => {
    const [b] = barsOf([world()[2]], lane);
    expect(b.u0).toBeCloseTo(10 - (7 * 0.6) / 2, 6);
    expect(b.y).toBeCloseTo(2.9 + 0.03, 6);
    expect(b.n).toBe(8);
  });
  it('becomes course.bars across the real gap, passes the course schema, and leaves the ground alone', () => {
    const withBars = roleCourse(world(), lane).course, without = roleCourse(world().slice(0, 2), lane).course;
    expect(withBars.bars?.length).toBe(1);
    expect(fieldsOk(withBars as unknown as Record<string, unknown>)).toBe(true);
    const [a, b] = withBars.terrain.platforms.slice(1);
    const run = withBars.bars![0];
    expect(run.x).toBeGreaterThan(a.x1 - 6);
    expect(run.x + (run.n - 1) * run.gap).toBeLessThan(b.x0 + 6);
    expect(run.n).toBe(8);
    expect(run.gap).toBeCloseTo(0.6, 2);
    expect(without.bars).toBeUndefined();
    expect(withBars.terrain.platforms.length).toBe(without.terrain.platforms.length);
  });
  it('the simulator can take the first rung of the course the editor made', () => {
    const c = roleCourse(world(), lane).course, run = c.bars![0];
    const g = tryGrabBars(c.bars!, run.x, run.y - DEFAULT_HANG.handHeight, 0, 0, false, undefined, c.grabReach);
    expect(g).not.toBeNull();
    expect(rungX(run, g!.l)).toBeCloseTo(run.x, 1);
  });
  it('is restored from a saved world and from a course copy', () => {
    const p = world()[2];
    const [q] = piecesFromSource([{ src: p.src!, x: p.x, z: p.z, y: p.y, yaw: p.yaw, scale: p.scale }]);
    expect(isBarsPiece(q)).toBe(true);
    expect(q.noGround).toBe(true);
    expect(q.y).toBe(p.y);
    const c = roleCourse(world(), lane).course;
    const copy = copySourceFrom(c).pieces.filter((x) => x.src.startsWith('bars:'));
    expect(copy.length).toBe(1);
    const again = roleCourse([deck(0, 8), deck(20, 8), ...piecesFromSource(copy)], lane).course.bars![0];
    expect(again.n).toBe(c.bars![0].n);
    expect(again.y).toBeCloseTo(c.bars![0].y, 1);
  });
  it('setBars changes the rungs and the spacing, and the rows follow', () => {
    const p = barsPiece(DEFAULT_BARS_SPEC, { x: 10, z: 0 }, 2.9);
    setBars(p, { n: 4, gap: 1 });
    expect(p.src).toBe('bars:4:1');
    expect(barsOf([p], lane)[0].gap).toBe(1);
    expect(realSize(p).w).toBeCloseTo(3.04, 2);
  });
});

describe('Fit to selected: the row lies along the top of an object', () => {
  it('takes its top height, its longer side and its place', () => {
    const o: P = { ...newPiece('Frame', box(6, 2.4, 1), { x: 5, z: 1 }), src: 'obj:frame.glb', y: 0.5 };
    const f = fitBarsTo(o);
    expect(f.y).toBeCloseTo(2.9, 6);
    expect(f.x).toBe(5);
    expect(f.z).toBe(1);
    expect(f.yaw).toBe(0);
    expect((f.spec.n - 1) * f.spec.gap).toBeGreaterThan(5.4);
    expect((f.spec.n - 1) * f.spec.gap).toBeLessThan(6.6);
  });
  it('follows an object lying the other way: the row turns with its long side', () => {
    const o: P = { ...newPiece('Frame', box(1, 2.4, 6), { x: 0, z: 0 }), src: 'obj:frame.glb' };
    expect(fitBarsTo(o).yaw).toBeCloseTo(Math.PI / 2, 9);
  });
  it('a very short or very long object still gives a row inside the limits', () => {
    for (const w of [0.2, 3, 60]) {
      const f = fitBarsTo({ ...newPiece('x', box(w, 2.5, 1)), src: 'x' });
      expect(f.spec.n).toBeGreaterThanOrEqual(2); expect(f.spec.n).toBeLessThanOrEqual(40);
      expect(f.spec.gap).toBeGreaterThanOrEqual(0.3); expect(f.spec.gap).toBeLessThanOrEqual(1);
    }
  });
});

describe('pull-up bar to monkey bars', () => {
  const bar = (): P => ({ ...newPiece('Bar', barMesh(), { x: 6, z: 0 }), src: 'hold:bar', y: 2.56 });
  it('the first rung is 2.4 m past the bar and as high as the bar', () => {
    const b = bar(), q = barsAfterBar(b);
    const [row] = barsOf([q], lane), [h] = holdsOf([b], lane);
    expect(row.u0).toBeCloseTo(6 + BAR_TO_BARS_AHEAD, 6);
    expect(row.y).toBeCloseTo(h.y, 6);
    expect(row.n).toBe(DEFAULT_BARS_SPEC.n);
  });
});

describe('turning a piece in 15 degree steps', () => {
  it('a swing bar is still found at every step, and a bars row only while it lies along the lane', () => {
    const b: P = { ...newPiece('Bar', barMesh(), { x: 6, z: 0 }), src: 'hold:bar', y: 2.56 };
    const q = barsPiece(DEFAULT_BARS_SPEC, { x: 12, z: 0 }, 2.56);
    const along: number[] = [];
    for (let k = 0; k < 24; k++) {
      b.yaw = (k * Math.PI) / 12; q.yaw = b.yaw;
      expect(holdsOf([b], lane).length).toBe(1);
      along.push(barsOf([q], lane).length);
    }
    expect(along.slice(0, 3)).toEqual([1, 1, 1]); // 0, 15, 30 degrees
    expect(along[6]).toBe(0); // 90 degrees: across the lane
    expect(along[12]).toBe(1); // 180 degrees: the same row, the other way round
  });
  it('turning a bars row the other way round keeps the same rungs in place', () => {
    const q = barsPiece({ n: 6, gap: 0.6 }, { x: 12, z: 0 }, 2.9);
    const a = barsOf([q], lane)[0];
    q.yaw = Math.PI;
    const b = barsOf([q], lane)[0];
    expect(b.u0).toBeCloseTo(a.u0, 9);
  });
});
