// Fails when a tracked .md file links to, or names, a repo file that is not tracked (for example experiment output kept privately).
// `node scripts/check-doc-links.mjs` prints file:line and the target; `--mentions` also lists backticked paths.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const tracked = new Set(execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 1 << 28 }).split('\n').filter(Boolean));
const dirs = new Set();
for (const f of tracked) { let d = path.dirname(f); while (d !== '.' && !dirs.has(d)) { dirs.add(d); d = path.dirname(d); } }
const LINK = /\]\(([^)\s]+)\)/g;
const MENTION = /`((?:data\/eval|public|docs|src|scripts|pipelines|tests|functions)\/[A-Za-z0-9_.\-/]+\.[A-Za-z0-9]{1,6})`/g;
const SKIP_LINK = /^(https?:|mailto:|#|\/\/)/;

export function broken({ mentions = false } = {}) {
  const out = [];
  for (const f of tracked) {
    if (!f.endsWith('.md')) continue;
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(LINK)) {
        const t = m[1].split('#')[0].split('?')[0];
        if (!t || SKIP_LINK.test(m[1])) continue;
        const p = path.normalize(t.startsWith('/') ? t.slice(1) : path.join(path.dirname(f), t)).replace(/\/$/, '');
        if (!tracked.has(p) && !dirs.has(p)) out.push(`${f}:${i + 1} link ${t}`);
      }
      if (mentions) for (const m of line.matchAll(MENTION)) if (!tracked.has(m[1]) && !m[1].includes('*') && !m[1].includes('<')) out.push(`${f}:${i + 1} mention ${m[1]}`);
    });
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('check-doc-links.mjs')) {
  const bad = broken({ mentions: process.argv.includes('--mentions') });
  bad.forEach((b) => console.log(b));
  console.log(`${bad.length} broken`);
  process.exit(bad.length ? 1 : 0);
}
