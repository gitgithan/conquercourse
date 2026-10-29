// Usage: npx tsx scripts/training-windows.ts   (after scripts/training-line.ts)
// The stored plan's press windows on the Training course (CC-175): for each press in the plan, how far either side of the best x it still clears the course.
// The whole-course search stores these, but training-line.ts replaces its plan, so the windows are measured again here, one press at a time.
import { readFileSync, writeFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import { playPlan, type Plan, type Window } from '../src/sim/ideal';

const f = 'public/assets/demo/training.course.json';
const c = JSON.parse(readFileSync(f, 'utf8')) as CourseData;
const plan = c.plan!;
const speed = 7.4; // m/s, the same speed the search converts metres to milliseconds with
const out: Window[] = [];
const clears = (p: Plan) => playPlan(c, p, 120 * 70).world.outcome === 'cleared';
function scan(name: string, key: 'jumpXs' | 'vaultXs' | 'climbXs', i: number) {
  const best = plan[key]![i], good: number[] = [];
  for (let d = -3; d <= 3.001; d += 0.1) {
    const arr = [...plan[key]!]; arr[i] = Math.round((best + d) * 100) / 100;
    if (clears({ ...plan, [key]: arr })) good.push(arr[i]);
  }
  const lo = Math.min(...good), hi = Math.max(...good);
  out.push({ obstacle: name, best, lo, hi, widthMs: ((hi - lo + 0.02) / speed) * 1000 });
}
scan('edge at 24 m', 'jumpXs', 0);
scan('vault at step at 48 m', 'vaultXs', 0);
scan('vault at step at 70 m', 'vaultXs', 1);
scan('climb at step at 106 m', 'climbXs', 0);
scan('edge at 161 m (take-off)', 'jumpXs', 1);
scan('edge at 185 m', 'jumpXs', 2);
scan('edge at 227 m', 'jumpXs', 3);
c.windows = out;
writeFileSync(f, JSON.stringify(c, null, 2) + '\n');
console.log(JSON.stringify(out.map((w) => [w.obstacle, w.lo, w.best, w.hi, Math.round(w.widthMs)])));
