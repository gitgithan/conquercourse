// Usage: npx tsx scripts/route-explore.ts <file.course.json> <deck x0 ...>   For each far-deck position: the routes the search finds (bar to bar, skip), their times and which is faster (CC-67).
import { readFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import { searchIdealRun } from '../src/sim/ideal';

const [file, ...xs] = process.argv.slice(2);
const base = JSON.parse(readFileSync(file, 'utf8')) as CourseData;
for (const x0 of xs.map(Number)) {
  const c = JSON.parse(JSON.stringify(base)) as CourseData;
  delete c.plan; delete c.routes;
  c.terrain.platforms[c.terrain.platforms.length - 1].x0 = x0;
  const t = Date.now();
  const r = searchIdealRun(c, { routes: true });
  console.log(`deck at ${x0}: cleared ${r.cleared}; hang ${JSON.stringify(r.plan.hangTicks)} airHands ${JSON.stringify(r.plan.airHands)}; routes ${JSON.stringify(r.routes?.map((q) => `${q.name} ${(q.ticks / 120).toFixed(2)}s${q.chosen ? '*' : ''}`))} (${((Date.now() - t) / 1000).toFixed(0)} s)`);
}
