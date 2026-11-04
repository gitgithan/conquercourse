// Investigation only: identical course and plans differing solely in the last jump threshold.
// Full world, controller and loop bookkeeping are cloned at the first possible divergent input.
import type { CourseData } from '../src/course/course';
import { inputFor, type Plan } from '../src/sim/ideal';
import { newWorld, stepWorld, type GameEvent } from '../src/sim/world';

export function prefixTrials(course: CourseData, plans: Plan[], maxTicks = 9600) {
  if (!plans.length || !plans[0].jumpXs.length) throw new Error('Needs final-jump variants');
  const last = plans[0].jumpXs.length - 1;
  const signature = (p: Plan) => JSON.stringify({ ...p, jumpXs: p.jumpXs.slice(0, -1) });
  if (plans.some((p) => p.jumpXs.length !== last + 1 || signature(p) !== signature(plans[0]))) throw new Error('Plans differ before final jump');
  const threshold = Math.min(...plans.map((p) => p.jumpXs[last]));
  const initial = () => ({ w: newWorld(course), st: { next: 0, caught: null as number | null, bedAt: null as number | null, hangAt: null as number | null, hangs: 0, vnext: 0, cnext: 0, inClimb: false, fnext: 0, airSince: null as number | null, bandTurned: false, barsAt: null as number | null, barsOk: 0, barsDoneAt: null as number | null, barsLast: -99, barsOff: false }, events: [] as GameEvent[], maxX: 0, still: 0, spent: 0, ended: false });
  type Snapshot = ReturnType<typeof initial>;
  function step(s: Snapshot, plan: Plan) {
    s.spent++;
    s.w = stepWorld(s.w, inputFor(plan, s.w, s.st, course), course);
    s.events.push(...s.w.events);
    if (!Number.isFinite(s.w.runner.x)) { s.ended = true; return; }
    s.maxX = Math.max(s.maxX, s.w.runner.x);
    s.still = s.w.mode === 'run' && s.w.runner.grounded && Math.abs(s.w.runner.vx) < 0.01 && s.w.runner.tick >= (plan.startDelay ?? 0) ? s.still + 1 : 0;
    if (s.still > 180) s.ended = true;
  }
  const prefix = initial();
  while (prefix.spent < maxTicks && prefix.w.outcome === 'running' && !prefix.ended) {
    if (prefix.st.next === last && prefix.w.runner.grounded && prefix.w.runner.x >= threshold) break;
    step(prefix, plans[0]);
  }
  let ticks = prefix.spent;
  const runs = plans.map((plan) => {
    const s = structuredClone(prefix);
    while (s.spent < maxTicks && s.w.outcome === 'running' && !s.ended) step(s, plan);
    ticks += s.spent - prefix.spent;
    return { world: s.w, events: s.events, maxX: s.maxX, jumps: s.st.next };
  });
  return { runs, ticks, sharedTicks: prefix.spent };
}
