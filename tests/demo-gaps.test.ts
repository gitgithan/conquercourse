import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { groundAt } from '../src/sim/terrain';

// A 1 mm gap between two decks looks like a join but is a hole: groundAt is -Infinity there, so a runner who lands or stands in it falls into the water (the Climb and Drop demos had one at the wall).
const dir = 'public/assets/demo';
const courses = readdirSync(dir).filter((f) => f.endsWith('.course.json')).map((f) => ({ f, c: JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as CourseData }));

describe('demo courses have no sliver holes between decks', () => {
  for (const { f, c } of courses) {
    it(f, () => {
      const p = [...c.terrain.platforms].sort((a, b) => a.x0 - b.x0);
      for (let i = 1; i < p.length; i++) {
        const gap = p[i].x0 - Math.max(...p.slice(0, i).map((q) => q.x1));
        expect(gap <= 0 || gap >= 0.05, `${f}: a ${(gap * 1000).toFixed(1)} mm gap before x=${p[i].x0}: touch the decks or leave a real gap`).toBe(true);
      }
    });
  }
  it('the Climb wall is solid from the lower deck to the top of the wall', () => {
    const c = courses.find((x) => x.f === 'climb.course.json')!.c;
    for (let x = 23.9; x <= 24.1; x += 0.0005) expect(Number.isFinite(groundAt(c.terrain, x))).toBe(true);
  });
});
