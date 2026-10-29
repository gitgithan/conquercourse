// Usage: npx tsx scripts/plans.ts [file.course.json ...]   (default: every demo course; also `npm run plans`)
// Finds the ideal run for the whole of each demo course and stores it in the file as `plan`, so Shift+I starts at once.
// Run it again whenever the simulator or the search changes: tests/demo-plans.test.ts fails on a stale plan.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import { DEMO_COURSE_FILES } from '../src/course/demo-list';
import { xWindows } from '../src/sim/ideal';
import { nodePool } from '../src/sim/ideal-pool-node';
import { findShortcuts } from '../src/sim/shortcuts';
import { generateCourse } from '../src/slice/generator';
import { chooseWithSeeds } from '../src/sim/seed-plan';
import type { InputLog } from '../src/sim/replay';

// A generated sample is the generator's own output for its seed (its plan is composed from proved moves, cheap), not a whole-course search.
const GENERATED: Record<string, number> = { 'generated-1.course.json': 2 };

// The whole-course searches run on all the machine's cores (worker threads; same answers as one thread).
const pool = nodePool();
const files = process.argv.length > 2 ? process.argv.slice(2) : [...DEMO_COURSE_FILES];
let bad = 0;
for (const f of files) {
  const t0 = Date.now();
  const seed = GENERATED[f.split('/').pop()!];
  if (seed !== undefined) {
    const g = generateCourse(seed);
    delete g.shortcuts;
    const sc0 = findShortcuts(g, { moveChoices: false }).shortcuts; // routes the generator did not plan (CC-71)
    if (sc0.length) g.shortcuts = sc0;
    writeFileSync(f, JSON.stringify(g, null, 2) + '\n');
    console.log(`${f}: regenerated from seed ${seed}, plan ${g.plan ? 'stored' : 'MISSING'} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    if (!g.plan) bad++;
    continue;
  }
  const course = JSON.parse(readFileSync(f, 'utf8')) as CourseData;
  delete course.plan; delete course.routes; delete course.shortcuts; delete course.windows;
  const r = await pool.search(course, undefined, undefined, { routes: true });
  if (r.cleared) {
    course.plan = r.plan;
    // verified human lines (data/seeds/<course name>/*.json, each an InputLog): the faster of the search and the people's lines is stored (CC-176)
    const dir = `data/seeds/${f.split('/').pop()!.replace('.course.json', '')}`;
    const seeds = existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith('.json')).sort().map((n) => JSON.parse(readFileSync(`${dir}/${n}`, 'utf8')) as InputLog) : [];
    if (seeds.length) {
      const pick = chooseWithSeeds(course, r.plan, seeds);
      if (pick) { course.plan = pick.plan; console.log(`${f}: search ${pick.searchTicks} ticks, seeds ${pick.seedTicks.join('/')}, kept the ${pick.from}${pick.from === 'seed' ? ' (the search missed a faster line)' : ''}`); }
    }
    course.windows = xWindows(r.windows); if (r.routes) course.routes = r.routes;
    // routes nobody planned (src/sim/shortcuts.ts), stored beside the plan so the Course can say so at once
    const sc = findShortcuts(course, { moveChoices: false }).shortcuts;
    if (sc.length) course.shortcuts = sc;
    writeFileSync(f, JSON.stringify(course, null, 2) + '\n');
  } else bad++;
  console.log(`${f}: ${r.cleared ? 'plan stored' : 'NOT CLEARED, no plan stored'} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
pool.close();
process.exit(bad ? 1 : 0);
