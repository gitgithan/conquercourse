// Usage: npx tsx scripts/ways-plan.ts [file]   Finds and stores the ideal run of EACH way of every branch (CC-224), and the faster one as the course's plan.
import { readFileSync, writeFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import { fastestRoute, routeCourse, routeOfTrack } from '../src/sim/branches';
import { JUMP_COST } from '../src/sim/energy';
import { playPlan, searchIdealRun, xWindows } from '../src/sim/ideal';
import { trackFromPlan } from '../src/sim/replay';

const f = process.argv[2] ?? 'public/assets/demo/two-ways.course.json';
const course = JSON.parse(readFileSync(f, 'utf8')) as CourseData;
for (const b of course.branches ?? []) {
  for (const r of b.routes) {
    delete r.lines; delete r.effort;
    const t0 = Date.now();
    const sub = routeCourse(course, b.id, r.id);
    const s = searchIdealRun(sub, { routes: true });
    if (!s.cleared) { console.log(`${r.id}: NOT CLEARED`); delete r.plan; delete r.ticks; continue; }
    const full = playPlan(course, s.plan);
    const trk = trackFromPlan(course, s.plan);
    const got = routeOfTrack(b, trk.xs, trk.ys);
    r.lines = s.routes?.map((q) => ({ name: q.name, ticks: q.ticks }));
    r.plan = s.plan; r.effort = Math.round(((1 - playPlan(sub, s.plan).world.energy) / JUMP_COST) * 10) / 10; r.ticks = playPlan(sub, s.plan).world.runner.tick;
    const ws = xWindows(s.windows).concat(s.windows.filter((w) => !xWindows([w]).length)).map((w) => w.widthMs).filter((m) => m > 0);
    r.narrowestMs = ws.length ? Math.round(Math.min(...ws)) : undefined;
    console.log(`${r.id}: ${r.ticks} ticks (${(r.ticks / 120).toFixed(2)} s), narrowest ${r.narrowestMs} ms, effort ${r.effort} jumps, on the full course ${full.world.outcome}, read as ${got?.id}, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  const fast = fastestRoute(b);
  if (fast) course.plan = fast.plan;
}
writeFileSync(f, JSON.stringify(course, null, 2) + '\n');
