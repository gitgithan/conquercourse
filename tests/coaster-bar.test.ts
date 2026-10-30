import { describe, expect, it } from 'vitest';
import { coasterCourse } from '../src/slice/coaster';
import { playPlan, searchIdealRun } from '../src/sim/ideal';

// CC-244: a coaster that ends in a flight, and bars on the way: the rider leaves the rails and the ordinary holds take over.
const withBar = (gapEnd: number, bars: number[], y: number) => {
  const c = coasterCourse('coaster-bar', [[[0, 9], [7, 5], [14, 1], [22, 0.6]], [[gapEnd, 0.6], [gapEnd + 10, 0.2]]]);
  return { ...c, holds: bars.map((x) => ({ x, y })) };
};

describe('a coaster flight with bars', () => {
  for (const [gapEnd, bars] of [[30, [25, 28]], [34, [26, 30]], [40, [28, 33]]] as [number, number[]][]) {
    for (const y of [1.5, 2.5, 3.5, 5]) {
      it(`probe: gap to ${gapEnd}, bars ${bars} at ${y} m`, () => {
        const c = withBar(gapEnd, bars, y), r = searchIdealRun(c);
        const t = playPlan(c, r.plan);
        console.log('PROBE', gapEnd, bars.join('/'), y, r.cleared, t.world.outcome, [...new Set(t.events.map((e) => e.type))].join(','));
        expect(typeof r.cleared).toBe('boolean');
      });
    }
  }
});
