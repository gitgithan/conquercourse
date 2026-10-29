// CC-193: how close are the hands to the bar when the first grab happens? Sweeps the take-off point of a full-speed jump for a few bar heights and grab reaches.
// Usage: npx tsx scripts/reach-sweep.ts   (a flat deck, two bars 3.5 m apart as on the Training course)
import { DEFAULT_HANG } from '../src/sim/holds';
import { playPlan } from '../src/sim/ideal';
import type { CourseData } from '../src/course/course';
const course = (y: number) => ({ version: 1, name: 'sweep', startX: 100, finishX: 150, jumpSpeed: 4.5, jumpKeep: 0.88, terrain: { waterY: -6, platforms: [{ x0: -10, x1: 131, top: 0 }, { x0: 143, x1: 160, top: -2 }] }, holds: [{ x: 134, y }, { x: 137.5, y }], hazard: 'lava' }) as unknown as CourseData;
const rows: string[] = [];
for (const y of [3.4, 3.3, 3.2, 3.1, 3.0]) for (const reach of [0.35, 0.25, 0.15, 0.1]) {
  DEFAULT_HANG.reach = reach;
  const c = course(y);
  let best: { x: number; d: number; ox: number; oy: number } | null = null, n = 0;
  for (let x = 118; x <= 132; x += 0.05) {
    let d = 9, ox = 0, oy = 0;
    const r = playPlan(c, { jumpXs: [x], releaseAfter: 0, bouncePress: 0, hands: true, airHands: [true], hangTicks: [200] } as never, 120 * 40, (w) => { if (w.mode === 'hang' && w.hang && w.hang.et === 8 && d === 9) { ox = w.hang.ox!; oy = w.hang.oy!; d = Math.hypot(ox, oy); } });
    if (d < 9 && r.events.some((e) => e.type === 'hang-catch')) { n++; if (!best || d < best.d) best = { x, d, ox, oy }; }
  }
  rows.push(`bar y ${y.toFixed(1)} reach ${reach}: ${n} catching take-offs (of 280)${best ? `, closest grab ${best.d.toFixed(3)} m at x ${best.x.toFixed(2)}` : ''}`);
}
console.log(rows.join('\n'));
