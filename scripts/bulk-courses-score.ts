// Stage 2 of CC-122 (needs no key; heavy, so it runs on the VM): parse each saved reply, prove it, Fix it, and list which moves the proven course needs.
// Usage: npx tsx scripts/bulk-courses-score.ts      Writes data/eval/cc-122-bulk-courses/results.json, kept/*.json and run.json.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fixBars } from '../src/slice/fixbars';
import { fixLayout } from '../src/slice/fixit';
import { holdsOf } from '../src/slice/holds-world';
import { NO_TURN, proves } from '../src/slice/photo-proof';
import { layoutToPieces, parseLayout, type Layout } from '../src/slice/photo-course';
import { roleCourse } from '../src/slice/roles';
import { searchIdealRun } from '../src/sim/ideal';

const dir = 'data/eval/cc-122-bulk-courses';
mkdirSync(`${dir}/kept`, { recursive: true });
const lane = NO_TURN;
const rows: Record<string, unknown>[] = [];
let tokens = 0;

// The moves a layout asks for, read from the plan the ideal-run search found on the proven course.
function movesOf(layout: Layout, plan: ReturnType<typeof searchIdealRun>['plan']): string[] {
  const m = new Set<string>();
  if (layout.items.some((i) => i.kind === 'gap')) m.add('gap jump');
  if ((plan.jumpXs?.length ?? 0) > 0) m.add('jump');
  if ((plan.vaultXs?.length ?? 0) > 0) m.add('vault');
  if ((plan.climbXs?.length ?? 0) > 0 || plan.climbHands) m.add('climb');
  if ((plan.hangTicks?.length ?? 0) > 0) m.add('swing');
  if ((plan.noGrab?.length ?? 0) > 0) m.add('bar skip');
  let level = 0;
  for (const i of layout.items) { if (i.kind === 'block') { if (level - i.height >= 1.5) m.add('drop'); level = i.height; } else if (i.kind === 'ground') level = 0; }
  return [...m].sort();
}

for (const f of readdirSync(`${dir}/outputs`).filter((n) => n.endsWith('.json')).sort()) {
  const o = JSON.parse(readFileSync(`${dir}/outputs/${f}`, 'utf8')) as { index: number; theme: string; setting: string; level: number; usage: { total_tokens: number } | null; reply: string };
  tokens += o.usage?.total_tokens ?? 0;
  const parsed = o.reply ? parseLayout(o.reply) : { layout: null, text: '', problems: ['no answer (out of room)'] };
  const row: Record<string, unknown> = { index: o.index, theme: o.theme, setting: o.setting, level: o.level, said: parsed.text.slice(0, 160), problems: parsed.problems, layout: parsed.layout?.items ?? null };
  if (parsed.layout) {
    const pieces = layoutToPieces(parsed.layout);
    const hasBars = holdsOf(pieces, lane).length > 0;
    row.clearsAsDrawn = proves(pieces, lane);
    let finalPieces = pieces, ok = row.clearsAsDrawn as boolean;
    if (!ok) {
      const fx = hasBars ? fixBars(pieces, lane) : fixLayout(pieces, lane);
      ok = fx.ok && proves(fx.pieces, lane);
      if (ok) { finalPieces = fx.pieces; row.fixSteps = fx.steps; }
    }
    row.clearsAfterFixIt = ok;
    if (ok) {
      const course = roleCourse(finalPieces, lane, `Candidate ${o.index}`).course;
      const res = searchIdealRun(course);
      row.moves = movesOf(parsed.layout, res.plan);
      row.fixed = row.clearsAsDrawn ? false : true;
      writeFileSync(`${dir}/kept/${String(o.index).padStart(3, '0')}.json`, JSON.stringify({ index: o.index, theme: o.theme, setting: o.setting, level: o.level, said: parsed.text, layout: parsed.layout.items, clearsAsDrawn: row.clearsAsDrawn, moves: row.moves, plan: res.plan }, null, 2) + '\n');
    }
  }
  rows.push(row);
  console.log(o.index, row.clearsAsDrawn, row.clearsAfterFixIt, JSON.stringify(row.moves ?? ''));
}
const ok = rows.filter((r) => r.layout), kept = rows.filter((r) => r.clearsAfterFixIt);
const key = (r: Record<string, unknown>) => ((r.moves as string[]) ?? []).join('+') || 'ground only';
const sets: Record<string, number> = {}; for (const r of kept) sets[key(r)] = (sets[key(r)] ?? 0) + 1;
const layoutKey = (r: Record<string, unknown>) => JSON.stringify((r.layout as Layout['items']).map((i) => ({ ...i, ...('length' in i ? { length: Math.round(i.length) } : {}), ...('width' in i ? { width: Math.round(i.width) } : {}), ...('height' in i ? { height: Math.round(i.height * 2) / 2 } : {}) })));
const dups = kept.length - new Set(kept.map(layoutKey)).size;
const byTheme: Record<string, { asked: number; kept: number }> = {};
for (const r of rows) { const t = String(r.theme); (byTheme[t] ??= { asked: 0, kept: 0 }).asked++; if (r.clearsAfterFixIt) byTheme[t].kept++; }
const summary = { asked: rows.length, gaveALayout: ok.length, clearsAsDrawn: ok.filter((r) => r.clearsAsDrawn).length, clearsAfterFixIt: kept.length, nearDuplicates: dups, distinctMoveSets: Object.keys(sets).length, moveSets: sets, byTheme, totalTokens: tokens };
writeFileSync(`${dir}/results.json`, JSON.stringify({ summary, rows }, null, 2) + '\n');
writeFileSync(`${dir}/run.json`, JSON.stringify({ experiment: 'cc-122-bulk-courses', model: 'meta-models/muse-spark-open-1026', summary, inputs: 'outputs/*.json (prompt themes in scripts/bulk-courses-ask.ts)', note: 'costs: token counts only; Baseten list price $1.25 in / $4.25 out per 1M' }, null, 2) + '\n');
console.log(summary);
