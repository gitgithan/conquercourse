// Builds the editor-made demo courses from the real objects of the library (bench, rails, stairs, skate box), the way the
// editor does: place the pieces, cut the lane, make the course, put the real meshes in as the scene, prove it, store the plan.
//   npx tsx scripts/make-real-demos.ts      then open  /?course=/assets/demo/park-rail-run.course.json
import { readFileSync, writeFileSync } from "node:fs";
import { readGlbMesh } from "../src/slice/glb";
import { newPiece, type Piece } from "../src/slice/world";
import { roleCourse } from "../src/slice/roles";
import { sceneFor } from "../src/slice/scene";
import { searchIdealRun } from "../src/sim/ideal";
import type { CourseData } from "../src/course/course";

type P = Piece & { src?: string };
const load = (glb: string, x: number, z = 0): P => {
  const b = readFileSync(`public/assets/objects/${glb}`);
  const p: P = { ...newPiece(glb.replace(".glb", ""), readGlbMesh(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer), { x, z }), src: `obj:${glb}` };
  return p;
};

interface Demo { file: string; name: string; about: string; pieces: [string, number][]; lane?: { angle: number; offset: number; level: number } }
export const DEMOS: Demo[] = [
  { file: "park-rail-run", name: "Park rail run", about: "Three real handrails and a skate box in a row: vault, jump, repeat.", pieces: [["rail-skate-01.glb", 3], ["rail-skate-02.glb", 8.5], ["railing-iron.glb", 14], ["box-skate-03.glb", 19]] },
  { file: "bench-and-stairs", name: "Bench and stairs", about: "A skate box, a concrete bench and park stairs: small steps up and down.", pieces: [["box-skate-03.glb", 3], ["bench-concrete.glb", 7.7], ["stairs-park-07.glb", 12.2], ["box-skate-03.glb", 18]] },
  { file: "skate-box-and-rail", name: "Skate box and rail", about: "Stairs, a long box, a handrail and a bench: a plaza line.", pieces: [["stairs-park-07.glb", 3], ["box-skate-03.glb", 9.5], ["rail-skate-01.glb", 15.5], ["bench-concrete.glb", 21]] },
];

const only = process.argv[2];
let bad = 0;
for (const d of DEMOS) {
  if (only && d.file !== only) continue;
  const pieces = d.pieces.map(([g, x]) => load(g, x));
  const lane = d.lane ?? { angle: 0, offset: 0, level: 0 };
  const { course } = roleCourse(pieces, lane, d.name) as { course: CourseData };
  course.scene = sceneFor(pieces, lane, course.uMap ?? []);
  if (process.env.DEBUG) console.log(JSON.stringify(course.terrain.platforms.map((q) => [q.x0, q.x1, q.profile ? "profile" : q.y ?? 0])));
  const r = searchIdealRun(course, { routes: true });
  console.log(`${d.file}: ${r.cleared ? "clears" : "DOES NOT CLEAR"}, ${course.terrain.platforms.length} platforms, finish ${course.finishX}`);
  if (!r.cleared) { bad++; continue; }
  course.plan = r.plan; if (r.routes) course.routes = r.routes;
  course.name = d.name;
  writeFileSync(`public/assets/demo/${d.file}.course.json`, JSON.stringify(course, null, 2) + "\n");
}
process.exit(bad ? 1 : 0);
