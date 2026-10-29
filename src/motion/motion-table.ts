// Motion table (CC-64): which clip each simulator state asks for, what the body does while there is no clip yet, and how long it lasts.
// The simulator is the master clock: a clip's progress is read from game ticks, never from a timer of its own.
// A move without a clip never shows a wrong motion: it shows its fallback pose, or, if it has none, it says so here.
import { DEFAULT_LANDING } from '../sim/landing';
import { TICKS_PER_SECOND } from '../sim/units';
import { HURT_TICKS } from './poses';

export type MoveName = 'roll' | 'hurt' | 'vault' | 'climb' | 'hang' | 'giant-swing' | 'seated' | 'launch';

export interface ReviewedMotionCandidate {
  sources: string[];
  preview: string;
  status: 'preview-approved';
  note: string;
}

export interface MoveEntry {
  clip: string | null; // public/assets/motion/<clip>.json once it passes the gate and the move check (pipelines/moves.json); null = none yet
  candidate?: ReviewedMotionCandidate; // reviewed preview recipe; separate from a shipped, game-loaded clip
  fallback: 'tuck' | 'hands' | 'pose' | 'none'; // what is drawn while the clip is missing or switched off: 'tuck', 'hands' and 'pose' are bone-built poses (src/render/actor.ts, src/motion/vault-pose.ts); 'none' keeps the old motion and is listed as a gap
  ticks: number | null; // how long the move lasts in game ticks, from the simulator's own numbers (null = as long as the state lasts)
  from: string; // the simulator state or event that starts it
}

// A roll lasts as long as the simulator says it takes to stop the fall (src/sim/landing.ts rollStopTime), plus 0.2 s to come up onto the feet.
export const ROLL_GET_UP_S = 0.2;
export const ROLL_TICKS = Math.round((DEFAULT_LANDING.rollStopTime + ROLL_GET_UP_S) * TICKS_PER_SECOND);

export const MOTION_TABLE: Record<MoveName, MoveEntry> = {
  roll: { clip: 'roll', fallback: 'tuck', ticks: ROLL_TICKS, from: "event 'land' with rolled (WorldState.rolledAt)" },
  hurt: { clip: 'hurt', fallback: 'pose', ticks: HURT_TICKS, from: "outcome 'hurt' (event 'hard-landing')" },
  vault: {
    clip: 'vault',
    candidate: {
      sources: [
        'data/eval/motion-vault/outputs/london_parkour_ledge_landing_35_37/clip.json',
        'data/eval/motion-vault/outputs/london_parkour_same_level_vault_80_84/clip.json',
        'public/assets/motion/run.json',
        'public/assets/motion/land.json',
      ],
      preview: '/?demo=captured-vault (kick, vault over wall, then fall and land)',
      status: 'preview-approved',
      note: 'Ledge-capture kick and pull-up, captured vault pass, IK hand contact, ballistic fall, then run-on.',
    },
    fallback: 'hands',
    ticks: null,
    from: "mode 'vault' (progress = WorldState.vault.i / n): the captured clip plays with the hands pinned on the contact point; the contact-point pose is the fallback",
  },
  climb: {
    clip: 'climb',
    candidate: {
      sources: [
        'data/eval/motion-vault/outputs/london_parkour_ledge_landing_35_37/clip.json',
        'public/assets/motion/run.json',
      ],
      preview: '/?demo=captured-vault (climb onto a long ledge, then run along it)',
      status: 'preview-approved',
      note: 'Captured ledge climb and pull-up followed by the normal run cycle.',
    },
    fallback: 'pose',
    ticks: null,
    from: "mode 'climb' (progress = WorldState.climb.i / n): the captured pull-up plays with the hands held on the real edge; the hang-to-stand blend is the fallback",
  },
  hang: { clip: 'swing', fallback: 'none', ticks: null, from: "mode 'hang' (the rope's swing pose, turned about the hands)" },
  'giant-swing': { clip: null, fallback: 'pose', ticks: null, from: "mode 'hang' with the swing past horizontal (CC-58): the swing clip's hang, legs lagging and tucking over the top" },
  seated: { clip: null, fallback: 'pose', ticks: null, from: "mode 'cart' (CC-61)" },
  launch: { clip: null, fallback: 'pose', ticks: null, from: "mode 'launch' (CC-62)" },
};

// How the roll is shown: 'auto' plays the clip when it loaded, 'clip' requires it, 'crouch' always shows the tuck (the blind A/B, ?roll=).
export type RollLook = 'auto' | 'clip' | 'crouch';
export const rollLookFrom = (search: string): RollLook => {
  const v = new URLSearchParams(search).get('roll');
  return v === 'clip' || v === 'crouch' ? v : 'auto';
};

// Whether the captured vault and climb clips play: on by default, ?clips=0 shows the bone-built poses instead (the contact-point vault and the hang-to-stand climb).
export const capturedClipsFrom = (search: string): boolean => new URLSearchParams(search).get('clips') !== '0';

// "My move" (CC-222): a clip made from the player's own film replaces the roll clip while ?mymove=<id> is in the address.
// Off by default; the shipped roll is untouched. Only a clip that passed the plausibility gate and the roll check is ever shown.
export const MY_MOVE_BASE = '/assets/experiments/mymove';
export const myMoveFrom = (search: string): string | null => {
  const v = new URLSearchParams(search).get('mymove');
  return v !== null && /^[a-z0-9][a-z0-9-]{0,30}$/.test(v) ? v : null;
};
export const myMoveIsPlayable = (raw: unknown): boolean => {
  const c = raw as { playable?: boolean; move?: string; gate?: { pass?: boolean }; move_check?: { ok?: boolean } } | null;
  return !!c && c.playable === true && c.move === 'roll' && c.gate?.pass === true && c.move_check?.ok === true;
};

// Progress through the move, 0 at touchdown and 1 when the simulator says it is over; null when it is not on.
export function moveProgress(entry: MoveEntry, startedAt: number, tick: number): number | null {
  if (entry.ticks === null) return null;
  const ago = tick - startedAt;
  return ago >= 0 && ago < entry.ticks ? ago / entry.ticks : null;
}

// Moves whose drawn motion is still the wrong one (no clip and no fallback): the list the pipeline works down.
export const motionGaps = (): MoveName[] => (Object.keys(MOTION_TABLE) as MoveName[]).filter((m) => MOTION_TABLE[m].clip === null && MOTION_TABLE[m].fallback === 'none');
