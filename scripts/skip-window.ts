// Usage: npx tsx scripts/skip-window.ts <file.course.json> <deck x0 ...>   For each far-deck position: how many hang times (ticks) on the first bar make the skip clear (the width of the skip's window).
import { readFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import { playPlan, searchIdealRun, type Plan } from '../src/sim/ideal';

const [file, ...xs] = process.argv.slice(2);
const base = JSON.parse(readFileSync(file, 'utf8')) as CourseData;
for (const x0 of xs.map(Number)) {
  const c = JSON.parse(JSON.stringify(base)) as CourseData;
  delete c.plan; delete c.routes;
  c.terrain.platforms[c.terrain.platforms.length - 1].x0 = x0;
  const r = searchIdealRun(c, { routes: true });
  const p0 = r.plan;
  const good: number[] = [];
  if (p0.airHands?.[0] === false) for (let h = 0; h <= 480; h++) {
    const pl: Plan = { ...p0, hangTicks: [h], airHands: [false] };
    if (playPlan(c, pl, 120 * 40).world.outcome === 'cleared') good.push(h);
  }
  console.log(`deck ${x0}: routes ${JSON.stringify(r.routes?.map((q) => `${q.name} ${(q.ticks / 120).toFixed(1)}s${q.chosen ? '*' : ''}`))}; skip window ${good.length ? `${good[0]}..${good[good.length - 1]} (${good.length} ticks = ${(good.length / 120).toFixed(2)} s)` : 'none'}`);
}
