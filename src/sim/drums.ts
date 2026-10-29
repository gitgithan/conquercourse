import type { CourseData } from '../course/course';
import { rollWindowOpen } from './drop';
import { DEFAULT_LANDING, safeDrop } from './landing';
import { GRAVITY } from './units';
import { inputFor, searchIdealRun, type Plan } from './ideal';
import { newWorld, stepWorld, WALL_HOLD_TICKS } from './world';

// The drum lane: where along the course the ideal run presses Space, so a player can see where to jump on any course,
// including one built in the editor. It shows the line; it never grades the player's own presses.
export interface Drum {
  x: number; // m along the course at the moment of the press
  note?: string; // a few words on the drum (the aim of a cannon)
  what: 'jump' | 'let go' | 'bounce' | 'vault' | 'grab' | 'release' | 'roll' | 'fire' | 'aim' | 'turn' | 'board';
}

export function drumsFor(course: CourseData, plan: Plan = course.plan ?? searchIdealRun(course).plan, maxTicks = 120 * 80): Drum[] {
  let w = newWorld(course);
  const st = { next: 0, caught: null as number | null, bedAt: null as number | null };
  const drums: Drum[] = [];
  let was = false, wasVault = false, wasFire = false, wasAim = false, wasTurn = false, prevMode = w.mode;
  let windowX: number | null = null; // where the runner was when the roll window opened in this flight
  let still = 0, wallDrum = false;
  for (let i = 0; i < maxTicks && w.outcome === 'running'; i++) {
    const input = inputFor(plan, w, st, course);
    // a press is the first tick the jump input is on after being off (holding it is not a new drum)
    if (input.jump && !was) drums.push({ x: w.runner.x, what: w.mode === 'swing' ? 'let go' : w.mode === 'bounce' ? 'bounce' : 'jump' });
    was = input.jump;
    if (input.vault && !wasVault) drums.push({ x: w.runner.x, what: 'vault' });
    wasVault = !!input.vault;
    if (w.runner.grounded) windowX = null;
    else if (windowX === null && w.mode === 'run' && rollWindowOpen(w, course)) windowX = w.runner.x; // the same window the simulator uses: the last 0.15 s and 1.2 m
    if (input.fire && !wasFire) drums.push({ x: w.runner.x, what: 'fire' }); // K fires the launcher on a recoil pad
    wasFire = !!input.fire;
    if (input.aim !== undefined && !wasAim) drums.push({ x: w.runner.x, what: 'aim', note: `${Math.round((input.aim * 180) / Math.PI)}°` }); // tilt the barrel (Up and Down), then K
    wasAim = input.aim !== undefined;
    // the elastic band: the moment the line stops pulling away from the post and turns round toward it (the band then throws the runner)
    const turning = w.mode === 'band' && !!input.run && !input.left;
    if (turning && !wasTurn) drums.push({ x: w.runner.x, what: 'turn' });
    wasTurn = turning;
    w = stepWorld(w, input, course);
    // one X drum per landing that the roll is for: a fall that would stumble or hurt with straight legs and no roll, or one the line rolls out of.
    // The drum sits where the roll window opens (the key is due there: a press earlier does nothing), not at the landing.
    const land = w.events.find((e) => e.type === 'land');
    if (land && (land.detail?.rolled || ((land.detail?.impact as number) ** 2) / (2 * GRAVITY) > safeDrop('stiff', DEFAULT_LANDING).clean)) {
      drums.push({ x: windowX ?? w.runner.x, what: 'roll' });
    }
    // the warped wall: E is due in the last moment of the climb (CC-182), so the drum sits there, near the top, not at the foot
    if (w.mode !== 'wall') wallDrum = false;
    else if (!wallDrum && w.wall && w.wall.result.grabTick !== null && w.wall.index >= w.wall.result.grabTick - WALL_HOLD_TICKS) { wallDrum = true; drums.push({ x: w.runner.x, what: 'grab' }); }
    if (prevMode !== 'swing' && w.mode === 'swing') drums.push({ x: w.runner.x, what: 'grab' }); // E closes on the rope
    if (prevMode !== 'hang' && w.mode === 'hang') drums.push({ x: w.runner.x, what: 'grab' }); // E closes on the bar
    if (prevMode !== 'climb' && w.mode === 'climb') drums.push({ x: w.runner.x, what: 'grab' }); // E closes on a wall's edge
    if (prevMode === 'hang' && w.mode !== 'hang') drums.push({ x: w.runner.x, what: 'release' }); // both hands let go
    if (prevMode !== 'drone' && w.mode === 'drone') drums.push({ x: w.runner.x, what: 'board' }); // hold E on the pad
    prevMode = w.mode;
    still = w.mode === 'run' && w.runner.grounded && Math.abs(w.runner.vx) < 0.01 ? still + 1 : 0;
    if (still > 180) break;
  }
  return drums.sort((a, b) => a.x - b.x); // the roll drum is found at the landing but sits earlier on the path
}
