import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { makeItEasier, narrowest } from '../src/slice/easier';
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
    const ps = mk(['box:8:0.5:2', 0, 0], ['box:6:3:2', 12, 0]); // a step of 2.5 m: nobody jumps that
    const r = await makeItEasier(ps, lane, 10, { courseOf, xOf: (p) => p.x });
    expect(r.proposal).toBeNull();
    expect(r.note).toMatch(/cannot clear/);
  }, 120000);
  it('a 5 m gap: the offered change moves a deck closer, widens the narrowest press and the lane still clears', async () => {
    const ps = mk(['box:8:0.5:2', 0, 0], ['box:8:0.5:2', 13, 0]);
    const r = await makeItEasier(ps, lane, 6, { courseOf, xOf: (p) => p.x });
    expect(r.proposal).not.toBeNull();
    expect(r.after).toBeGreaterThanOrEqual(r.before * 1.15);
    expect(r.proposal!.source).toBe('easier');
    expect(r.proposal!.known).toBe(true);
    expect(r.proposal!.items).toHaveLength(1);
    expect(r.proposal!.items[0].words).toMatch(/^Move “Block 1” 1 m further along\.$/);
    expect(r.proposal!.steps[0]).toMatch(/narrowest press window grows from 314 ms to 405 ms/);
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
