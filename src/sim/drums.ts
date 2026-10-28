import type { CourseData } from '../course/course';
import { DEFAULT_LANDING, safeDrop } from './landing';
import { GRAVITY } from './units';
import { inputFor, searchIdealRun, type Plan } from './ideal';
import { newWorld, stepWorld } from './world';

// The drum lane: where along the course the ideal run presses Space, so a player can see where to jump on any course,
// including one built in the editor. It shows the line; it never grades the player's own presses.
export interface Drum {
  x: number; // m along the course at the moment of the press
  what: 'jump' | 'let go' | 'bounce' | 'vault' | 'grab' | 'release' | 'roll' | 'fire';
}

// The roll drum's place: this many ticks (0.3 s at 120 Hz) before touchdown.
export const ROLL_DRUM_TICKS = 36;

export function drumsFor(course: CourseData, plan: Plan = course.plan ?? searchIdealRun(course).plan, maxTicks = 120 * 80): Drum[] {
  let w = newWorld(course);
  const st = { next: 0, caught: null as number | null, bedAt: null as number | null };
  const drums: Drum[] = [];
  let was = false, wasVault = false, wasFire = false, prevMode = w.mode;
  const xs: number[] = []; // the runner's x at the start of every tick, so the roll drum can sit on the path point a fixed time before the landing
  let airStart = 0; // the tick the runner last left the ground
  let still = 0;
  for (let i = 0; i < maxTicks && w.outcome === 'running'; i++) {
    const input = inputFor(plan, w, st, course);
    // a press is the first tick the jump input is on after being off (holding it is not a new drum)
    if (input.jump && !was) drums.push({ x: w.runner.x, what: w.mode === 'swing' ? 'let go' : w.mode === 'bounce' ? 'bounce' : 'jump' });
    was = input.jump;
    if (input.vault && !wasVault) drums.push({ x: w.runner.x, what: 'vault' });
    wasVault = !!input.vault;
    xs.push(w.runner.x);
    if (w.runner.grounded) airStart = i;
    if (input.fire && !wasFire) drums.push({ x: w.runner.x, what: 'fire' }); // K fires the launcher on a recoil pad
    wasFire = !!input.fire;
    w = stepWorld(w, input, course);
    // one X drum per landing that the roll is for: a fall that would stumble or hurt with straight legs and no roll, or one the line rolls out of.
    // The drum sits where the runner is ROLL_DRUM_TICKS before touchdown (the key buffer is a quarter of a second, so 0.3 s before is early enough and not too early).
    const land = w.events.find((e) => e.type === 'land');
    if (land && (land.detail?.rolled || ((land.detail?.impact as number) ** 2) / (2 * GRAVITY) > safeDrop('stiff', DEFAULT_LANDING).clean)) {
      const at = Math.max(airStart, i - ROLL_DRUM_TICKS);
      drums.push({ x: xs[at], what: 'roll' });
    }
    if (prevMode !== 'hang' && w.mode === 'hang') drums.push({ x: w.runner.x, what: 'grab' }); // E closes on the bar
    if (prevMode === 'hang' && w.mode !== 'hang') drums.push({ x: w.runner.x, what: 'release' }); // both hands let go
    prevMode = w.mode;
    still = w.mode === 'run' && w.runner.grounded && Math.abs(w.runner.vx) < 0.01 ? still + 1 : 0;
    if (still > 180) break;
  }
  return drums.sort((a, b) => a.x - b.x); // the roll drum is found at the landing but sits earlier on the path
}
