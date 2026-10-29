// Usage: npx tsx scripts/export-flagged-logs.ts   (read only: it runs SELECT through `wrangler d1 execute --remote`, never a write)
// Exports the verified clears that beat the stored best line (beats_ideal = 1, verified = 1) into data/seeds/<course>/<run_id>.json (an InputLog), the seeds
// scripts/plans.ts and scripts/seed-plan.ts use (CC-176). Each log is replayed here first; one that does not clear is not written.
// The keys are in the `keys` column (migration 0005, which needs the owner's yes). Without it the script lists the flagged rows and says the keys are not stored.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import { decodeLog, verifyLog } from '../src/sim/replay';

const DB = 'conquercourse-feedback';
const query = (sql: string): Record<string, unknown>[] => {
  if (!/^\s*SELECT\b/i.test(sql)) throw new Error('read only: SELECT statements only');
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', DB, '--remote', '--json', '--command', sql], { encoding: 'utf8', maxBuffer: 1 << 26 });
  return (JSON.parse(out) as { results: Record<string, unknown>[] }[])[0].results;
};
const WHERE = 'WHERE beats_ideal = 1 AND verified = 1';
let rows: Record<string, unknown>[];
try { rows = query(`SELECT course_key, run_id, ticks, ts, course_hash, keys FROM course_clears ${WHERE} ORDER BY course_key, ticks`); }
catch {
  rows = query(`SELECT course_key, run_id, ticks, ts, course_hash FROM course_clears ${WHERE} ORDER BY course_key, ticks`);
  console.log(`${rows.length} flagged clears; the keys are not stored yet (migration 0005 is not applied), so nothing can be exported:`);
  for (const r of rows) console.log(`  ${r.course_key} ${r.ticks} ticks ${r.ts}`);
  process.exit(0);
}
let written = 0;
for (const r of rows) {
  const key = String(r.course_key), file = `public/assets/${key}.course.json`;
  if (!r.keys || !existsSync(file)) { console.log(`skip ${key} ${r.run_id}: ${r.keys ? 'no course file' : 'no keys stored (flagged before migration 0005)'}`); continue; }
  const course = JSON.parse(readFileSync(file, 'utf8')) as CourseData;
  const log = await decodeLog(String(r.keys));
  const v = verifyLog(course, log);
  if (!v.cleared) { console.log(`skip ${key} ${r.run_id}: does not clear on the current course (the course changed since)`); continue; }
  const dir = `data/seeds/${key.split('/').pop()}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${r.run_id}.json`, JSON.stringify(log, null, 2) + '\n');
  console.log(`wrote ${dir}/${r.run_id}.json (${v.ticks} ticks)`);
  written++;
}
console.log(`${written} of ${rows.length} flagged logs written`);
