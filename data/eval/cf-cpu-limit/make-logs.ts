// Builds the run logs for the CPU-limit test: each course's stored plan played once and encoded like a player's keys (CC-169).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { recordPlan, encodeLog, courseHash } from '../../../src/sim/replay';
import { searchIdealRun } from '../../../src/sim/ideal';
import type { CourseData } from '../../../src/course/course';
const out: Record<string, unknown>[] = [];
const dirs: [string, string][] = [['demo', 'public/assets/demo'], ['experiments/osm', 'public/assets/experiments/osm']];
for (const [pre, dir] of dirs) for (const f of readdirSync(dir).filter((f) => f.endsWith('.course.json'))) {
  const course = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as CourseData;
  const name = f.replace('.course.json', '');
  let plan = course.plan;
  if (!plan && pre === 'demo') { try { const r = searchIdealRun(course); if (r.cleared) plan = r.plan; } catch { /* skip */ } }
  if (!plan) { console.log(name, 'no plan'); continue; }
  const { recorder, world } = recordPlan(course, plan, 120 * 120);
  if (world.outcome !== 'cleared') { console.log(name, 'not cleared', world.outcome); continue; }
  const log = recorder.snapshot();
  console.log(name, recorder.ticks, (recorder.ticks / 120).toFixed(1) + 's', 'runs', log.length);
  out.push({ key: `${pre}/${name}`, hash: courseHash(course), ticks: recorder.ticks, log, keys: await encodeLog(log) });
}
writeFileSync(new URL('./inputs/logs.json', import.meta.url), JSON.stringify(out, null, 2));
