import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { bestLine, buildReport, newLog } from '../src/ui/run-report';
import { newWorld } from '../src/sim/world';

// A coaster's best line is its stored brake plan, played once more (CC-116): the report can set a ride next to it.
describe('the coaster best line', () => {
  for (const f of ['coaster-two-hills', 'coaster', 'coaster-sharp']) {
    it(`${f}: the stored brake plan gives a best line that clears`, () => {
      const c = JSON.parse(readFileSync(`public/assets/demo/${f}.course.json`, 'utf8')) as CourseData;
      const b = bestLine(c);
      expect(b).not.toBeNull();
      expect(b!.seconds).toBeGreaterThan(5);
      expect(b!.spent).toBeLessThan(0.005); // a cart spends no body energy
    });
  }
  it('a ride that is a second slower than the best line is not called a match', () => {
    const c = JSON.parse(readFileSync('public/assets/demo/coaster-two-hills.course.json', 'utf8')) as CourseData;
    const b = bestLine(c)!;
    const w = { ...newWorld(c), outcome: 'cleared' as const }; w.runner = { ...w.runner, tick: Math.round((b.seconds + 1) * 120) };
    expect(buildReport(c, newLog(), w, true, b).matched).toBe(false);
    w.runner = { ...w.runner, tick: Math.round(b.seconds * 120) };
    expect(buildReport(c, newLog(), w, true, b).matched).toBe(true);
  });
});
