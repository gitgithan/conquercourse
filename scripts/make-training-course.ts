// The Training course (CC-97): every move in one chain, each beat on its own deck so one cue shows at a time. Run this, then `npx tsx scripts/plans.ts public/assets/demo/training.course.json` stores the proved plan.
// Beats, in order (CC-175, the hands key early): gap jump, vault a box, warped wall, climb a wall, plank bridge, lache pair (the second bar can be skipped with a full pump, and the drop after either line needs a roll), rope swing, trampoline, a drop with a roll.
import { writeFileSync } from "node:fs";

// CC-175: the order teaches E early: gap, vault, warped wall, climb, plank, then the CC-161 block (lache pair, rope, trampoline, drop and roll) unchanged but moved along by (DX, DY).
// CC-196: the half-metre step before the wall is gone (a second V that taught nothing).
// CC-182: the flat runs are cut to what the simulator needs (scripts/training-layout.ts), the first box is as high as a vault can be, the bars are 3.2 m over their deck (a grab must be within 0.3 m).
import { BOX_H, BOX_X, CLIMB_X, DX, DY, GAP_EDGE, PLANK_X0, PLANK_X1, START_X, TRAMP_CUT, WALL_X } from "./training-layout";
const T = TRAMP_CUT; // everything after the rope's landing deck moves back by this
const platforms: { x0: number; x1: number; top: number; bouncy?: boolean }[] = [
  { x0: -10, x1: GAP_EDGE, top: 0 }, // run
  { x0: GAP_EDGE + 5, x1: BOX_X, top: 0 }, // after a 5 m gap jump
  { x0: BOX_X, x1: BOX_X + 8, top: BOX_H }, // the box to vault
  { x0: BOX_X + 8, x1: WALL_X + 4, top: 0 }, // the warped wall starts at WALL_X and rises over 4 m
  { x0: WALL_X + 4, x1: CLIMB_X, top: 4 }, // the top of the 4 m warped wall
  { x0: CLIMB_X, x1: PLANK_X0, top: 6 }, // the 2 m wall to climb
  // plank bridge from PLANK_X0 to PLANK_X1 at 6
  // CC-161 block, as it was, moved by (DX, DY):
  { x0: PLANK_X1, x1: 62 + DX, top: DY }, // run-up to the first bar
  { x0: 73 + DX, x1: 86 + DX, top: -2 + DY }, // after the lache pair (11 m, more than a jump even 2 m down; CC-193: 1 m closer, the bars are 0.2 m lower now, so a full pump on bar 1 still flies past bar 2 but only just; the drop after bar 1 or bar 2 needs a roll)
  { x0: 94 + DX, x1: 128 + DX - T, top: DY }, // after the rope (8 m gap); then a run to the trampoline
  { x0: 133 + DX - T, x1: 139 + DX - T, top: -2 + DY, bouncy: true }, // a 2 m drop onto the trampoline
  { x0: 143 + DX - T, x1: 160 + DX - T, top: 1 + DY }, // thrown up onto the high deck (it only clears with the bounce)
  { x0: 160 + DX - T, x1: 200 + DX - T, top: -4 + DY }, // a 5 m drop to roll out of
];
const course = {
  version: 1, name: "Training course: every move", startX: START_X, finishX: 178 + DX - T, jumpSpeed: 4.5, jumpKeep: 0.88,
  terrain: { waterY: -6, platforms },
  rope: { anchorX: 90 + DX, anchorY: 6.6 + DY, length: 9 },
  planks: [{ x0: PLANK_X0, x1: PLANK_X1, y: DY, thickness: 0.035, width: 0.6, material: "wood" }], // the plank bridge sags but holds
  wall: { x0: WALL_X, height: 4 }, // the warped wall (hold E in the last moment of the climb, when the hands reach the lip)
  grabReach: 0.15, // CC-193: the hands touch the bar at the first grab (the default 0.35 m left them a forearm away)
  holds: [{ x: 65 + DX, y: 3.2 + DY }, { x: 68.5 + DX, y: 3.2 + DY }],
  zones: [
    { id: "gap", name: "Gap jump", x0: GAP_EDGE - 4, x1: GAP_EDGE + 10 },
    { id: "vault", name: "Vault", x0: BOX_X - 3, x1: BOX_X + 10 },
    { id: "wall", name: "Warped wall", x0: WALL_X - 3, x1: WALL_X + 6 },
    { id: "climb", name: "Climb", x0: CLIMB_X - 4, x1: CLIMB_X + 6 },
    { id: "plank", name: "Plank bridge", x0: PLANK_X0 - 3, x1: PLANK_X1 + 3 },
    { id: "lache", name: "Lache pair", x0: 59 + DX, x1: 74 + DX },
    { id: "rope", name: "Rope swing", x0: 83 + DX, x1: 96 + DX },
    { id: "trampoline", name: "Trampoline", x0: 126 + DX - T, x1: 146 + DX - T },
    { id: "drop", name: "Drop and roll", x0: 154 + DX - T, x1: 170 + DX - T },
  ],
  checkpoints: [{ id: "gap", x: START_X }, { id: "vault", x: BOX_X - 10 }, { id: "wall", x: WALL_X - 8 }, { id: "climb", x: CLIMB_X - 8 }, { id: "plank", x: PLANK_X0 - 4 }, { id: "lache", x: 54 + DX }, { id: "rope", x: 78 + DX }, { id: "trampoline", x: 122 + DX - T }, { id: "drop", x: 150 + DX - T }],
  hazard: "lava",
};
writeFileSync("public/assets/demo/training.course.json", JSON.stringify(course, null, 2) + "\n");
