import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { DEMO_COURSE_FILES } from '../src/course/demo-list';
import { playPlan } from '../src/sim/ideal';

// Shift+I plays the plan stored in each demo course. A plan goes stale when the simulator or the search changes:
// this test then fails, and `npm run plans` makes new ones.
describe('the stored whole-course plans of the demo courses', () => {
  for (const f of DEMO_COURSE_FILES) {
    it(`${f.split('/').pop()} carries a plan that still clears it`, () => {
      const course = JSON.parse(readFileSync(f, 'utf8')) as CourseData;
      expect(course.plan, 'no plan stored: run npm run plans').toBeDefined();
      expect(playPlan(course, course.plan!, 120 * 120).world.outcome, 'stale plan: run npm run plans').toBe('cleared');
    });
  }
});
