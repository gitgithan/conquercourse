// CC-168: play every stored demo plan and search a few courses again; print outcome and time so two builds can be compared.
// Usage: npx tsx scripts/grab-ideal-check.ts [--search file ...] > out.json
import { readFileSync } from 'node:fs';
import { DEMO_COURSE_FILES } from '../src/course/demo-list';
import { playPlan, searchIdealRun } from '../src/sim/ideal';

const searchFiles = process.argv.includes('--search') ? process.argv.slice(process.argv.indexOf('--search') + 1) : [];
const rows: Record<string, unknown>[] = [];
for (const f of DEMO_COURSE_FILES) {
  const c = JSON.parse(readFileSync(f, 'utf8'));
  if (!c.plan) { rows.push({ f, stored: 'no plan' }); continue; }
  const r = playPlan(c, c.plan);
  rows.push({ f, stored: r.world.outcome, ticks: r.world.runner.tick });
}
for (const f of searchFiles) {
  const c = JSON.parse(readFileSync(f, 'utf8'));
  const t0 = Date.now();
  const s = searchIdealRun(c);
  const r = playPlan(c, s.plan);
  rows.push({ f, searched: s.cleared, ticks: r.world.runner.tick, plan: s.plan, seconds: Math.round((Date.now() - t0) / 1000) });
}
console.log(JSON.stringify(rows, null, 2));
