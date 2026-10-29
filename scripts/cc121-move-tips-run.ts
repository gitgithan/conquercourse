// CC-121: Muse Spark Open move tips for the 19 real objects, compared with the CC-110 move groups. Runs where the Baseten key lives:
//   npx tsx scripts/cc121-move-tips-run.ts [limit]   -> data/eval/cc-119-move-tips/
// It calls the same function the site uses (askTip). Four calls at a time.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { askTip } from '../functions/api/move-tips';
import { REAL_MOVE } from '../src/slice/piece-info';
import { costUsd, counting, key, pool, shrink, tokens } from './lib/cc119';

const limit = Number(process.argv[2] ?? 999);
const dir = 'data/eval/cc-119-move-tips';
mkdirSync(`${dir}/inputs`, { recursive: true }); mkdirSync(`${dir}/outputs`, { recursive: true });
const index = (JSON.parse(readFileSync('public/assets/objects/index.json', 'utf8')) as { objects: { name: string; photo: string; label: string; box: number[] }[] }).objects.slice(0, limit);
const fileOf = (photo: string) => (photo.startsWith('park') ? `public/assets/park/${photo}.jpg` : /^(bench|rail)\d/.test(photo) ? `data/eval/cc-38-photo-to-3d/inputs/${photo}.jpg` : `data/eval/cc-110-real-objects/inputs/${photo}.jpg`);
const cases = index.map((o) => ({ ...o, file: fileOf(o.photo), key: REAL_MOVE[o.name] }));
writeFileSync(`${dir}/inputs/cases.json`, JSON.stringify(cases, null, 2) + '\n');
const t0 = Date.now();
const rows = await pool(cases, 4, async (c) => {
  const t = Date.now();
  const r = await askTip(key, { name: c.label, image: shrink(c.file, c.name, c.box) }, counting);
  const moves = r.body.tip?.moves ?? [];
  const row = { name: c.name, label: c.label, key: c.key, status: r.status, moves, idea: r.body.tip?.idea ?? '', top1: moves[0] === c.key, hit: moves.includes(c.key), ms: Date.now() - t };
  writeFileSync(`${dir}/outputs/${c.name}.json`, JSON.stringify(row, null, 2) + '\n');
  console.log(c.name, `key=${c.key}`, moves.join(','), row.hit ? 'hit' : 'MISS', row.idea ? '' : '(no idea)');
  return row;
});
const summary = { objects: rows.length, tips: rows.filter((r) => r.moves.length).length, keyMoveListed: rows.filter((r) => r.hit).length, keyMoveFirst: rows.filter((r) => r.top1).length, withIdea: rows.filter((r) => r.idea).length, errors: rows.filter((r) => r.status !== 200).length, movesPerObject: +(rows.reduce((n, r) => n + r.moves.length, 0) / rows.length).toFixed(2) };
const run = { experiment: 'cc-119-move-tips', issue: 'CC-121', model: 'meta-models/muse-spark-open-1026', date: new Date().toISOString().slice(0, 10), seconds: Math.round((Date.now() - t0) / 1000), tokens: { prompt: tokens.in, completion: tokens.out }, costUsd: costUsd(), summary, answerKey: 'REAL_MOVE in src/slice/piece-info.ts (CC-110)', inputs: 'inputs/cases.json (photos are the repo files listed there; each is cropped to the object box)', outputs: 'outputs/*.json' };
writeFileSync(`${dir}/run.json`, JSON.stringify(run, null, 2) + '\n');
console.log(JSON.stringify(run, null, 2));
