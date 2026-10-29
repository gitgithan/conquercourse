// The Training course (CC-97): every move in one chain, each beat on its own deck so one cue shows at a time. Run this, then `npx tsx scripts/plans.ts public/assets/demo/training.course.json` stores the proved plan.
// Beats, in order (CC-175, the hands key early): gap jump, vault a box, step up, warped wall, climb a wall, plank bridge, lache pair (the second bar can be skipped with a full pump, and the drop after either line needs a roll), rope swing, trampoline, a drop with a roll.
import { writeFileSync } from "node:fs";

// CC-175: the order teaches E early: gap, vault, step, warped wall, climb, plank, then the CC-161 block (lache pair, rope, trampoline, drop and roll) unchanged but moved along by (DX, DY).
const DX = 99, DY = 6.5;
const platforms: { x0: number; x1: number; top: number; bouncy?: boolean }[] = [
  { x0: -10, x1: 24, top: 0 }, // run
  { x0: 29, x1: 48, top: 0 }, // after a 5 m gap jump
  { x0: 48, x1: 56, top: 1 }, // the box to vault
  { x0: 56, x1: 70, top: 0 },
  { x0: 70, x1: 88, top: 0.5 }, // a half-metre step up; the warped wall starts at x 84 and rises over 4 m
  { x0: 88, x1: 106, top: 4.5 }, // the top of the 4 m warped wall
  { x0: 106, x1: 130, top: 6.5 }, // the 2 m wall to climb
  // plank bridge from 130 to 139 at 6.5
  // CC-161 block, as it was, moved by (DX, DY):
  { x0: 139, x1: 62 + DX, top: DY }, // run-up to the first bar (the old deck 56 to 62 joined to it)
  { x0: 74 + DX, x1: 86 + DX, top: -2 + DY }, // after the lache pair (12 m, more than a jump even 2 m down; the drop after bar 1 or bar 2 needs a roll)
  { x0: 94 + DX, x1: 128 + DX, top: DY }, // after the rope (8 m gap); then a long run to the trampoline
  { x0: 133 + DX, x1: 139 + DX, top: -2 + DY, bouncy: true }, // a 2 m drop onto the trampoline
  { x0: 143 + DX, x1: 160 + DX, top: 1 + DY }, // thrown up onto the high deck (it only clears with the bounce)
  { x0: 160 + DX, x1: 200 + DX, top: -4 + DY }, // a 5 m drop to roll out of
];
const course = {
  version: 1, name: "Training course: every move", startX: 0, finishX: 178 + DX, jumpSpeed: 4.5, jumpKeep: 0.88,
  terrain: { waterY: -6, platforms },
  rope: { anchorX: 90 + DX, anchorY: 6.6 + DY, length: 9 },
  planks: [{ x0: 130, x1: 139, y: DY, thickness: 0.035, width: 0.6, material: "wood" }], // the plank bridge sags but holds
  wall: { x0: 84, height: 4 }, // the warped wall (hold E for the last half second)
  holds: [{ x: 65 + DX, y: 3.4 + DY }, { x: 68.5 + DX, y: 3.4 + DY }],
  zones: [
    { id: "gap", name: "Gap jump", x0: 20, x1: 34 },
    { id: "vault", name: "Vault", x0: 45, x1: 58 },
    { id: "step", name: "Step up", x0: 64, x1: 74 },
    { id: "wall", name: "Warped wall", x0: 81, x1: 90 },
    { id: "climb", name: "Climb", x0: 100, x1: 114 },
    { id: "plank", name: "Plank bridge", x0: 127, x1: 142 },
    { id: "lache", name: "Lache pair", x0: 59 + DX, x1: 74 + DX },
    { id: "rope", name: "Rope swing", x0: 83 + DX, x1: 96 + DX },
    { id: "trampoline", name: "Trampoline", x0: 126 + DX, x1: 146 + DX },
    { id: "drop", name: "Drop and roll", x0: 154 + DX, x1: 170 + DX },
  ],
  checkpoints: [{ id: "gap", x: 12 }, { id: "vault", x: 36 }, { id: "step", x: 60 }, { id: "wall", x: 72 }, { id: "climb", x: 96 }, { id: "plank", x: 124 }, { id: "lache", x: 54 + DX }, { id: "rope", x: 78 + DX }, { id: "trampoline", x: 122 + DX }, { id: "drop", x: 150 + DX }],
  hazard: "lava",
};
writeFileSync("public/assets/demo/training.course.json", JSON.stringify(course, null, 2) + "\n");
