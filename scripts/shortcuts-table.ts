// Usage: npx tsx scripts/shortcuts-table.ts public/assets/demo/lache.course.json [more files]
// Writes data/eval/cc-71-shortcuts/<name>.json: the planned time, the shortcuts found (the ones nobody planned) and the move choices.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { findShortcuts } from '../src/sim/shortcuts';

mkdirSync('data/eval/cc-71-shortcuts', { recursive: true });
for (const file of process.argv.slice(2)) {
  const course = JSON.parse(readFileSync(file, 'utf8'));
  const name = basename(file).replace('.course.json', '');
  const t = Date.now();
  const r = findShortcuts(course);
  const out = { course: name, title: course.name, intendedSeconds: r.intendedSeconds, searches: r.searches, searchSeconds: Math.round((Date.now() - t) / 1000), complete: r.complete, shortcuts: r.shortcuts.map(({ plan, ...s }) => s), moveChoices: r.moveChoices };
  writeFileSync(`data/eval/cc-71-shortcuts/${name}.json`, JSON.stringify(out, null, 2) + '\n');
  console.log(name, JSON.stringify({ intended: out.intendedSeconds, shortcuts: out.shortcuts.map((s) => `${s.id} ${s.secondsSaved}s`), moves: out.moveChoices, sec: out.searchSeconds }));
}
