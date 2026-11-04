// Usage: npx tsx scripts/preset-plans.ts [preset-id ...]   (also `npm run plans:presets`)
// Finds the ideal run of each ready-made World Editor course and stores it in src/slice/preset-plans.json (CC-243), so the editor shows its verdict at once.
import { readFileSync, writeFileSync } from 'node:fs';
import { proveEditorCourse } from '../src/sim/fork';
import { xWindows } from '../src/sim/ideal';
import { nodePool } from '../src/sim/ideal-pool-node';
import { findShortcuts } from '../src/sim/shortcuts';
import { presetKey, type PresetPlan } from '../src/slice/preset-plans';
import { presetCourses } from './preset-courses';

const FILE = 'src/slice/preset-plans.json';
const table = JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, PresetPlan>;
const pool = nodePool(), courses = presetCourses();
const ids = process.argv.length > 2 ? process.argv.slice(2) : Object.keys(courses);
for (const id of ids) {
  const t0 = Date.now(), c = courses[id];
  if (!c) { console.log(`${id}: no such preset`); continue; }
  if (c.climbPoles?.length) { // CC-133: a pole is proved lane by lane
    const q = proveEditorCourse(c);
    table[id] = { key: presetKey(c), cleared: q.cleared, ...(q.cleared ? { plan: q.plan, windows: [], timingWindows: [], branches: q.branches } : {}) };
    writeFileSync(FILE, JSON.stringify(table, null, 2) + '\n');
    console.log(`${id}: ${q.cleared ? 'lanes proved' : 'not cleared'} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    continue;
  }
  const r = await pool.search(c, undefined, undefined, { routes: true });
  const out: PresetPlan = { key: presetKey(c), cleared: r.cleared };
  if (r.cleared) {
    out.plan = r.plan; out.windows = xWindows(r.windows); out.timingWindows = r.windows; if (r.routes) out.routes = r.routes;
    const sc = findShortcuts({ ...c, plan: r.plan }, { moveChoices: false }).shortcuts;
    if (sc.length) out.shortcuts = sc;
  }
  table[id] = out;
  writeFileSync(FILE, JSON.stringify(table, null, 2) + '\n');
  console.log(`${id}: ${r.cleared ? 'plan stored' : 'not cleared (verdict stored)'} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
pool.close();
process.exit(0);
