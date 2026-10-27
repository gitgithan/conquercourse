// Prints the newest rows of the live feedback table, so you can check that a submission arrived.
// Usage: node scripts/feedback-rows.mjs [how-many]   (needs `npx wrangler login` once)
import { execFileSync } from 'node:child_process';

const n = Math.min(200, Math.max(1, Number(process.argv[2]) || 10));
const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'conquercourse-feedback', '--remote', '--json', '--command',
  `SELECT id, ts, round, mode, build, answers, context FROM feedback ORDER BY id DESC LIMIT ${n}`], { encoding: 'utf8' });
const rows = JSON.parse(out)[0].results;
if (!rows.length) console.log('No rows yet.');
for (const r of rows) console.log(`#${r.id} ${r.ts} ${r.round} (${r.mode}, build ${r.build})\n  answers: ${r.answers}\n  context: ${r.context}\n`);
