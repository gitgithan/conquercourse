// Usage: node scripts/test.mjs fast|slow|changed|all [extra vitest args]
// fast: skips tests/slow.json; slow: only those, with a longer timeout; changed: tests that import anything changed since origin/main
// (plus demo and place tests when public/assets changed); all: everything. Prints the 10 slowest test files at the end.
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [mode = 'fast', ...extra] = process.argv.slice(2);
const out = join(mkdtempSync(join(tmpdir(), 'cc-test-')), 'result.json');
const args = ['node_modules/vitest/vitest.mjs', 'run', '--reporter=default', '--reporter=json', `--outputFile.json=${out}`];
const env = { ...process.env };
if (mode === 'fast' || mode === 'slow') env.CC_TESTS = mode;
if (mode === 'changed') {
  const git = (a) => spawnSync('git', a, { encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  const base = git(['merge-base', 'HEAD', 'origin/main'])[0] ?? 'origin/main';
  const files = [...new Set([...git(['diff', '--name-only', base]), ...git(['ls-files', '--others', '--exclude-standard'])])];
  if (!files.length) { console.log('test:changed: nothing changed since origin/main'); process.exit(0); }
  const tests = new Set(files.filter((f) => /^tests\/.*\.test\.ts$/.test(f)));
  const rules = [[/^public\/assets\/demo\//, /demo|plans|golden/], [/^public\/assets\/(places|experiments)\//, /place|photo/], [/^public\/feedback/, /feedback/], [/^docs\/|\.md$/, /doc-style/], [/\.json$/, /json-format/]];
  const all = git(['ls-files', 'tests']).filter((f) => f.endsWith('.test.ts'));
  for (const f of files) for (const [where, which] of rules) if (where.test(f)) all.filter((t) => which.test(t)).forEach((t) => tests.add(t));
  const src = files.filter((f) => /^(src|scripts|functions)\//.test(f));
  console.log(`test:changed: ${files.length} changed files, ${src.length} in src/scripts/functions, ${tests.size} test files named directly`);
  if (src.length) args.push('related', ...src); else if (tests.size) args.push(...tests); else { console.log('test:changed: no tests relate to these files'); process.exit(0); }
  if (src.length) args.push(...tests);
}
const t0 = Date.now();
const r = spawnSync('node', [...args, ...extra], { stdio: 'inherit', env });
try {
  const j = JSON.parse(readFileSync(out, 'utf8'));
  const rows = j.testResults.map((x) => ({ f: x.name.split('/tests/')[1] ?? x.name, s: (x.endTime - x.startTime) / 1000 })).sort((a, b) => b.s - a.s).slice(0, 10);
  console.log(`\n${mode}: ${j.numPassedTests} passed, ${j.numFailedTests} failed, ${j.numTotalTests} total in ${((Date.now() - t0) / 1000).toFixed(0)} s. Slowest files:`);
  for (const x of rows) console.log(`  ${x.s.toFixed(0).padStart(4)} s  ${x.f}`);
} catch { /* the run stopped before it wrote a result */ }
process.exit(r.status ?? 1);
