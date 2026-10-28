// CC-91: does the lane the map proved match what the editor shows? Compares the two ways of reading the same lane off the same place.
// Usage: npx tsx scripts/lane-consistency.ts [slug...]   (writes data/eval/cc-91-lane/consistency.json)
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { describe, sliceProfile, surfaceSamples, laneSamples } from "../src/slice/slice";
import { centred, laneProfile, newPiece, worldSamples } from "../src/slice/world";
import { osmToMesh } from "../src/world/osm";
import type { Ground } from "../src/world/terrain";

const dir = "public/assets/places/";
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(dir).filter((f) => f.endsWith(".json") && !["index.json", "photos-index.json"].includes(f)).map((f) => f.replace(".json", ""));
const out: Record<string, unknown>[] = [];
for (const slug of slugs) {
  const p = JSON.parse(readFileSync(dir + slug + ".json", "utf8"));
  if (!p.lane?.cleared) { out.push({ slug, note: "no cleared stored lane" }); continue; }
  const ground: Ground | null = p.ground ? { radius: p.radius, ...p.ground } : null;
  const k = p.lane.shrink, m = osmToMesh(p.answer, p.lat, p.lon, k, ground);
  const mesh = centred({ positions: m.positions, indices: m.indices });
  const o = { angle: (p.lane.turnDeg * Math.PI) / 180, offset: p.lane.sidewaysM, level: p.lane.levelM };
  const centre = { x: 0, z: 0 };
  const slicer = sliceProfile(surfaceSamples(mesh, 80), centre, o); // what the map searched with
  const editor = sliceProfile(worldSamples([newPiece("Place", { positions: m.positions, indices: m.indices })]), centre, o); // what the editor reads with the same lane
  const dflt = sliceProfile(worldSamples([newPiece("Place", { positions: m.positions, indices: m.indices })]), centre, { angle: 0, offset: 0, level: 0 }); // what the editor starts on today
  const diff = (a: typeof slicer, b: typeof slicer) => { let n = 0; const L = Math.max(a.cells.length, b.cells.length); for (let i = 0; i < L; i++) { const x = a.cells[i] ?? null, y = b.cells[i] ?? null; if ((x === null) !== (y === null) || (x !== null && y !== null && Math.abs(x - y) > 0.05)) n++; } return n; };
  const r = (pr: typeof slicer) => { const d = describe(pr); return { length: Math.round(pr.length * 10) / 10, gaps: d.gaps, steps: d.steps, faces: d.faces, maxRise: Math.round(d.maxRise * 10) / 10, maxDrop: Math.round(d.maxDrop * 10) / 10 }; };
  const mapNew = sliceProfile(laneSamples(mesh, o), centre, o), editorNew = laneProfile([newPiece("Place", { positions: m.positions, indices: m.indices })], o);
  out.push({ slug, shrink: k, lane: o, before: { mapReads: r(slicer), editorReadsSameLane: r(editor), cellsDifferent: diff(slicer, editor) }, after: { mapReads: r(mapNew), editorReadsSameLane: r(editorNew), cellsDifferent: diff(mapNew, editorNew) }, cellsTotal: slicer.cells.length, editorStartsOn: r(dflt) });
}
writeFileSync("data/eval/cc-91-lane/consistency.json", JSON.stringify(out, null, 2) + "\n");
for (const e of out) console.log(JSON.stringify(e));
