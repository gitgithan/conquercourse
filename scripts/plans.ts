// Usage: npx tsx scripts/plans.ts [file.course.json ...]   (default: every demo course; also `npm run plans`)
// Finds the ideal run for the whole of each demo course and stores it in the file as `plan`, so Shift+I starts at once.
// Run it again whenever the simulator or the search changes: tests/demo-plans.test.ts fails on a stale plan.
import { readFileSync, writeFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import { DEMO_COURSE_FILES } from '../src/course/demo-list';
import { searchIdealRun } from '../src/sim/ideal';

const files = process.argv.length > 2 ? process.argv.slice(2) : [...DEMO_COURSE_FILES];
let bad = 0;
for (const f of files) {
  const t0 = Date.now();
  const course = JSON.parse(readFileSync(f, 'utf8')) as CourseData;
  delete course.plan;
  const r = searchIdealRun(course);
  if (r.cleared) { course.plan = r.plan; writeFileSync(f, JSON.stringify(course, null, 2) + '\n'); } else bad++;
  console.log(`${f}: ${r.cleared ? 'plan stored' : 'NOT CLEARED, no plan stored'} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
process.exit(bad ? 1 : 0);
