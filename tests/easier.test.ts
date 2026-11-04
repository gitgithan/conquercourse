import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { makeItEasier, narrowest, limitingTarget } from '../src/slice/easier';
import { holdsOf, isHold } from '../src/slice/holds-world';
import { laneToCourse, sliceProfile } from '../src/slice/slice';
import { piecesFromSource } from '../src/slice/roundtrip';
import { worldSamples } from '../src/slice/world';

type Lane = { angle: number; offset: number; level: number };
const lane: Lane = { angle: 0, offset: 0, level: 0 };
const courseOf = (ps: ReturnType<typeof piecesFromSource>, ln: Lane): CourseData => {
  const pr = sliceProfile(worldSamples(ps.filter((p) => !isHold(p))), { x: 0, z: 0 }, ln);
  return laneToCourse({ cells: [...pr.cells], length: pr.length, origin: pr.origin }, 'easier', holdsOf(ps, ln));
};
const mk = (...list: [string, number, number][]) => piecesFromSource(list.map(([src, x, y]) => ({ src, x, z: 0, y, yaw: 0, scale: 1 })));

describe('Make it easier', () => {
  it('measures the narrowest press as the smallest window, ignoring markers of zero width', () => {
    expect(narrowest([{ obstacle: 'a', best: 1, lo: 1, hi: 1, widthMs: 0 }, { obstacle: 'b', best: 2, lo: 1, hi: 3, widthMs: 120 }, { obstacle: 'c', best: 3, lo: 1, hi: 5, widthMs: 340 }])).toBe(120);
    expect(narrowest([])).toBe(0);
  });
  it('says so when the lane cannot be cleared at all (use Fix it first)', async () => {
    const ps = mk(["box:8:0.5:2", 0, 0], ["box:6:4:2", 12, 0]); // a step of 3.5 m: no jump, vault or climb (up to 2.83 m, CC-76) gets over that
    const r = await makeItEasier(ps, lane, 10, { courseOf, xOf: (p) => p.x });
    expect(r.proposal).toBeNull();
    expect(r.note).toMatch(/cannot clear/);
  }, 120000);
  it('a 5 m gap: the offered change moves a deck closer, widens the narrowest press and the lane still clears', async () => {
    const ps = mk(['box:8:0.5:2', 0, 0], ['box:8:0.5:2', 13, 0]);
    const r = await makeItEasier(ps, lane, 6, { courseOf, xOf: (p) => p.x });
    expect(r.proposal).not.toBeNull();
    expect(r.after).toBeGreaterThanOrEqual(r.before * 1.15);
    expect(r.proof?.cleared).toBe(true);
    expect(r.proof?.plan).toBeDefined();
    expect(r.course).toBeDefined();
    expect(r.proposal!.source).toBe('easier');
    expect(r.proposal!.known).toBe(true);
    expect(r.proposal!.items).toHaveLength(1);
    expect(r.proposal!.items[0].words).toMatch(/^Move “Block 1” 1 m further along\.$/);
    expect(r.proposal!.steps[0]).toMatch(/Before: Jump take-off at .* — 314 ms/);
    expect(r.proposal!.steps[1]).toMatch(/After: Jump take-off at .* — 405 ms/);
    expect(r.proposal!.steps[2]).toContain('91 ms more room');
    const it = r.proposal!.items[0];
    expect(it.kind === 'piece' && it.to.x - it.from.x).toBeCloseTo(1, 5);
  }, 120000);
  it('a layout that is already comfortable gets an honest "nothing small helps"', async () => {
    const ps = mk(['box:8:0.5:2', 0, 0], ['box:8:0.5:2', 12, 0]);
    const r = await makeItEasier(ps, lane, 6, { courseOf, xOf: (p) => p.x });
    expect(r.proposal).toBeNull();
    expect(r.note).toMatch(/No small change widens/);
  }, 120000);
  it('the start deck jump is not counted: it is not the player\'s layout', () => {
    const w = [{ obstacle: 'edge at 6 m', best: 6, lo: 5, hi: 6, widthMs: 262 }, { obstacle: 'edge at 17 m', best: 17, lo: 1, hi: 2, widthMs: 314 }];
    expect(narrowest(w)).toBe(262);
    expect(narrowest(w, 6)).toBe(314);
  });
});

it('targets the limiting obstacle and resolves bar coordinates', () => {
  const course = courseOf(mk(['box:8:0.5:2', 0, 0]), lane);
  const windows = [{ obstacle: 'edge at 6 m', widthMs: 80, best: 0, lo: 0, hi: 1 }, { obstacle: 'jump at edge at 17 m', widthMs: 120, best: 0, lo: 0, hi: 1 }];
  expect(limitingTarget(course, windows, 6, 0)).toEqual({ x: 17, label: 'jump at edge at 17 m' });
  expect(limitingTarget({ ...course, holds: [{ x: 23, y: 3 }] }, [{ ...windows[1], obstacle: 'hang on bar 1' }], 6, 0).x).toBe(23);
});
it('keeps cost order when a later candidate finishes first and retains the winning proof', async () => {
  const ps = mk(['box:8:0.5:2', 0, 0], ['box:8:0.5:2', 13, 0]);
  const window = (n: number) => [{ obstacle: 'edge at 6 m', best: 5, lo: 4, hi: 6, widthMs: n }, { obstacle: 'edge at 17 m', best: 16, lo: 15, hi: 17, widthMs: n }];
  const plan = { jumpXs: [16], releaseAfter: 0, bouncePress: 0 };
  let calls = 0;
  const proofs = [0, 1, 2].map((i) => ({ cleared: true, plan: { ...plan, bouncePress: i }, windows: window(i ? 140 : 100) }));
  const done: number[] = [];
  const r = await makeItEasier(ps, lane, 6, { courseOf, xOf: (p) => p.x, search: async () => {
    const i = calls++; await new Promise((r) => setTimeout(r, i === 1 ? 25 : 0)); done.push(i); return proofs[i];
  } }, 10000, undefined, { concurrency: 2 });
  expect(done).toEqual([0, 2, 1]);
  expect(r.proof).toBe(proofs[1]); expect(r.tried).toBe(2);
  expect(r.proposal!.steps[0]).toContain('at 17 m');
  expect(r.proposal!.steps[1]).toContain('at 17 m');
});
