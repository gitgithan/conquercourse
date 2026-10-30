// Picks each launcher's start time so the ideal run slips between two balls with the most room to spare (CC-240).
// The balls are a formula of the tick, so the same run always meets the same balls: going faster or slower than the ideal meets one.
// Usage: npx tsx scripts/place-shots.ts   (reads the plan in src/course/default-course.ideal.json, prints the phases and the room)
import { readFileSync, writeFileSync } from 'node:fs';
import course from '../src/course/default-course.json';
import ideal from '../src/course/default-course.ideal.json';
import type { CourseData } from '../src/course/course';
import { playPlan } from '../src/sim/ideal';
import { ballAt, BODY_HIGH, BODY_LOW, BODY_R } from '../src/sim/shots';

const base = { ...(course as unknown as CourseData), shots: undefined } as CourseData;
const path: { tick: number; x: number; y: number }[] = [];
const r = playPlan(base, ideal.plan as never, 120 * 80, (w) => path.push({ tick: w.runner.tick, x: w.runner.x, y: w.runner.y }));
console.log('plan clears the course without balls:', r.world.outcome, 'in', (r.world.runner.tick / 120).toFixed(1), 's');

const room = (s: NonNullable<CourseData['shots']>[number], phase: number): number => {
  let best = Infinity;
  const t = { ...s, phase };
  for (const p of path) {
    for (let k = 0; k < 40; k++) {
      const b = ballAt(t, k, p.tick);
      if (!b) continue;
      const cy = Math.min(p.y + BODY_HIGH, Math.max(p.y + BODY_LOW, b.y));
      best = Math.min(best, Math.hypot(b.x - p.x, b.y - cy) - (s.r ?? 0.25) - BODY_R);
    }
  }
  return best;
};
const shots = (course as unknown as CourseData).shots!.map((s) => {
  let bestPhase = 0, bestRoom = -Infinity;
  for (let ph = 0; ph < s.every; ph += 0.05) { const m = room(s, ph); if (m > bestRoom) { bestRoom = m; bestPhase = ph; } }
  console.log(`launcher at ${s.x}: phase ${bestPhase.toFixed(2)} s, room ${bestRoom.toFixed(2)} m`);
  return { ...s, phase: Math.round(bestPhase * 100) / 100 };
});
if (process.argv.includes('--write')) {
  const c = JSON.parse(readFileSync('src/course/default-course.json', 'utf8'));
  c.shots = shots;
  writeFileSync('src/course/default-course.json', JSON.stringify(c, null, 2) + '\n');
}
