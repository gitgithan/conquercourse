// CC-168: the trampoline bounce on the Training course with E held (climbHands): how late the bounce press can be and still reach the high deck.
import { readFileSync } from 'node:fs';
import { playPlan } from '../src/sim/ideal';
const c = JSON.parse(readFileSync('public/assets/demo/training.course.json', 'utf8'));
const rows: Record<string, unknown>[] = [];
for (const bp of [0, 4, 8, 12, 14, 16, 18, 20, 24, 30, 40]) {
  let nearX = 0;
  const r = playPlan(c, { ...c.plan, airHands: [true], climbHands: true, bouncePress: bp }, 120 * 80, (w) => { if (w.runner.x > 133 && w.runner.x < 143.01 && !w.runner.grounded && w.mode === 'run') nearX = Math.max(nearX, w.runner.x); });
  rows.push({ bouncePress: bp, outcome: r.world.outcome, ticks: r.world.runner.tick, furthestXInAir: Number(nearX.toFixed(2)), climbs: r.events.filter((e) => e.type === 'climb').length });
}
console.log(JSON.stringify(rows));
