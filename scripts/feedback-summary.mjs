// Pulls the feedback from the live database and writes a summary the team can read (no raw rows are committed).
// Usage: node scripts/feedback-summary.mjs [round]   (needs `npx wrangler login` once)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const round = process.argv[2] ?? JSON.parse(readFileSync('public/feedback-questions.json', 'utf8')).round;
const q = JSON.parse(readFileSync('public/feedback-questions.json', 'utf8'));
const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'conquercourse-feedback', '--remote', '--json', '--command',
  `SELECT ts, session, build, mode, answers, context FROM feedback WHERE round = '${round.replace(/[^a-z0-9-]/gi, '')}' ORDER BY ts`], { encoding: 'utf8' });
const rows = JSON.parse(out)[0].results.map((r) => ({ ...r, answers: JSON.parse(r.answers), context: JSON.parse(r.context) }));
const lines = [`# Public feedback, round ${round}`, '', `*${rows.length} submissions from ${new Set(rows.map((r) => r.session)).size} players; builds: ${[...new Set(rows.map((r) => r.build))].join(', ')}.*`, ''];
for (const question of q.questions) {
  const vals = rows.map((r) => r.answers[question.id]).filter((v) => v !== undefined);
  lines.push(`## ${question.text}`, `- Answered by ${vals.length} of ${rows.length}.`);
  if (question.type === 'scale') {
    const n = vals.map(Number);
    lines.push(`- Average ${(n.reduce((a, b) => a + b, 0) / Math.max(1, n.length)).toFixed(1)} out of 5.`, `- Spread: ${[1, 2, 3, 4, 5].map((k) => `${k}: ${n.filter((v) => v === k).length}`).join(', ')}.`);
  } else if (question.type === 'choice') {
    for (const o of question.options) lines.push(`- ${o}: ${vals.filter((v) => v === o).length}`);
  } else {
    vals.forEach((v) => lines.push(`- "${String(v).replace(/\n/g, ' ')}"`));
  }
  lines.push('');
}
const falls = rows.map((r) => Number(r.context.falls ?? 0));
lines.push('## Play counters', `- Falls per submission: average ${(falls.reduce((a, b) => a + b, 0) / Math.max(1, falls.length)).toFixed(1)}.`, `- Cleared the Course: ${rows.filter((r) => Number(r.context.clears ?? 0) > 0).length}.`, `- Opened the Dojo: ${rows.filter((r) => Number(r.context.dojo_opens ?? 0) > 0).length}.`);
mkdirSync('docs/feedback', { recursive: true });
const file = `docs/feedback/public-${round}-${new Date().toISOString().slice(0, 10)}.md`;
writeFileSync(file, lines.join('\n') + '\n');
console.log('wrote', file);
