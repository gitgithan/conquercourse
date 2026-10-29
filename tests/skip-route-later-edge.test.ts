import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { searchIdealRun } from '../src/sim/ideal';

// CC-164: the search compared the two routes through a pair of bars by changing the LAST press of the plan.
// With another gap after the pair (as on Training, where a block follows it) that was the wrong press, and the skip was never found.
const lache = JSON.parse(readFileSync('public/assets/demo/lache.course.json', 'utf8')) as CourseData;
const withGapAfter = (): CourseData => {
  const c: CourseData = JSON.parse(JSON.stringify(lache));
  delete c.plan; delete c.routes; delete c.windows; delete c.shortcuts;
  c.terrain.platforms[3].x1 = 62; // the far deck ends, a gap, a last deck
  c.terrain.platforms.push({ x0: 65, x1: 90, top: -2 });
  c.finishX = 82;
  return c;
};

// CC-164 (second cause): the bar trials were cut at 25 s from the start of the run, so a pair of bars far down a long course was never reached.
const farAway = (): CourseData => {
  const c: CourseData = JSON.parse(JSON.stringify(lache));
  delete c.plan; delete c.routes; delete c.windows; delete c.shortcuts;
  const dx = 200;
  c.terrain.platforms.forEach((p) => { p.x0 += dx; p.x1 += dx; });
  c.terrain.platforms[0].x0 = -10;
  c.holds = c.holds!.map((h) => ({ ...h, x: h.x + dx }));
  c.finishX += dx; delete c.zones; delete c.checkpoints;
  return c;
};

describe('the route choice through a pair of bars when another jump comes after it', () => {
  it('finds the skip and follows it when it is faster', () => {
    const c = withGapAfter();
    const r = searchIdealRun(c, { routes: true });
    expect(r.cleared).toBe(true);
    const bars = r.routes!.find((q) => q.name === 'bar to bar')!, skip = r.routes!.find((q) => q.name === 'skip the second bar');
    expect(skip).toBeDefined();
    expect(r.routes!.filter((q) => q.chosen)).toHaveLength(1);
    expect(r.routes!.find((q) => q.chosen)!.ticks).toBe(Math.min(bars.ticks, skip!.ticks));
    expect(skip!.ticks).toBeLessThan(bars.ticks);
  }, 300000);
  it('finds both routes when the bars are 28 s down the course', () => {
    const r = searchIdealRun(farAway(), { routes: true });
    expect(r.cleared).toBe(true);
    expect(r.routes!.map((q) => q.name)).toEqual(['bar to bar', 'skip the second bar']);
  }, 600000);
});
