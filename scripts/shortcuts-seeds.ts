// Usage: npx tsx scripts/shortcuts-seeds.ts 1 2 3 ...   (generator seeds)
// Does a generated course contain a route the generator did not plan? Writes data/eval/cc-71-shortcuts/seeds/<seed>.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { findShortcuts } from '../src/sim/shortcuts';
import { generateCourse } from '../src/slice/generator';

mkdirSync('data/eval/cc-71-shortcuts/seeds', { recursive: true });
for (const a of process.argv.slice(2)) {
  const seed = Number(a);
  const course = generateCourse(seed);
  const t = Date.now();
  const r = findShortcuts(course, { moveChoices: false });
  const out = { seed, name: course.name, zones: (course.zones ?? []).map((z) => z.name), intendedSeconds: r.intendedSeconds, searchSeconds: Math.round((Date.now() - t) / 1000), shortcuts: r.shortcuts.map(({ plan, ...s }) => s) };
  writeFileSync(`data/eval/cc-71-shortcuts/seeds/${seed}.json`, JSON.stringify(out, null, 2) + '\n');
  console.log(seed, JSON.stringify({ zones: out.zones.join(' > '), sec: out.searchSeconds, shortcuts: out.shortcuts.map((s) => `${s.id} saves ${s.secondsSaved}s: ${s.how}`) }));
}
