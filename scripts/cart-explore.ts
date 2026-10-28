import { newWorld, stepWorld } from '../src/sim/world';
import { NO_INPUT } from '../src/sim/runner';
import type { CourseData } from '../src/course/course';
import { searchIdealRun, playPlan } from '../src/sim/ideal';
import { makeRails, crestSpeedLimit } from '../src/sim/cart';

const mk = (pts: [number, number][], push = 1.5): CourseData => ({
  version: 1, name: 't', startX: pts[0][0], finishX: pts[pts.length - 1][0], jumpSpeed: 4.5,
  terrain: { platforms: [{ x0: pts[pts.length - 1][0], x1: pts[pts.length - 1][0] + 20, top: pts[pts.length - 1][1] }], waterY: -3 },
  track: { pts, push },
});
const run = (c: CourseData) => {
  let w = newWorld(c); let leftAt = 0, maxV = 0;
  for (let i = 0; i < 120 * 60 && w.outcome === 'running'; i++) { w = stepWorld(w, { ...NO_INPUT, run: i === 0 }, c); maxV = Math.max(maxV, Math.abs(w.cart?.v ?? 0)); }
  return { outcome: w.outcome, ev: w.events.map((e) => e.type).join(), x: +w.runner.x.toFixed(1), maxV: +maxV.toFixed(1) };
};
const cases: Record<string, [number, number][]> = {
  gentle: [[0, 8], [8, 1], [16, 1.5], [24, 4.5], [32, 1], [44, 0.5]],
  sharpCrest: [[0, 8], [6, 1], [10, 1.5], [12, 5.5], [14, 1.2], [24, 0]],
  tooHigh: [[0, 5], [8, 1], [18, 7], [28, 1]],
  demo: [[0, 9], [6, 5], [12, 1], [20, 0.6], [28, 4], [34, 2.5], [42, 0.5], [50, 0.2]],
};
for (const [n, pts] of Object.entries(cases)) {
  const r = makeRails(pts);
  let lim = Infinity; for (let x = pts[0][0]; x < pts[pts.length - 1][0]; x += 0.25) lim = Math.min(lim, crestSpeedLimit(r, x));
  const c = mk(pts);
  const s = searchIdealRun(c);
  console.log(n, run(c), 'minCrestLimit', +lim.toFixed(1), 'ideal', s.cleared, JSON.stringify(s.plan.cartBrake));
}
