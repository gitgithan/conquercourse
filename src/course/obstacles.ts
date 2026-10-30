// One row per obstacle kind: everything the player reads about it, in one place.
// Add a kind: add its id to ObstacleId and one row below; the strip icon, the report lines and the failure tips all read from here.
// A row is checked by the compiler (`satisfies`), so a typo in an id or a tip name fails the build, not the run.
// The sim never reads this file: it holds words and pictures only.

export type ObstacleId =
  | 'gap' | 'landing' | 'wall' | 'rope' | 'trampoline' | 'lache' | 'launch' | 'recoil' | 'step' | 'climb'
  | 'vault' | 'band' | 'drone' | 'plank' | 'stack' | 'drop' | 'coaster' | 'course' | 'cannon';

export interface ObstacleRow {
  icon?: string; // a 32 by 32 outline picture for the Course strip and the report (a cannon has none)
  learned?: string; // the one plain line on the end-of-run report
  saying?: string; // the physics saying (docs/sayings.md)
  tips?: Readonly<Record<string, string>>; // the fixed failure tips; the ones that quote numbers stay in the course mode
}

export const OBSTACLES = {
  gap: {
    icon: '<path d="M3 20 H11 V12 M21 20 H29 V12 M11 12 H3 M21 12 H29 M12 8 Q16 2 20 8" />',
    learned: 'A jump is decided the moment your feet leave the ground.',
    saying: 'Once your feet leave the ground, the jump is already decided.',
    tips: {
      noJump: 'Press Space just before the edge.',
      fast: 'Your speed was enough. Try pressing Space a little closer to the edge.',
    },
  },
  landing: {
    icon: '<rect x="9" y="12" width="14" height="8" rx="1"/><path d="M16 4 V9 M13 7 L16 10 L19 7"/>',
  },
  wall: {
    icon: '<path d="M4 26 Q22 26 26 4 M26 4 H29"/>',
    learned: 'The wall spends the speed you bring; it cannot add any.',
    saying: "The wall can't lift you. It only spends the speed you bring.",
    tips: {
      slide: 'You ran out of speed on the curve. Start the run-up earlier and keep running.',
    },
  },
  rope: {
    icon: '<path d="M5 5 H27 M16 5 V19"/><circle cx="16" cy="23" r="3.5"/>',
    learned: 'A swing gives back the height you fall.',
    saying: 'Fall to rise: the rope gives back every bit of height you give it.',
    tips: {
      fall: 'Grab the rope on the way up, then press Space to let go when you are rising.',
    },
  },
  trampoline: {
    icon: '<path d="M4 20 H28 M7 20 L9 26 M25 20 L23 26 M13 14 Q16 4 19 14"/>',
    learned: 'The harder you land, the higher it throws you.',
    saying: 'The harder you land, the higher it throws you.',
    tips: {
      fall: 'Press Space at the bottom of the bounce for extra height.',
    },
  },
  lache: {
    icon: '<path d="M4 5 H28 M8 5 V13 M16 5 V13 M24 5 V13 M5 22 Q16 12 27 22"/>',
    learned: 'Push with the swing and it grows; push against it and it fades.',
    saying: 'Push with the swing and it grows; push against it and it fades.',
  },
  launch: {
    icon: '<path d="M5 25 L25 7 M19 7 H25 V13 M8 23 L13 28"/><circle cx="10" cy="9" r="3"/>',
    learned: 'Letting go late throws you into the ground.',
    saying: 'A long arm gets you far; letting go late gets you thrown into the ground.',
  },
  recoil: {
    icon: '<path d="M5 16 H26 M5 16 L11 10 M5 16 L11 22 M27 7 V25"/>',
    learned: 'Momentum: the light thing goes fast, the heavy thing slow.',
    saying: 'The heavy thing goes slow, the light thing fast, and both carry the same.',
    tips: {
      aim: 'Tilt the barrel with the arrow keys until the dotted path ends on the far deck, then press K. A steeper shot flies higher and lands harder: tap X just before the ground.',
      push: 'The push was not enough. A heavier ball, or a faster one, pushes harder. Fire as you leave the edge so the push carries through the whole flight.',
      pad: 'Run onto the teal pad, then press K to fire the launcher as you jump.',
    },
  },
  step: {
    icon: '<path d="M4 24 H12 V18 H20 V12 H28"/>',
    learned: 'A step up needs speed; a vault keeps more of it than a jump.',
  },
  climb: {
    icon: '<path d="M6 28 V13 H19 V28 M13 10 V3 M10 6 L13 3 L16 6"/>',
    learned: 'A wall takes your speed; your arms do the rest.',
    saying: 'Speed gets you to the wall; arms get you over it.',
  },
  vault: {
    icon: '<rect x="11" y="19" width="10" height="7"/><path d="M3 26 Q5 8 16 13 Q27 8 29 26"/>',
    learned: 'A vault keeps your speed; a jump spends it.',
    saying: 'A jump buys height with speed; a vault keeps the speed but needs a hand on the obstacle.',
  },
  band: {
    icon: '<path d="M5 5 V27 M5 16 H9 L11 9 L15 23 L19 9 L23 23 L25 16 H28"/>',
    learned: 'A soft band pulled far stores more energy than a stiff one pulled little.',
    saying: 'A soft band pulled far outthrows a stiff one pulled little.',
    tips: {
      noRelease: 'Hold ← to run away from the post and stretch the band first. Then turn round (hold →).',
    },
  },
  drone: {
    icon: '<circle cx="16" cy="19" r="3"/><path d="M5 11 H12 M20 11 H27 M12 11 L14 16 M20 11 L18 16 M8 7 V11 M24 7 V11"/>',
    learned: 'A leaning drone has to push harder to stay up.',
    tips: {
      crash: 'The drone touched down too fast or leaning, or flew into the side of a deck. Come down slowly with ↓ over the deck, let go of ← → before the ground so it levels out, and keep E held until it sets you down.',
      empty: 'The battery ran out before the far deck. Hovering costs a lot of battery: lean and fly straight across, and start coming down only over the deck. A bigger battery or a lighter rider also helps.',
      short: 'You came down short of the far deck. Keep leaning forward longer before you lean back, and start coming down only when you are over the deck.',
    },
  },
  plank: {
    icon: '<path d="M4 12 V26 M28 12 V26 M4 12 Q16 24 28 12"/>',
    learned: 'A longer plank bends much more; a thicker one bends less.',
    saying: 'A plank that is twice as long sags eight times as much.',
    tips: {
      weak: 'The plank was too weak for the gap. Try again.',
    },
  },
  stack: {
    icon: '<rect x="4" y="21" width="7" height="6" rx="1"/><rect x="12.5" y="21" width="7" height="6" rx="1"/><rect x="21" y="21" width="7" height="6" rx="1"/><rect x="8" y="14" width="7" height="6" rx="1"/><rect x="17" y="14" width="7" height="6" rx="1"/><rect x="12.5" y="7" width="7" height="6" rx="1"/>',
    learned: 'Speed climbs the cups, and speed carries you off the top.',
    saying: 'Speed climbs the cups, and speed carries you off the top.',
  },
  drop: {
    icon: '<path d="M8 5 V20 M4 16 L8 21 L12 16 M17 23 H28"/>',
    learned: 'Rolling turns a hard fall into forward motion.',
    saying: 'Turn your fall into a roll and the ground forgives you.',
    tips: {
      hurt: 'The ground stopped you too fast. Hold X as you land to roll (it counts in the last 0.15 s, about a metre up; a tap earlier does nothing): the same fall is spread over more time, and a roll keeps most of your speed.',
    },
  },
  coaster: {
    icon: '<path d="M3 23 Q9 23 11 9 Q13 2 16 14 Q20 29 24 15 Q26 9 29 9"/>',
    learned: 'Energy: a coaster climbs no higher than it started.',
    saying: 'A coaster has no engine: it climbs no higher than where it started.',
  },
  course: {
    icon: '<path d="M4 25 H10 L14 10 L19 21 L23 13 H28"/><circle cx="7" cy="19" r="2"/>',
  },
  cannon: {
    learned: 'Aim between high and flat: the middle angle flies farthest.',
    saying: 'Aim between high and flat: the middle angle flies farthest.',
  },
} as const satisfies Record<ObstacleId, ObstacleRow>;

const rows = OBSTACLES as Readonly<Record<string, ObstacleRow>>;
/** The rows that have a field, as a plain map (the old ZONE_ICONS, LEARNED and SAYING shapes). */
export function column(field: 'icon' | 'learned' | 'saying'): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, r] of Object.entries(rows)) { const v = r[field]; if (v) out[id] = v; }
  return out;
}

// The course field that makes an obstacle the topic of a course, in the order they are checked (a machine beats a zone).
export const TOPIC_ORDER = [
  ['coaster', 'track'], ['band', 'band'], ['launch', 'trebuchet'], ['drone', 'drone'], ['recoil', 'recoil'], ['plank', 'planks'],
] as const satisfies readonly (readonly [ObstacleId, string])[];

// CC-195: the plain-words cue before an obstacle. A drum of kind `drum` gets the text directly;
// a `grab` drum is matched to the zone (by id prefix), in the order of the rows marked grab, then by what the course holds.
export const APPROACH_LEAD = 12; // metres before the drum (about 1.4 s at running speed)
export const TRAMPOLINE_LEAD = 14; // the trampoline cue is older and longer (it stays four seconds); the drum for a bounce sits on the bed
export interface ToastRow { text: string; lead?: number; drum?: 'vault' | 'roll' | 'jump' | 'bounce'; grab?: true }
export const TOASTS = {
  vault: { text: 'A step is coming: press V as you reach it to vault over', drum: 'vault' },
  wall: { text: 'The warped wall is coming: run up it, then hold E near the top', grab: true },
  climb: { text: 'A tall wall is coming: hold E at the wall to grab the edge and climb', grab: true },
  lache: { text: 'A bar is coming: jump, then hold E to grab it', grab: true },
  rope: { text: 'A rope is coming: jump, then hold E to catch it', grab: true },
  roll: { text: 'A big drop is coming: hold X as you land to roll', drum: 'roll' },
  jump: { text: 'A gap is coming: press Space just before the edge', drum: 'jump' },
  bounce: { text: 'Trampoline ahead: press Space the moment you land on it for extra height', drum: 'bounce', lead: TRAMPOLINE_LEAD },
} as const satisfies Record<string, ToastRow>;
export type ToastKind = keyof typeof TOASTS;
