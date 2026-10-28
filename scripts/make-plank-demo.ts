// Usage: npx tsx scripts/make-plank-demo.ts   (writes public/assets/demo/plank.course.json and plank-thin.course.json; then `npm run plans`)
import { writeFileSync } from "node:fs";
import type { CourseData } from "../src/course/course";

// Two decks with a gap of 9 m between them (wider than any running jump, about 8 m at top speed); a pine plank 60 cm wide lies across the gap.
// 3.5 cm thick: it dips about a metre under the runner and holds. 2 cm thick: it breaks.
const make = (name: string, thickness: number): CourseData => ({
  version: 1,
  name,
  startX: 0,
  finishX: 40,
  jumpSpeed: 4.5,
  terrain: { waterY: -3, platforms: [{ x0: -10, x1: 14, top: 0 }, { x0: 23, x1: 50, top: 0 }] },
  planks: [{ x0: 14, x1: 23, y: 0, thickness, width: 0.6, material: "wood" }],
  zones: [{ id: "plank", name: "Plank bridge", x0: 12, x1: 25 }],
  checkpoints: [{ id: "plank", x: 6 }],
});
writeFileSync("public/assets/demo/plank.course.json", JSON.stringify(make("Plank bridge: it sags but holds", 0.035), null, 2) + "\n");
writeFileSync("public/assets/demo/plank-thin.course.json", JSON.stringify(make("Plank bridge: too thin, it breaks", 0.02), null, 2) + "\n");
