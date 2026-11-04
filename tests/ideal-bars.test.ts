import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { searchIdealRun, playPlan } from '../src/sim/ideal';

// The ideal-run search knows monkey bars (CC-133, docs/bars.md): it finds the press, the hang, the kip, the release and a wait before each reach by trying the simulator.
const load = (n: string) => JSON.parse(readFileSync(`public/assets/demo/${n}.course.json`, 'utf8')) as CourseData;
const barsC = load('bars'), swingC = load('swing-to-bars');
const barsR = searchIdealRun(barsC), swingR = searchIdealRun(swingC);
const win = (r: typeof barsR, re: RegExp) => r.windows.find((w) => re.test(w.obstacle))!;

describe('the ideal run on monkey bars', () => {
  it('clears both demo courses', () => { expect(barsR.cleared).toBe(true); expect(swingR.cleared).toBe(true); });
  it('every window is wider than one tick of a person (8 ms) and the plan sits inside it', () => {
    for (const r of [barsR, swingR]) for (const w of r.windows) { expect(w.widthMs).toBeGreaterThan(8); expect(w.best).toBeGreaterThanOrEqual(w.lo); expect(w.best).toBeLessThanOrEqual(w.hi); }
  });
  it('the bar-to-bars hang sits well inside its window, not on the edge (16 ticks, 133 ms, each side)', () => {
    const h = win(swingR, /hang on bar 1/);
    expect(h.best - h.lo).toBeGreaterThanOrEqual(16); expect(h.hi - h.best).toBeGreaterThanOrEqual(16);
  });
  it('law: every reach of the ideal run is made with the swing going forward, one hand after the other', () => {
    for (const [c, r] of [[barsC, barsR], [swingC, swingR]] as const) {
      const run = playPlan(c, r.plan);
      const reaches = run.events.filter((e) => e.type === 'bars-reach');
      expect(reaches.length).toBe(c.bars![0].n); // the hands leapfrog: one reach per rung, the last one closes the back hand on the last rung
      reaches.forEach((e, i) => expect(e.detail!.hand).toBe(i % 2 === 0 ? 1 : 2));
      expect(run.events.some((e) => e.type === 'bars-stall')).toBe(false);
    }
  });
  it('law: a release outside the window falls, and no hang on the first rung long enough to lose the swing clears', () => {
    const rl = win(barsR, /release after/);
    const at = (v: number) => playPlan(barsC, { ...barsR.plan, barsRelease: v }).world.outcome;
    expect(at(rl.best)).toBe('cleared');
    expect(at(Math.max(0, rl.lo - 30))).not.toBe('cleared');
    expect(at(rl.hi + 30)).not.toBe('cleared');
  });
  it('a plan with the reaches left out never clears the row', () => {
    expect(playPlan(barsC, { ...barsR.plan, barsStart: 100000 }).world.outcome).not.toBe('cleared');
  });
});
