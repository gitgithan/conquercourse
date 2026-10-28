import type { CourseData } from '../course/course';
import { NO_INPUT } from './runner';
import { landing } from './landing';
import { platformAt } from './terrain';
import { stepWorld, type WorldState } from './world';
import { JUMPABLE_STEP } from './needs-limits';

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
export function predictRelease(w: WorldState, course: CourseData, maxTicks = 360): Prediction {
  if (w.mode !== 'hang' || w.outcome !== 'running') return { path: [], result: 'other-move', why: 'Not on a bar.' };
  const path = [{ x: w.runner.x, y: w.runner.y }];
  let s = stepWorld(w, { ...NO_INPUT }, course); // both hands off: let go
  path.push({ x: s.runner.x, y: s.runner.y });
  let left = false;
  for (let i = 0; i < maxTicks; i++) {
    s = stepWorld(s, { ...NO_INPUT, run: true, squat: true, handR: true }, course);
    path.push({ x: s.runner.x, y: s.runner.y });
    if (s.mode === 'hang') return { path, result: 'lands', landX: s.runner.x, why: 'You reach the next bar: hold E in the air to grab it.' };
    if (s.outcome === 'splash') return { path, result: 'splash', landX: s.runner.x, why: 'You fall in the water: wait for a bigger swing.' };
    if (!s.runner.grounded) left = true;
    if (left && s.runner.grounded) {
      if (s.runner.x < w.runner.x + 0.5) return { path, result: 'blocked', landX: s.runner.x, why: 'You would land back on the near side.' };
      return { path, result: 'lands', landX: s.runner.x, why: `You land on the ground at ${s.runner.x.toFixed(1)} m.` };
    }
  }
  return { path, result: 'lands', why: 'Still in the air at the end of the preview.' };
}
