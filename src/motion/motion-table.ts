// Motion table (CC-64): which clip each simulator state asks for, what the body does while there is no clip yet, and how long it lasts.
// The simulator is the master clock: a clip's progress is read from game ticks, never from a timer of its own.
// A move without a clip never shows a wrong motion: it shows its fallback pose, or, if it has none, it says so here.
import { DEFAULT_LANDING } from '../sim/landing';
import { TICKS_PER_SECOND } from '../sim/units';

export type MoveName = 'roll' | 'hurt' | 'vault' | 'hang' | 'giant-swing' | 'seated' | 'launch';

export interface MoveEntry {
  clip: string | null; // public/assets/motion/<clip>.json once it passes the gate and the move check (pipelines/moves.json); null = none yet
  fallback: 'tuck' | 'hands' | 'none'; // what is drawn while the clip is missing or switched off: 'none' keeps the old motion and is listed as a gap
  ticks: number | null; // how long the move lasts in game ticks, from the simulator's own numbers (null = as long as the state lasts)
  from: string; // the simulator state or event that starts it
}

// A roll lasts as long as the simulator says it takes to stop the fall (src/sim/landing.ts rollStopTime), plus 0.2 s to come up onto the feet.
export const ROLL_GET_UP_S = 0.2;
export const ROLL_TICKS = Math.round((DEFAULT_LANDING.rollStopTime + ROLL_GET_UP_S) * TICKS_PER_SECOND);

export const MOTION_TABLE: Record<MoveName, MoveEntry> = {
  roll: { clip: 'roll', fallback: 'tuck', ticks: ROLL_TICKS, from: "event 'land' with rolled (WorldState.rolledAt)" },
  hurt: { clip: null, fallback: 'none', ticks: null, from: "outcome 'hurt' (event 'hard-landing')" },
  vault: { clip: null, fallback: 'hands', ticks: null, from: "mode 'vault' (progress = WorldState.vault.i / n): built from the contact point, hands pinned on the step (src/motion/vault-pose.ts); the Kimodo clip is not used because it shows no hands on the top" },
  hang: { clip: 'swing', fallback: 'none', ticks: null, from: "mode 'hang' (the rope's swing pose, turned about the hands)" },
  'giant-swing': { clip: null, fallback: 'none', ticks: null, from: "mode 'hang' with the swing past horizontal (CC-58)" },
  seated: { clip: null, fallback: 'none', ticks: null, from: "mode 'cart' (CC-61)" },
  launch: { clip: null, fallback: 'none', ticks: null, from: "mode 'launch' (CC-62)" },
};

// How the roll is shown: 'auto' plays the clip when it loaded, 'clip' requires it, 'crouch' always shows the tuck (the blind A/B, ?roll=).
export type RollLook = 'auto' | 'clip' | 'crouch';
export const rollLookFrom = (search: string): RollLook => {
  const v = new URLSearchParams(search).get('roll');
  return v === 'clip' || v === 'crouch' ? v : 'auto';
};

// Progress through the move, 0 at touchdown and 1 when the simulator says it is over; null when it is not on.
export function moveProgress(entry: MoveEntry, startedAt: number, tick: number): number | null {
  if (entry.ticks === null) return null;
  const ago = tick - startedAt;
  return ago >= 0 && ago < entry.ticks ? ago / entry.ticks : null;
}

// Moves whose drawn motion is still the wrong one (no clip and no fallback): the list the pipeline works down.
export const motionGaps = (): MoveName[] => (Object.keys(MOTION_TABLE) as MoveName[]).filter((m) => MOTION_TABLE[m].clip === null && MOTION_TABLE[m].fallback === 'none');
