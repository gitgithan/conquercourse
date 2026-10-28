import type { CourseData } from '../course/course';
import { NO_INPUT } from './runner';
import { landing } from './landing';
import { platformAt } from './terrain';
import { stepWorld, type WorldState } from './world';
import { JUMPABLE_STEP } from './needs-limits';
import { crestSpeedLimit, railsOf } from './cart';

// "If I jump now, what happens?": the simulator's own physics run forward from the current state with Space pressed
// and the run key held. The debug view draws the path and says why the jump works or does not. Nothing here is a second model.
export interface Prediction {
  path: { x: number; y: number }[];
  result: 'lands' | 'splash' | 'hurt' | 'blocked' | 'not-grounded' | 'other-move';
  landX?: number;
  why: string; // plain words
}
export function predictJump(w: WorldState, course: CourseData, maxTicks = 240): Prediction {
  if (w.outcome !== 'running') return { path: [], result: 'other-move', why: 'The run is over: press R to try again.' };
  if (w.mode !== 'run') return { path: [], result: 'other-move', why: w.mode === 'swing' ? 'On the rope: Space lets go.' : w.mode === 'bounce' ? 'On the trampoline: Space pumps the bounce.' : w.mode === 'hang' ? 'On a bar: let go of Q and E to fly; push the arrows to build the swing.' : w.mode === 'vault' ? 'Going over the step with a hand on top.' : 'On the wall: the move plays itself.' };
  const path = [{ x: w.runner.x, y: w.runner.y }];
  let s = w;
  let left = !w.runner.grounded;
  const startGrounded = w.runner.grounded;
  let still = 0;
  for (let i = 0; i < maxTicks; i++) {
    s = stepWorld(s, { ...NO_INPUT, run: true, squat: true, jump: i === 0 && startGrounded }, course);
    path.push({ x: s.runner.x, y: s.runner.y });
    if (s.outcome === 'splash') {
      const ahead = course.terrain.platforms.filter((p) => p.x0 > s.runner.x - 0.5).sort((a, b) => a.x0 - b.x0)[0];
      return { path, result: 'splash', landX: s.runner.x, why: ahead && ahead.x0 > s.runner.x ? `Falls in the water ${(ahead.x0 - s.runner.x).toFixed(1)} m before the next ground. Jump later, or run faster.` : 'Falls in the water: there is no ground left to land on.' };
    }
    if (!s.runner.grounded) left = true;
    if (s.outcome === 'hurt') return { path, result: 'hurt', landX: s.runner.x, why: `Hard landing: ${((s.events.find((e) => e.type === 'hard-landing')?.detail?.impact as number) ?? 0).toFixed(1)} m/s into the ground is too much even with bent knees. Tap X just before you land to roll it out.` };
    if (left && s.runner.grounded) {
      const p = platformAt(course.terrain, s.runner.x);
      const margin = p ? Math.min(s.runner.x - p.x0, p.x1 - s.runner.x) : 0;
      const impact = s.events.find((e) => e.type === 'land')?.detail?.impact as number | undefined;
      const hit = impact !== undefined && impact > 6 ? ` You hit the ground at ${impact.toFixed(1)} m/s: ${landing(impact, true).stumbled ? 'a stumble that costs speed (tap X just before you land to roll)' : 'a clean landing'}.` : '';
      return { path, result: 'lands', landX: s.runner.x, why: `Lands at ${s.runner.x.toFixed(1)} m, ${margin.toFixed(1)} m from the edge of the ground${margin < 0.3 ? ' (close: a little less speed and it would miss)' : ''}.${hit}` };
    }
    still = Math.abs(s.runner.vx) < 0.05 ? still + 1 : 0;
    if (s.runner.grounded && still > 30) {
      const next = course.terrain.platforms.filter((p) => p.x0 >= s.runner.x - 0.3).sort((a, b) => a.x0 - b.x0)[0];
      const ground = platformAt(course.terrain, s.runner.x)?.top ?? 0;
      const rise = next ? next.top - ground : 0;
      return { path, result: 'blocked', why: rise > JUMPABLE_STEP ? `The step ahead is ${rise.toFixed(1)} m high. One jump lifts about ${JUMPABLE_STEP} m, so this one needs a different move.` : 'The runner is stopped against something: it is in the way.' };
    }
  }
  return { path, result: 'lands', why: 'Still running at the end of the preview.' };
}


// "If I let go of the bar now, what happens?": the same physics run on with both hands off, then the right hand held so the next bar is grabbed if it is in reach.
// When a flight with the hand kept off would clear the next bar and land beyond it, that is said too, as a fact (a skip), never as a grade.
const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
export const barName = (i: number): string => `${ORDINAL[i] ?? `no. ${i + 1}`} bar`;

function releaseFlight(w: WorldState, course: CourseData, hand: boolean, maxTicks: number): Prediction {
  const path = [{ x: w.runner.x, y: w.runner.y }];
  let s = stepWorld(w, { ...NO_INPUT }, course); // both hands off: let go
  path.push({ x: s.runner.x, y: s.runner.y });
  let left = false;
  for (let i = 0; i < maxTicks; i++) {
    s = stepWorld(s, { ...NO_INPUT, run: true, squat: true, handR: hand }, course);
    path.push({ x: s.runner.x, y: s.runner.y });
    if (s.mode === 'hang') return { path, result: 'lands', landX: s.runner.x, why: `You reach the ${barName(s.hang!.hold)}: hold E in the air to grab it.` };
    if (s.outcome === 'splash') return { path, result: 'splash', landX: s.runner.x, why: 'You fall in the water: wait for a bigger swing.' };
    if (!s.runner.grounded) left = true;
    if (left && s.runner.grounded) {
      if (s.runner.x < w.runner.x + 0.5) return { path, result: 'blocked', landX: s.runner.x, why: 'You would land back on the near side.' };
      const passed = (course.holds ?? []).map((h, k) => ({ h, k })).filter(({ h, k }) => k !== w.hang!.hold && h.x > w.runner.x + 0.5 && h.x < s.runner.x - 0.3);
      const skip = passed.length ? ` You fly over the ${passed.map(({ k }) => barName(k)).join(' and the ')}: it is skipped.` : '';
      return { path, result: 'lands', landX: s.runner.x, why: `You land on the ground at ${s.runner.x.toFixed(1)} m.${skip}` };
    }
  }
  return { path, result: 'lands', why: 'Still in the air at the end of the preview.' };
}

export function predictRelease(w: WorldState, course: CourseData, maxTicks = 360): Prediction {
  if (w.mode !== 'hang' || w.outcome !== 'running') return { path: [], result: 'other-move', why: 'Not on a bar.' };
  const withHand = releaseFlight(w, course, true, maxTicks);
  if (withHand.why.startsWith('You reach the')) { // the next bar is in reach: is there a second way, over it?
    const over = releaseFlight(w, course, false, maxTicks);
    if (over.result === 'lands' && over.why.includes('skipped')) return { ...withHand, why: `${withHand.why} Or keep your hand off it: ${over.why.charAt(0).toLowerCase() + over.why.slice(1)}` };
  }
  return withHand;
}


// "If I let the rider go now, what happens?": in the trebuchet, the same physics run on with Space pressed this tick, then the right hand held so a bar in reach is grabbed.
export function predictLaunch(w: WorldState, course: CourseData, maxTicks = 600): Prediction {
  if (w.mode !== 'launch' || w.outcome !== 'running') return { path: [], result: 'other-move', why: 'Not in the trebuchet.' };
  if (!w.launch!.fired) return { path: [], result: 'other-move', why: 'Hold → to pull the pin. Then press Space to let the rider go.' };
  const path = [{ x: w.runner.x, y: w.runner.y }];
  let s = stepWorld(w, { ...NO_INPUT, run: true, jump: true }, course);
  path.push({ x: s.runner.x, y: s.runner.y });
  if (s.mode === 'launch') return { path, result: 'other-move', why: 'The arm has not turned far enough to let go yet.' };
  let left = false;
  for (let i = 0; i < maxTicks; i++) {
    s = stepWorld(s, { ...NO_INPUT, run: true, squat: true, handR: true }, course);
    path.push({ x: s.runner.x, y: s.runner.y });
    if (s.mode === 'hang') return { path, result: 'lands', landX: s.runner.x, why: 'You reach the bar: hold E in the air to grab it.' };
    if (s.outcome === 'splash') return { path, result: 'splash', landX: s.runner.x, why: 'You come down in the water, short of the ground.' };
    if (s.outcome === 'hurt') return { path, result: 'hurt', landX: s.runner.x, why: 'You come down too hard: tap X just before you land to roll it out.' };
    if (!s.runner.grounded) left = true;
    if (left && s.runner.grounded) return { path, result: 'lands', landX: s.runner.x, why: `You land at ${s.runner.x.toFixed(1)} m.` };
  }
  return { path, result: 'lands', why: 'Still in the air at the end of the preview.' };
}

// "If I let the cart roll from here, what happens?": the same cart physics run forward with no brake. Used by the debug view on a coaster.
export function predictCart(w: WorldState, course: CourseData, maxTicks = 120 * 60): Prediction {
  if (w.outcome !== 'running') return { path: [], result: 'other-move', why: 'The run is over: press R to try again.' };
  const path = [{ x: w.runner.x, y: w.runner.y }];
  let s = w, firstOff: { x: number; v: number; segment: number } | null = null, caught = false;
  for (let i = 0; i < maxTicks; i++) {
    s = stepWorld(s, { ...NO_INPUT, run: !s.cart?.started }, course);
    if (i % 4 === 0 || s.outcome !== 'running') path.push({ x: s.runner.x, y: s.runner.y });
    const off = s.events.find((e) => e.type === 'cart-off');
    if (off && !firstOff) firstOff = { x: off.detail!.x as number, v: off.detail!.v as number, segment: Number(off.detail!.segment ?? 0) };
    if (s.events.some((e) => e.type === 'cart-catch')) caught = true;
    if (s.events.some((e) => e.type === 'cart-stall')) {
      const st = s.events.find((e) => e.type === 'cart-stall')!;
      return { path, result: 'blocked', landX: st.detail!.x as number, why: `Runs out of speed on the hill at ${(st.detail!.x as number).toFixed(0)} m (${(st.detail!.height as number).toFixed(1)} m high). Make the first hill higher or that hill lower.` };
    }
    if (s.outcome === 'cleared') return { path, result: 'lands', landX: s.runner.x, why: caught ? 'Flies off one section, lands on the next, and reaches the finish.' : 'Rolls all the way to the finish.' };
    if (s.outcome === 'splash' && firstOff) {
      const rails = railsOf(course.track!, firstOff.segment), limit = crestSpeedLimit(rails, firstOff.x);
      return { path, result: 'splash', landX: s.runner.x, why: `Leaves the track at ${firstOff.x.toFixed(0)} m at ${firstOff.v.toFixed(1)} m/s but misses the next section. That crest lets go above ${limit.toFixed(1)} m/s.` };
    }
    if (s.outcome !== 'running') break;
  }
  return { path, result: 'other-move', why: s.cart?.started ? 'Rolling.' : 'Press → to push off.' };
}
