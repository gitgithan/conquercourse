// Doc style: one sentence per bullet; a second sentence goes in a sub-bullet, never mid-line.
// `node scripts/doc-style.mjs` lists violations; `--fix` rewrites them in place.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const fix = process.argv.includes('--fix');
const files = execFileSync('git', ['ls-files', '-z', '*.md'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const MARK = /^(\s*)([-*]|\d+\.)\s+/;
const BOUNDARY = /(?<=[a-z0-9)`*'])\. (?=[A-Z*`])/g;
const ABBREV = /(e\.g|i\.e|vs|etc|approx|Fig)$/;

// Split a bullet's text at real sentence ends only (not inside quotes, backticks or after abbreviations).
function sentences(text) {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(BOUNDARY)) {
    const before = text.slice(0, m.index);
    const inQuote = (before.match(/"/g) ?? []).length % 2 === 1;
    const inCode = (before.match(/`/g) ?? []).length % 2 === 1;
    const inItalic = (before.match(/\*/g) ?? []).length % 2 === 1;
    if (inQuote || inCode || inItalic || ABBREV.test(before)) continue;
    parts.push(text.slice(last, m.index + 1));
    last = m.index + 2;
  }
  parts.push(text.slice(last));
  return parts;
}

let bad = 0;
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const out = [];
  let inFence = false;
  lines.forEach((line, i) => {
    if (line.trimStart().startsWith('```')) inFence = !inFence;
    const m = !inFence && line.match(MARK);
    if (!m || /^\s*(\||>)/.test(line)) return out.push(line);
    const [indent, marker] = [m[1], m[2]];
    const body = line.slice(m[0].length);
    if (body.startsWith('"')) return out.push(line);
    const parts = sentences(body);
    if (parts.length === 1) return out.push(line);
    bad++;
    if (!fix) return console.log(`${file}:${i + 1}: ${parts.length} sentences in one bullet`), out.push(line);
    out.push(`${indent}${marker} ${parts[0]}`);
    parts.slice(1).forEach((p) => out.push(`${indent}  - ${p}`));
  });
  if (fix) writeFileSync(file, out.join('\n'));
}
console.log(`${fix ? 'fixed' : 'violations'}: ${bad}`);
if (!fix && bad) process.exit(1);
