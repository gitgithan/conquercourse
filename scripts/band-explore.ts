// Usage: npx tsx scripts/band-explore.ts
// For a few stiffnesses: how far a full pull stretches the band, how fast the runner leaves the clip, and how fast it arrives at the edge.
import type { CourseData } from '../src/course/course';
import { NO_INPUT } from '../src/sim/runner';
import { newWorld, stepWorld } from '../src/sim/world';
import { reachableStretch, bandParams, stretchAt } from '../src/sim/band';

export const bandCourse = (band: Partial<import('../src/sim/band').BandParams> = {}, edge = 1.5, gap = 11): CourseData => ({
  version: 1, name: 'band', startX: -1, finishX: edge + gap + 6, jumpSpeed: 4.5,
  terrain: { waterY: -1.5, platforms: [{ x0: -80, x1: edge, top: 0 }, { x0: edge + gap, x1: edge + gap + 12, top: 0 }] },
  band: { x: 0, ...band },
});

export function pullAndGo(course: CourseData, turnAt: number, maxSeconds = 60) {
  let w = newWorld(course);
  const p = bandParams(course);
  let turned = false, maxStretch = 0, release: { vx: number; t: number; stretch: number } | null = null, edgeV = 0;
  for (let i = 0; i < 120 * maxSeconds && w.outcome === 'running'; i++) {
    const s = stretchAt(p, w.runner.x);
    maxStretch = Math.max(maxStretch, s);
    if (!turned && s >= turnAt) turned = true;
    const input = w.mode === 'band' ? { ...NO_INPUT, left: !turned, run: turned } : { ...NO_INPUT, run: true };
    w = stepWorld(w, input, course);
    const rel = w.events.find((e) => e.type === 'band-release');
    if (rel) release = { vx: rel.detail!.vx as number, t: w.runner.tick / 120, stretch: rel.detail!.stretch as number };
    if (w.events.some((e) => e.type === 'band-snap')) return { snapped: true, maxStretch, release, edgeV: 0 };
    if (release && w.runner.x >= course.terrain.platforms[0].x1 - 0.2) { edgeV = w.runner.vx; break; }
  }
  return { snapped: false, maxStretch, release, edgeV };
}

if (process.argv[1]?.endsWith('band-explore.ts')) {
  console.log('k    reach  turn  maxStretch  releaseV  edgeV  range(after jump)');
  for (const k of [1500, 300, 150, 90, 60, 45, 35, 28]) {
    const c = bandCourse({ k, snap: 40 });
    const reach = reachableStretch(bandParams(c));
    const turn = Math.min(reach * 0.85, 39);
    const r = pullAndGo(c, turn);
    const range = r.edgeV * (2 * 4.5 / 9.81);
    console.log(String(k).padEnd(5), reach.toFixed(1).padEnd(6), turn.toFixed(1).padEnd(5), r.maxStretch.toFixed(1).padEnd(11), (r.release?.vx ?? 0).toFixed(1).padEnd(9), r.edgeV.toFixed(1).padEnd(6), range.toFixed(1));
  }
}
