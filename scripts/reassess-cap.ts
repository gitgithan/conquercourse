// CC-56 reassess: what changed for real places once the lane's 4.3 m cap was gone.
// Reads data/eval/cc-56-reassess/{before,after,noclamp}/<place>/{result.json,course.json} (made by scripts/osm-lane.ts on the commit before CC-56 and on main)
// and writes data/eval/cc-56-reassess/summary.json plus a markdown table on stdout.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const root = 'data/eval/cc-56-reassess';
const places = ['eixample-flat', 'eixample-hills', 'sydney-flat', 'sydney-hills', 'montmartre-flat', 'montmartre-hills', 'sf-flat', 'sf-hills'];
const variants = ['before', 'after', 'noclamp'] as const;
const SCAN = 0.6; // a fixed shrink, to see whether a bigger place (less shrinking) still gives a lane: scan/<place>-s60

interface Platform { x0: number; x1: number; top: number; profile?: [number, number][] }
// the biggest way down along the course: between neighbouring ground (across a gap too) and inside an outline
function tallestDrop(platforms: Platform[]): number {
  let drop = 0, last: number | null = null;
  for (const p of [...platforms].sort((a, b) => a.x0 - b.x0)) {
    const pts = p.profile ?? [[p.x0, p.top], [p.x1, p.top]];
    for (const [, y] of pts) { if (last !== null) drop = Math.max(drop, last - y); last = y; }
  }
  return Math.round(drop * 100) / 100;
}

const read = (path: string) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null);
const rows: Record<string, unknown>[] = [];
for (const place of places) for (const v of variants) {
  const r = read(`${root}/${v}/${place}/result.json`);
  if (!r) continue;
  const c = read(`${root}/${v}/${place}/course.json`);
  const b = r.bestLane as Record<string, unknown> | undefined;
  rows.push({
    place, variant: v, terrain: r.terrain, reliefM: r.terrainRelief_m, buildings: r.buildings, medianHeightM: r.medianHeight_m,
    shrink: r.shrink, ladderTries: (r.shrinkTries as unknown[] | undefined)?.length ?? null, lanesFound: r.lanesFound ?? 0,
    laneLengthM: b ? Math.round((b.length as number) * 10) / 10 : null, gaps: b?.gaps ?? null, steps: b?.steps ?? null,
    levelM: b?.levelM ?? null, tallestDropM: c ? tallestDrop(c.terrain.platforms) : null,
    idealRunCleared: b ? b.searchIdealRunCleared : false, secondsTaken: r.secondsTaken,
  });
}
for (const place of places) {
  const dir = `${root}/scan/${place}-s${Math.round(SCAN * 100)}`;
  const r = read(`${dir}/result.json`);
  if (!r) continue;
  const c = read(`${dir}/course.json`);
  const b = r.bestLane as Record<string, unknown> | undefined;
  rows.push({
    place, variant: `fixed ${SCAN}`, terrain: r.terrain, reliefM: r.terrainRelief_m, buildings: r.buildings, medianHeightM: r.medianHeight_m,
    shrink: r.shrink, ladderTries: 1, lanesFound: r.lanesFound ?? 0, laneLengthM: b ? Math.round((b.length as number) * 10) / 10 : null,
    gaps: b?.gaps ?? null, steps: b?.steps ?? null, levelM: b?.levelM ?? null, tallestDropM: c ? tallestDrop(c.terrain.platforms) : null,
    idealRunCleared: b ? b.searchIdealRunCleared : false, secondsTaken: r.secondsTaken,
  });
}
writeFileSync(`${root}/summary.json`, JSON.stringify({ experiment: 'cc-56-reassess', rows }, null, 2) + '\n');

const f = (x: unknown) => (x === null || x === undefined ? '-' : String(x));
console.log('| place | variant | shrink | tries | lanes | lane m | tallest drop m | ideal run | seconds |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.place} | ${r.variant} | ${f(r.shrink)} | ${f(r.ladderTries)} | ${f(r.lanesFound)} | ${f(r.laneLengthM)} | ${f(r.tallestDropM)} | ${r.idealRunCleared ? 'clears' : 'no lane'} | ${f(r.secondsTaken)} |`);
