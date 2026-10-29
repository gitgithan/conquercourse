// Writes public/assets/course-meta.json: for each course on a card, how many obstacles it has and how long the best line takes (CC-149).
// The difficulty order uses these two numbers to compare courses of different length. Run: npm run course-meta
import { readFileSync, writeFileSync } from 'node:fs';
import { DEMO_GROUPS } from '../src/ui/world-picker';
import { statKey } from '../src/ui/course-stats';
import { trackFromPlan } from '../src/sim/replay';
import type { CourseData } from '../src/course/course';

export type CourseMeta = { obstacles: number; idealTicks: number | null; routeTicks?: Record<string, number> };
export function metaFor(path: string): CourseMeta {
  const course = JSON.parse(readFileSync(`public${path}`, 'utf8')) as CourseData & { zones?: unknown[] };
  const idealTicks = course.plan ? trackFromPlan(course, course.plan).ticks : null;
  // an obstacle is a press of the best line (a jump, a vault or a climb); a course with no best line counts its marked zones
  const p = course.plan;
  const pressed = p ? p.jumpXs.length + (p.vaultXs?.length ?? 0) + (p.climbXs?.length ?? 0) : 0;
  const routes = (course as CourseData).branches?.flatMap((b) => b.routes) ?? [];
  const routeTicks = routes.length ? Object.fromEntries(routes.filter((r) => r.ticks !== undefined).map((r) => [r.id, r.ticks as number])) : undefined;
  return { obstacles: Math.max(1, pressed || (course.zones?.length ?? 1)), idealTicks, ...(routeTicks ? { routeTicks } : {}) };
}
export const cardPaths = (): string[] => DEMO_GROUPS.flatMap(([, ds]) => ds.map((d) => d[0])).filter((v) => v.startsWith('/assets/'));

if (process.argv[1]?.endsWith('course-meta.ts')) {
  const meta: Record<string, CourseMeta> = {};
  for (const p of cardPaths()) meta[statKey(p)] = metaFor(p);
  writeFileSync('public/assets/course-meta.json', JSON.stringify(meta, null, 2) + '\n');
  console.log(`wrote ${Object.keys(meta).length} courses`);
}
