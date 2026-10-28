// Usage: npx tsx scripts/vault-measure.ts [out.json]
// Measures the vault for a few speeds and step heights: how far from the front face the vault starts (takeoff distance), where the feet come down past the edge,
// the speed after, and how far the runner slides on the step top with no key held and with run held.
import { writeFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import { NO_INPUT } from '../src/sim/runner';
import { newWorld, stepWorld } from '../src/sim/world';

const EDGE = 40;
const course = (h: number): CourseData => ({
  version: 1, name: 'vault', startX: 0, finishX: 80, jumpSpeed: 4.5,
  terrain: { waterY: -1.5, platforms: [{ x0: -10, x1: EDGE, top: 0 }, { x0: EDGE, x1: 90, top: h }] },
  jumpKeep: 0.88,
});

export interface Row { speed: number; rise: number; takeoffGap: number | null; landPastEdge: number | null; ticks: number | null; vxAfter: number | null; peakAboveTop: number | null; slideNoKeys: number | null; stopTicks: number | null; runHeld60: number | null }

export function measure(speed: number, rise: number, pressGap: number): Row {
  const c = course(rise);
  let w = newWorld(c, EDGE - 8);
  w = { ...w, runner: { ...w.runner, vx: speed } };
  let takeoffGap: number | null = null, startTick = 0, peak = 0;
  for (let i = 0; i < 120 * 4; i++) {
    const gap = EDGE - w.runner.x;
    const go = w.mode === 'run' && w.runner.grounded && gap <= pressGap;
    const was = w.mode;
    w = stepWorld(w, { ...NO_INPUT, run: true, vault: go }, c);
    if (was === 'run' && w.mode === 'vault') { takeoffGap = EDGE - w.runner.x; startTick = w.runner.tick; }
    if (w.mode === 'vault') peak = Math.max(peak, w.runner.y - rise);
    if (takeoffGap !== null && w.mode === 'run' && w.runner.grounded) break;
  }
  if (takeoffGap === null || w.mode !== 'run') return { speed, rise, takeoffGap, landPastEdge: null, ticks: null, vxAfter: null, peakAboveTop: null, slideNoKeys: null, stopTicks: null, runHeld60: null };
  const landed = { ...w };
  const base = { speed, rise, takeoffGap, landPastEdge: landed.runner.x - EDGE, ticks: landed.runner.tick - startTick, vxAfter: landed.runner.vx, peakAboveTop: peak };
  let a = landed, stop: number | null = null;
  for (let i = 0; i < 120 * 3; i++) { a = stepWorld(a, NO_INPUT, c); if (stop === null && Math.abs(a.runner.vx) < 0.05) { stop = i + 1; } }
  let b = landed;
  for (let i = 0; i < 60; i++) b = stepWorld(b, { ...NO_INPUT, run: true }, c);
  return { ...base, slideNoKeys: a.runner.x - landed.runner.x, stopTicks: stop, runHeld60: b.runner.x - landed.runner.x };
}

if (process.argv[1]?.endsWith('vault-measure.ts')) {
  const rows: Row[] = [];
  for (const speed of [4, 6, 8]) for (const rise of [0.4, 0.8, 1.2]) for (const pressGap of [4, 2, 1, 0.4]) rows.push(measure(speed, rise, pressGap));
  console.table(rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 100) / 100 : v]))));
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(rows, null, 2) + '\n');
}
