// Pretty-prints every tracked .json file (2 spaces, trailing newline) so files open readable in the editor.
// `node scripts/format-json.mjs` rewrites them; `--check` only lists the ones that are not formatted.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const check = process.argv.includes('--check');
const files = execFileSync('git', ['ls-files', '-z', '*.json'], { encoding: 'utf8' })
  .split('\0')
  .filter((f) => f && !f.endsWith('package-lock.json'));

const unformatted = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const pretty = JSON.stringify(JSON.parse(text), null, 2) + '\n';
  if (pretty === text) continue;
  unformatted.push(file);
  if (!check) writeFileSync(file, pretty);
}
console.log(`${check ? 'unformatted' : 'reformatted'}: ${unformatted.length} of ${files.length}`);
if (check && unformatted.length) {
  console.log(unformatted.join('\n'));
  process.exit(1);
}
