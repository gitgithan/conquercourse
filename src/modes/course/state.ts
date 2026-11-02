import type { InputLog } from '../../sim/replay';
import { clipLayoutFor, type ClipLayout } from '../../share/clip';
import type { Plan } from '../../sim/ideal';
import type { WorldState } from '../../sim/world';

// The state of one Course session that more than one part reads and writes: one object, read and changed by property, so no part needs a getter and a setter for each value (the same shape as the editor's state).
export interface CourseState {
  // the simulation
  world: WorldState;
  paused: boolean; // a run that was in progress waits for a key, so the player is not dropped into the middle of a jump
  last: number; // the clock of the last frame (ms)
  acc: number; // the time the simulator still owes (s)
  retryX: number; // "try this obstacle again" starts standing still just before it
  falls: number;
  replay: { i: number; from: number; to: number } | null; // i is a float: the replay runs at half speed
  // the keys
  keys: Set<string>;
  jumpQueued: boolean; vaultQueued: boolean; rollQueued: boolean; slideQueued: boolean; fireQueued: boolean;
  keysOpen: boolean; keysTouched: boolean; // the controls card: open, and touched by the player (a jump closes it only until then)
  frontOverride: boolean | null; // the front view inset: null follows the camera
  // the ideal run on screen
  plan: Plan | null;
  demo: { x1: number } | null;
  idealWhole: boolean;
  idealNote: string; // the line shown while an ideal run is working or playing
  lastZone: string; // the obstacle the runner last fell at (the retry, the Dojo link and the editor hand-off use it)
  // the clip being made (the game is stepped by hand and the clip's own camera is used) and the friend's keys watched over and over
  clip: { on: boolean; cam: { x: number; y: number } | null; layout: ClipLayout; hook: (() => void) | null }; // hook takes each picture of the clip
  phoneWatch: InputLog | null;
}

export interface CourseStateInit { world: WorldState; paused: boolean; retryX: number; falls: number; frontOverride: boolean | null; clipLayout?: ClipLayout }

export function createCourseState(init: CourseStateInit): CourseState {
  return {
    world: init.world, paused: init.paused, last: 0, acc: 0, retryX: init.retryX, falls: init.falls, replay: null,
    keys: new Set(), jumpQueued: false, vaultQueued: false, rollQueued: false, slideQueued: false, fireQueued: false,
    keysOpen: true, keysTouched: false, frontOverride: init.frontOverride,
    plan: null, demo: null, idealWhole: false, idealNote: '', lastZone: 'gap',
    clip: { on: false, cam: null, layout: init.clipLayout ?? clipLayoutFor(''), hook: null }, phoneWatch: null,
  };
}

// Every queued press is dropped: typing, a pause or a restart must not leave a jump waiting.
export function clearQueued(st: CourseState): void {
  st.jumpQueued = false; st.vaultQueued = false; st.rollQueued = false; st.slideQueued = false; st.fireQueued = false;
}
