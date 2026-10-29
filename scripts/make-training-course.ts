// The Training course (CC-97): every move in one chain, each beat on its own deck so one cue shows at a time. Run this, then `npx tsx scripts/plans.ts public/assets/demo/training.course.json` stores the proved plan.
// Beats, in order: gap jump, vault a box, lache pair (the second bar can be skipped with a full pump, and the drop after either line needs a roll), rope swing, climb a wall, trampoline, a drop with a roll.
import { writeFileSync } from "node:fs";

const platforms: { x0: number; x1: number; top: number; bouncy?: boolean }[] = [
  { x0: -10, x1: 24, top: 0 }, // run
  { x0: 29, x1: 48, top: 0 }, // after a 5 m gap jump
  { x0: 48, x1: 56, top: 1 }, // the box to vault
  { x0: 56, x1: 62, top: 0 },
  { x0: 74, x1: 86, top: -2 }, // after the lache pair (12 m, more than a jump even 2 m down; the drop after bar 1 or bar 2 needs a roll)
  { x0: 94, x1: 112, top: 0 }, // after the rope (8 m gap)
  { x0: 112, x1: 128, top: 2 }, // the 2 m wall to climb
  { x0: 133, x1: 139, top: 0, bouncy: true }, // a 2 m drop onto the trampoline
  { x0: 143, x1: 160, top: 3 }, // thrown up onto the high deck (it only clears with the bounce)
  { x0: 160, x1: 200, top: -2 }, // a 5 m drop to roll out of
];
const course = {
  version: 1, name: "Training course: every move", startX: 0, finishX: 178, jumpSpeed: 4.5, jumpKeep: 0.88,
  terrain: { waterY: -6, platforms },
  rope: { anchorX: 90, anchorY: 6.6, length: 9 },
  holds: [{ x: 65, y: 3.4 }, { x: 68.5, y: 3.4 }],
  zones: [
    { id: "gap", name: "Gap jump", x0: 20, x1: 34 },
    { id: "vault", name: "Vault", x0: 45, x1: 58 },
    { id: "lache", name: "Lache pair", x0: 59, x1: 74 },
    { id: "rope", name: "Rope swing", x0: 83, x1: 96 },
    { id: "climb", name: "Climb", x0: 106, x1: 120 },
    { id: "trampoline", name: "Trampoline", x0: 126, x1: 146 },
    { id: "drop", name: "Drop and roll", x0: 154, x1: 170 },
  ],
  checkpoints: [{ id: "gap", x: 12 }, { id: "vault", x: 36 }, { id: "lache", x: 54 }, { id: "rope", x: 78 }, { id: "climb", x: 100 }, { id: "trampoline", x: 122 }, { id: "drop", x: 150 }],
  hazard: "lava",
};
writeFileSync("public/assets/demo/training.course.json", JSON.stringify(course, null, 2) + "\n");
