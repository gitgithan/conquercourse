// Usage: npx tsx scripts/ways-numbers.ts   The numbers behind docs/multi-path.md (CC-224): the time of each way and how often a person with shaky timing clears it.
// The "person" is a bot: every press x and every hang time gets a random error (sigma in ms of game time, the same noise as playImperfect, which leaves out vaults, climbs and hangs). It is a model, not a person.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import { routeCourse, routeOfTrack } from '../src/sim/branches';
import { playPlan, searchIdealRun, type Plan } from '../src/sim/ideal';
import { DT } from '../src/sim/units';
import { trackFromPlan } from '../src/sim/replay';

const course = JSON.parse(readFileSync('public/assets/demo/two-ways.course.json', 'utf8')) as CourseData;
const b = course.branches![0];
const gauss = (rnd: () => number) => Math.sqrt(-2 * Math.log(Math.max(rnd(), 1e-12))) * Math.cos(2 * Math.PI * rnd());
function noisy(plan: Plan, seed: number, sigmaMs: number): Plan {
  let st = seed >>> 0 || 1;
  const rnd = () => { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; return st / 2 ** 32; };
  const sx = (sigmaMs / 1000) * 7.4, sT = sigmaMs / (DT * 1000);
  const shift = (a?: number[]) => a?.map((x) => x + gauss(rnd) * sx);
  return { ...plan, jumpXs: shift(plan.jumpXs)!, vaultXs: shift(plan.vaultXs), climbXs: shift(plan.climbXs), hangTicks: plan.hangTicks?.map((t) => Math.max(0, Math.round(t + gauss(rnd) * sT))), releaseAfter: Math.max(0, Math.round(plan.releaseAfter + gauss(rnd) * sT)) };
}
const lines: { name: string; plan: Plan; way: string }[] = [];
for (const r of b.routes) {
  lines.push({ name: `${r.id} (fastest line)`, plan: r.plan!, way: r.id });
  if (r.lines && r.lines.length > 1) { // the safer line of the way: found by a plain search (bar to bar)
    const plain = searchIdealRun(routeCourse(course, b.id, r.id));
    if (plain.cleared) lines.push({ name: `${r.id} (${r.lines.find((l) => l.name.startsWith('bar'))?.name ?? 'plain search'})`, plan: plain.plan, way: r.id });
  }
}
const out: unknown[] = [];
for (const l of lines) {
  const ideal = playPlan(course, l.plan).world.runner.tick;
  const row: Record<string, unknown> = { line: l.name, idealSeconds: +(ideal / 120).toFixed(2) };
  for (const sigma of [15, 30, 60, 100]) {
    let ok = 0, wrongWay = 0, tot = 0; const N = 300;
    for (let s = 1; s <= N; s++) {
      const pl = noisy(l.plan, s * 7919, sigma);
      const r = playPlan(course, pl);
      const cleared = r.world.outcome === 'cleared';
      tot += r.world.runner.tick / 120 + (cleared ? 0 : 1);
      if (cleared) { ok++; const t = trackFromPlan(course, pl); if (routeOfTrack(b, t.xs, t.ys)?.id !== l.way) wrongWay++; }
    }
    row[`sigma${sigma}`] = { clearShare: +(ok / N).toFixed(2), wrongWayOfClears: wrongWay, secondsToClear: ok ? +(tot / ok).toFixed(1) : null };
  }
  out.push(row); console.log(JSON.stringify(row));
}
mkdirSync('data/eval/two-ways', { recursive: true });
writeFileSync('data/eval/two-ways/run.json', JSON.stringify({ course: 'two-ways.course.json', date: '2026-10-30', method: 'noisy presses, 300 seeds per sigma, clear share per attempt; seconds to clear = mean attempt time (+1 s per fall) / clear share', rows: out }, null, 2) + '\n');
