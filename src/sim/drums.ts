import type { CourseData } from '../course/course';
import { inputFor, searchIdealRun, type Plan } from './ideal';
import { newWorld, stepWorld } from './world';

// The drum lane: where along the course the ideal run presses Space, so a player can see where to jump on any course,
// including one built in the editor. It shows the line; it never grades the player's own presses.
export interface Drum {
  x: number; // m along the course at the moment of the press
  what: 'jump' | 'let go' | 'bounce' | 'vault' | 'grab' | 'release';
}

export function drumsFor(course: CourseData, plan: Plan = searchIdealRun(course).plan, maxTicks = 120 * 80): Drum[] {
  let w = newWorld(course);
  const st = { next: 0, caught: null as number | null, bedAt: null as number | null };
  const drums: Drum[] = [];
  let was = false, wasVault = false, prevMode = w.mode;
  let still = 0;
  for (let i = 0; i < maxTicks && w.outcome === 'running'; i++) {
    const input = inputFor(plan, w, st);
    // a press is the first tick the jump input is on after being off (holding it is not a new drum)
    if (input.jump && !was) drums.push({ x: w.runner.x, what: w.mode === 'swing' ? 'let go' : w.mode === 'bounce' ? 'bounce' : 'jump' });
    was = input.jump;
    if (input.vault && !wasVault) drums.push({ x: w.runner.x, what: 'vault' });
    wasVault = !!input.vault;
    w = stepWorld(w, input, course);
    if (prevMode !== 'hang' && w.mode === 'hang') drums.push({ x: w.runner.x, what: 'grab' }); // Q or E closes on the bar
    if (prevMode === 'hang' && w.mode !== 'hang') drums.push({ x: w.runner.x, what: 'release' }); // both hands let go
    prevMode = w.mode;
    still = w.mode === 'run' && w.runner.grounded && Math.abs(w.runner.vx) < 0.01 ? still + 1 : 0;
    if (still > 180) break;
  }
  return drums;
}
