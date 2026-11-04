import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readGlbMesh } from "../src/slice/glb";
import { ALL_STEPS, FACE_CAP, RECORDED_COST, RECORDED_LIFTS, STEP_NAMES, TYPICAL_HEIGHT, bake, barLength, bounds, faceCount, recipeFor, sizeWarning, typicalHeight, unbake, type Steps } from "../src/labs/lift/lift-core";

// Lab 14 (cut-out, lift and bake): the bake rules pinned on a recorded GLB, and the recorded numbers pinned to the files they came from.
const index = JSON.parse(readFileSync("public/assets/objects/index.json", "utf8")).objects as { name: string; label: string; height_m: number; extents_m: { x: number; y: number; z: number }; glb: string; faces: number }[];
const load = (name: string) => { const o = index.find((x) => x.name === name)!; const b = readFileSync(`public/assets/objects/${o.glb}`); return { o, mesh: readGlbMesh(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer) }; };
const off = (k: keyof Steps): Steps => ({ ...ALL_STEPS, [k]: false });

describe("Lab 14: the recorded baked object", () => {
  it("is stood on the ground, centred, within the face cap, and as tall as its record says", () => {
    const { o, mesh } = load("bench-concrete"), b = bounds(mesh);
    expect(b.min[1]).toBeCloseTo(0, 2);
    expect(Math.abs((b.min[0] + b.max[0]) / 2)).toBeLessThan(0.02);
    expect(b.size[1]).toBeCloseTo(o.height_m, 2);
    expect(b.size[0]).toBeGreaterThan(b.size[2]);
    expect(faceCount(mesh)).toBeLessThanOrEqual(FACE_CAP);
  });
});

describe("Lab 14: baking an unbaked recorded object gives the record back", () => {
  for (const name of ["bench-concrete", "railing-iron", "rail-skate-01", "box-skate-03"]) {
    it(`${name}: size and stance come back`, () => {
      const { o, mesh } = load(name), { recipe } = recipeFor(name);
      const raw = unbake(mesh, recipe);
      expect(bounds(raw.mesh).size[2]).toBeCloseTo(recipe.rawHeight, 3); // the raw lift stands on z and is the lift's own size, not the baked size
      const r = bake(raw, { label: o.label, typedHeight: o.height_m, steps: ALL_STEPS });
      expect(r.size[1]).toBeCloseTo(o.extents_m.y, 2);
      expect(r.size[0]).toBeCloseTo(o.extents_m.x, 1);
      expect(r.size[2]).toBeCloseTo(o.extents_m.z, 1);
      expect(r.minY).toBeCloseTo(0, 6);
      expect(r.centreOffset).toBeLessThan(1e-6);
      expect(r.faces).toBe(Math.min(recipe.rawFaces, FACE_CAP));
    });
  }
  it("the typical height is used when none is typed (bench 0.8, as recorded)", () => {
    const { o, mesh } = load("bench-concrete");
    const r = bake(unbake(mesh, recipeFor("bench-concrete").recipe), { label: "bench", typedHeight: null, steps: ALL_STEPS });
    expect(r.heightM).toBeCloseTo(o.height_m, 3);
    expect(r.scaleSource).toBe("typical:bench");
    expect(r.factor).toBeCloseTo(1 / bounds(unbake(mesh, recipeFor("bench-concrete").recipe).mesh).size[2] * r.heightM, 1); // factor = target / raw height (raw height is the lift's z extent)
  });
});

describe("Lab 14: each bake step, switched off, breaks the object the way the doc says", () => {
  const { o, mesh } = load("bench-concrete");
  const raw = unbake(mesh, recipeFor("bench-concrete").recipe);
  const run = (steps: Steps) => bake(raw, { label: "bench", typedHeight: o.height_m, steps });
  it("no 'ignore the layout': tilted by the camera pitch and the height is no longer the typed one", () => {
    const r = run(off("noLayout"));
    expect(r.tiltDeg).toBeGreaterThan(5);
    expect(r.size[1]).toBeCloseTo(o.height_m, 2); // scaled to the typed height, but the object leans: the footprint grows
    expect(r.size[0] * r.size[2]).not.toBeCloseTo(o.extents_m.x * o.extents_m.z, 1);
  });
  it("no z-up turn: lies on its side", () => {
    const r = run(off("upright"));
    expect(r.size[0] * r.size[2]).not.toBeCloseTo(o.extents_m.x * o.extents_m.z, 1);
    expect(Math.abs(r.size[2] - o.extents_m.z) / o.extents_m.z).toBeGreaterThan(0.2); // the old height now sticks out as depth
  });
  it("no facing: the side view is cut across (the footprint box is larger than the smallest)", () => {
    const on = run(ALL_STEPS), no = run(off("face"));
    expect(no.size[0] * no.size[2]).toBeGreaterThan(on.size[0] * on.size[2] * 1.15);
  });
  it("no grounding: floats or sits off centre", () => {
    const r = run(off("ground"));
    expect(r.minY > 0.05 || r.centreOffset > 0.05).toBe(true);
  });
  it("no reduction: raw triangles, well over the cap", () => { expect(run(off("reduce")).faces).toBe(387796); });
  it("no scaling: the lift's own tiny size", () => {
    const r = run(off("scale"));
    expect(r.factor).toBe(1);
    expect(r.heightM).toBeLessThan(0.5);
  });
  it("names every step the pipeline doc lists", () => { expect(STEP_NAMES.map((s) => s.key).sort()).toEqual(Object.keys(ALL_STEPS).sort()); });
});

describe("Lab 14: typical heights and the thin-box lesson", () => {
  it("typical heights equal the table in docs/pipelines.md", () => {
    const doc = readFileSync("docs/pipelines.md", "utf8");
    expect(doc).toContain("bench 0.8 m with its back, wall and low wall 0.9, rail and handrail 1.0, ledge and platform 0.5, steps 0.7");
    expect([TYPICAL_HEIGHT.bench, TYPICAL_HEIGHT.wall, TYPICAL_HEIGHT["low wall"], TYPICAL_HEIGHT.rail, TYPICAL_HEIGHT.handrail, TYPICAL_HEIGHT.ledge, TYPICAL_HEIGHT.platform, TYPICAL_HEIGHT.steps]).toEqual([0.8, 0.9, 0.9, 1, 1, 0.5, 0.5, 0.7]);
    expect(typicalHeight("Fire hydrant")).toBeNull();
  });
  it("each recorded object's scale source matches the typical table", () => {
    for (const o of index) { const t = typicalHeight(o.label); if (t !== null) expect(o.height_m).toBeCloseTo(t, 2); }
  });
  it("monkey bars: 0.25 m typed makes a bar about 5 m long and 2.4 m makes the 52 m bar of the first try", () => {
    const rec = JSON.parse(readFileSync("docs/evidence/cc-133-lifts/monkey-bars-lift.json", "utf8"));
    expect(rec.lift_check.extent_aspect).toBe(RECORDED_COST.monkeyBars.extent_aspect);
    expect(barLength(0.25, rec.lift_check.extent_aspect)).toBeCloseTo(5.4, 1);
    expect(barLength(2.4, rec.lift_check.extent_aspect)).toBeCloseTo(52, 0);
    expect(rec.object.height_note).toContain("52 m");
    expect(sizeWarning([52, 2.4, 1])).not.toBe("");
    expect(sizeWarning([5, 0.25, 0.1])).toBe("");
  });
});

describe("Lab 14: recorded cost and time match the files they came from", () => {
  it("monkey bars run", () => {
    const rec = JSON.parse(readFileSync("docs/evidence/cc-133-lifts/monkey-bars-lift.json", "utf8")), c = RECORDED_COST.monkeyBars;
    expect([rec.mask_load_seconds, rec.lift_load_seconds, rec.mask_seconds, rec.lift_seconds, rec.wall_seconds, rec.usd_estimate]).toEqual([c.mask_load_seconds, c.lift_load_seconds, c.mask_seconds, c.lift_seconds, c.wall_seconds, c.usd_estimate]);
  });
  it("the bake meshes of CC-38 round 3", () => {
    for (const [photo, rec] of Object.entries(RECORDED_LIFTS)) {
      const m = JSON.parse(readFileSync(`data/eval/cc-38-photo-to-3d/r3/${rec.photo}/mesh.json`, "utf8"));
      expect([m.raw_height, m.yaw_deg, m.tilt_deg, m.raw_faces, m.faces, m.scale_factor], photo).toEqual([rec.rawHeight, rec.yawDeg, rec.tiltDeg, rec.rawFaces, rec.bakedFaces, rec.factor]);
    }
    for (const [p, s] of Object.entries(RECORDED_COST.bakeSeconds)) expect(JSON.parse(readFileSync(`data/eval/cc-38-photo-to-3d/r3/${p}/mesh.json`, "utf8")).bake_seconds).toBe(s);
  });
  it("the pipeline doc quotes the lift range, the per-object time and the price", () => {
    const doc = readFileSync("docs/pipelines.md", "utf8");
    expect(doc).toContain("8-10 s for the lift on the L40S and 0.3-2 s for the mask");
    expect(doc).toContain("about 15 s per object end to end; the first object takes 90-100 s");
    expect(doc).toContain("about 2 cents per object");
  });
});
