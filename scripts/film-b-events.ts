// Prints the moments of a course's ideal run that a film wants: every change of mode, every take-off and landing (game seconds, x, y).
// Usage: npx tsx scripts/film-b-events.ts public/assets/demo/lache.course.json
import { readFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import { playPlan } from '../src/sim/ideal';

const course = JSON.parse(readFileSync(process.argv[2], 'utf8')) as CourseData;
if (!course.plan) throw new Error('this course has no plan');
let tick = 0, lastMode = '', lastGround = true, last: { x: number; y: number } = { x: 0, y: 0 };
const fmt = (w: { runner: { x: number; y: number } }) => `t=${(tick / 120).toFixed(2)} x=${w.runner.x.toFixed(1)} y=${w.runner.y.toFixed(2)}`;
playPlan(course, course.plan, 120 * 90, (w) => {
  if (w.mode !== lastMode) console.log(`${fmt(w)} mode ${lastMode || '-'} -> ${w.mode}`);
  if (w.runner.grounded !== lastGround) console.log(`${fmt(w)} ${w.runner.grounded ? 'LAND' : 'TAKE-OFF'}`);
  lastMode = w.mode; lastGround = w.runner.grounded; last = w.runner; tick++;
});
console.log(`end t=${(tick / 120).toFixed(2)} x=${last.x.toFixed(1)} finishX=${course.finishX ?? '?'}`);
