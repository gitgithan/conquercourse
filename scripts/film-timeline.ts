// Where the ideal run is at each second, so a film shot can be placed on the moment it is about (CC-143).
// Usage: npx tsx scripts/film-timeline.ts public/assets/demo/lache.course.json
import { readFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import { playPlan } from '../src/sim/ideal';

const course = JSON.parse(readFileSync(process.argv[2], 'utf8')) as CourseData;
if (!course.plan) throw new Error('this course has no plan');
let tick = 0, lastMode = '';
playPlan(course, course.plan, 120 * 80, (w) => {
  if (tick % 15 === 0 || w.mode !== lastMode) console.log(`t=${(tick / 120).toFixed(2)} s  x=${w.runner.x.toFixed(1)} y=${w.runner.y.toFixed(2)} mode=${w.mode}`);
  lastMode = w.mode; tick++;
});
