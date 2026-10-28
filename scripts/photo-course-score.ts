// Stage 2 of the CC-52 experiment (needs no key; heavy, so it runs on the VM): read the saved replies, build each draft, prove it, Fix it, score it.
// Usage: npx tsx scripts/photo-course-score.ts      Writes data/eval/photo-course/results.json and run.json.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fixLayout } from '../src/slice/fixit';
import { fixBars } from '../src/slice/fixbars';
import { holdsOf } from '../src/slice/holds-world';
import { NO_TURN, proves } from '../src/slice/photo-proof';
import { layoutToPieces, parseLayout, scoreLayout, type Layout } from '../src/slice/photo-course';

const lane = NO_TURN;
const dir = 'data/eval/photo-course';
const key = JSON.parse(readFileSync(`${dir}/answer-key.json`, 'utf8')) as { photos: Record<string, { items: Layout['items'] }> };
const rows: Record<string, unknown>[] = [];
let tokens = 0, ms = 0;

for (const f of readdirSync(`${dir}/outputs`).filter((n) => n.endsWith('.json')).sort()) {
  const o = JSON.parse(readFileSync(`${dir}/outputs/${f}`, 'utf8')) as { photo: string; run: number; ms: number; usage: { total_tokens: number } | null; reply: string };
  tokens += o.usage?.total_tokens ?? 0; ms += o.ms;
  const parsed = o.reply ? parseLayout(o.reply) : { layout: null, text: '', problems: ['the model ran out of room and gave no answer'] };
  const row: Record<string, unknown> = { photo: o.photo, run: o.run, tokens: o.usage?.total_tokens ?? null, seconds: Math.round(o.ms / 100) / 10, problems: parsed.problems, said: parsed.text.slice(0, 200), layout: parsed.layout?.items ?? null };
  if (parsed.layout) {
    const t0 = performance.now();
    const pieces = layoutToPieces(parsed.layout);
    const hasBars = holdsOf(pieces, lane).length > 0;
    row.clearsAsDrawn = proves(pieces, lane);
    if (row.clearsAsDrawn) row.clearsAfterFixIt = true;
    else {
      const fx = hasBars ? fixBars(pieces, lane) : fixLayout(pieces, lane);
      row.clearsAfterFixIt = fx.ok && proves(fx.pieces, lane); row.fixSteps = fx.steps;
    }
    row.proofSeconds = Math.round((performance.now() - t0) / 100) / 10;
  }
  row.score = scoreLayout(parsed.layout, { items: key.photos[o.photo].items });
  rows.push(row);
  console.log(o.photo, o.run, row.clearsAsDrawn, row.clearsAfterFixIt, JSON.stringify(row.score));
}
const ok = rows.filter((r) => r.layout);
const mean = (a: number[]) => (a.length ? Math.round((a.reduce((s, v) => s + v, 0) / a.length) * 100) / 100 : null);
const summary = {
  runs: rows.length, gaveALayout: ok.length, clearsAsDrawn: ok.filter((r) => r.clearsAsDrawn).length, clearsAfterFixIt: ok.filter((r) => r.clearsAfterFixIt).length,
  sameObstacleCountAsKey: rows.filter((r) => (r.score as { modelCount: number; keyCount: number }).modelCount === (r.score as { keyCount: number }).keyCount).length,
  meanMatchedShare: mean(rows.map((r) => (r.score as { matched: number; keyCount: number }).matched / (r.score as { keyCount: number }).keyCount)),
  meanRelativeSizeError: mean(rows.map((r) => (r.score as { meanRelError: number | null }).meanRelError).filter((v): v is number => v !== null)),
  totalTokens: tokens, meanTokensPerPhoto: Math.round(tokens / rows.length), meanSecondsPerPhoto: Math.round(ms / rows.length / 100) / 10,
};
writeFileSync(`${dir}/results.json`, JSON.stringify({ summary, rows }, null, 2) + '\n');
writeFileSync(`${dir}/run.json`, JSON.stringify({ experiment: 'photo-course', model: 'meta-models/muse-spark-open-1026', summary, inputs: 'outputs/*.json (raw replies), answer-key.json', note: 'costs: token counts only; the unit price is not published to us' }, null, 2) + '\n');
console.log(summary);
