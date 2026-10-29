import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { inputFor } from '../src/sim/ideal';
import { newWorld, stepWorld } from '../src/sim/world';
import { LEARNED, SAYING, bestLine, moveIconColours, bouncyFill, buildReport, logTick, newLog, topicOf } from '../src/ui/run-report';

// The end-of-run report (CC-97) states facts from the simulator: the run's time and effort, the moves it used, the best line next to it.
const lache = JSON.parse(readFileSync('public/assets/demo/lache.course.json', 'utf8')) as CourseData;
function play(c: CourseData) {
  let w = newWorld(c); const log = newLog();
  const st = { next: 0, caught: null, bedAt: null, hangAt: null, hangs: 0, vnext: 0, cnext: 0, inClimb: false, fnext: 0, airSince: null } as unknown as Parameters<typeof inputFor>[2];
  for (let i = 0; i < 120 * 90 && w.outcome === 'running'; i++) { w = stepWorld(w, inputFor(c.plan!, w, st, c), c); logTick(log, w); }
  return { w, log };
}
describe('the run report', () => {
  const { w, log } = play(lache), best = bestLine(lache);
  it('the stored plan played again is the best line, and a run that follows it matches it', () => {
    expect(best).not.toBeNull();
    const r = buildReport(lache, log, w, true, best);
    expect(r.cleared).toBe(true);
    expect(r.best!.seconds).toBeCloseTo(r.seconds, 5);
    expect(r.headline).toMatch(/^You made it in \d+\.\d s\.$/);
  });
  it('counts the moves the simulator reported', () => {
    const kinds = buildReport(lache, log, w, true, best).counts.map((c) => c.kind);
    expect(kinds).toContain('vault'); expect(kinds).toContain('jump'); expect(kinds).toContain('grab');
  });
  it('says the biggest saving from the stored shortcuts, as a fact, when the run was slower than the best line', () => {
    const r = buildReport(lache, log, w, true, { ...best!, seconds: best!.seconds - 3 });
    expect(r.saving).toMatch(/saves \d+\.\d s/);
    expect(r.saving).toMatch(/bar 2/i);
  });
  it('a run as fast as the best line says so and has nothing to change', () => {
    const r = buildReport(lache, log, w, true, best);
    expect(r.matched).toBe(true); expect(r.saving).toBeNull();
  });
  it('a run that started partway has no comparison and no saving', () => {
    const r = buildReport(lache, log, w, false, best);
    expect(r.best).toBeNull(); expect(r.saving).toBeNull();
  });
  it('never grades: no scores or praise words', () => {
    const r = buildReport(lache, log, w, true, best);
    expect(JSON.stringify([r.headline, r.saving, r.learned, r.saying])).not.toMatch(/score|grade|great|perfect|bad|good job|\/100/i);
  });
  it('a failed run states how far it got, never a comparison', () => {
    const lost = { ...w, outcome: 'splash' as const };
    const r = buildReport(lache, log, lost, true, best);
    expect(r.cleared).toBe(false); expect(r.headline).toBe('You fell in the water.'); expect(r.best).toBeNull(); expect(r.learned).toBeNull(); expect(r.saying).toBeNull();
  });
  it('every learned line has a topic and the lache course teaches the lache', () => {
    expect(topicOf(lache)).toBe('lache');
    for (const k of Object.keys(SAYING)) expect(LEARNED[k]).toBeTruthy();
  });
});

// CC-192: a first run with no falls shows no gold; the move icons in the path picture were gold circles on every move.
describe('no gold on a run with no falls (CC-192)', () => {
  const hue = (hex: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255); const d = Math.max(r, g, b) - Math.min(r, g, b); if (d < 0.1) return null; const m = Math.max(r, g, b); const h = (m === r ? ((g - b) / d) % 6 : m === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60; return h < 0 ? h + 360 : h; };
  const isGold = (hex: string) => { const h = hue(hex); return h !== null && h >= 32 && h <= 55; };
  it('the move icons are not gold', () => { const c = moveIconColours(false); expect([c.fill, c.ring, c.ink].filter(isGold)).toEqual([]); });
  it('the trampoline bed in the path picture is not gold (CC-215)', () => { expect(isGold(bouncyFill(false))).toBe(false); expect(isGold(bouncyFill(true))).toBe(true); });
  it('?gold=old keeps the old gold icons', () => { const c = moveIconColours(true); expect(isGold(c.ring)).toBe(true); });
});
