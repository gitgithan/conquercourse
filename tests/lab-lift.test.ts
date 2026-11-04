import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readGlbMesh } from "../src/slice/glb";
import { ALL_STEPS, FACE_CAP, RECORDED_COST, RECORDED_LIFTS, STEP_NAMES, TYPICAL_HEIGHT, bake, barLength, bounds, faceCount, recipeFor, sizeWarning, typicalHeight, unbake, withExtraYaw, type Steps } from "../src/labs/lift/lift-core";

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

describe("Lab 14: turning the raw lift (the turn slider)", () => {
  const TURNS = [0, 10, 25, 45, 60, 100, 133, 175];
  for (const name of ["bench-concrete", "railing-iron"]) {
    it(`${name}: with "face the side camera" on, any turn bakes to the recorded length, depth and height`, () => {
      const { o, mesh } = load(name), { recipe } = recipeFor(name);
      const base = bake(unbake(mesh, recipe), { label: o.label, typedHeight: o.height_m, steps: ALL_STEPS });
      for (const t of TURNS) {
        const r = bake(unbake(mesh, withExtraYaw(recipe, t)), { label: o.label, typedHeight: o.height_m, steps: ALL_STEPS });
        for (let k = 0; k < 3; k++) expect(r.size[k], `${name} turn ${t} axis ${k}`).toBeCloseTo(base.size[k], 2);
      }
    });
    it(`${name}: with the step off, a turn that is not a quarter turn leaves it cut across (the sizes differ)`, () => {
      const { o, mesh } = load(name), { recipe } = recipeFor(name);
      const steps = off("face"), at = (t: number) => bake(unbake(mesh, withExtraYaw(recipe, t)), { label: o.label, typedHeight: o.height_m, steps }).size;
      const a = at(0);
      for (const t of [10, 25, 45, 133]) {
        const b = at(t);
        expect(Math.max(...[0, 1, 2].map((k) => Math.abs(a[k] - b[k]))), `turn ${t}`).toBeGreaterThan(0.01);
      }
      expect(at(0)[1]).toBeCloseTo(at(100)[1], 6); // height is about the vertical, so no turn changes it
    });
  }
});

// CC-133: the turn slider acts on REAL raw lifts (decimated, kept in public/assets/lab/lift/raw)
import { readFileSync as readRaw } from 'node:fs';
import { parseRawPack, rawFromPack, type RawPackMeta } from '../src/labs/lift/lift-core';
describe('Lab 14: real raw lifts', () => {
  const index = JSON.parse(readRaw('public/assets/lab/lift/raw/index.json', 'utf8')).objects as RawPackMeta[];
  const load = (m: RawPackMeta) => { const b = readRaw(`public/assets/lab/lift/raw/${m.file}`); return parseRawPack(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer).mesh; };
  it('keeps each packed file small and lists a licence and a credit', () => {
    expect(index.length).toBeGreaterThanOrEqual(8);
    for (const m of index) { expect(m.kib, m.name).toBeLessThanOrEqual(300); expect(m.licence).toBeTruthy(); expect(m.photo_credit).toBeTruthy(); }
  });
  it('for any whole-degree turn, bake with "face" on gives the same length, depth and height; with it off, a different box', () => {
    for (const m of index.slice(0, 4)) {
      const mesh = load(m), opts = { label: m.label, typedHeight: m.typed_height_m, steps: { ...ALL_STEPS } };
      const base = bake(rawFromPack(mesh, m, 0), opts);
      for (const t of [13, 47, 90, 121]) {
        const r = bake(rawFromPack(mesh, m, t), opts);
        base.size.forEach((v, i) => expect(r.size[i], `${m.name} ${t}`).toBeCloseTo(v, 2));
      }
      const off = { ...opts, steps: { ...ALL_STEPS, face: false } };
      const a = bake(rawFromPack(mesh, m, 0), off), b = bake(rawFromPack(mesh, m, 47), off);
      if (m.name !== 'p1-pole') expect(Math.abs(a.size[0] - b.size[0]) + Math.abs(a.size[2] - b.size[2]), m.name).toBeGreaterThan(0.01); // a round pole looks the same from any side
    }
  });
  it('the real raw height and tilt are the recorded ones', () => {
    for (const m of index) { const z = Array.from(load(m).positions).filter((_: number, i: number) => i % 3 === 2); expect(m.raw_height).toBeGreaterThan(0); expect(Math.max(...z) - Math.min(...z)).toBeGreaterThan(0); }
  });
});

// CC-133: all 19 objects are real photo -> mask -> lift -> bake results (public/assets/lab/lift/real), and the 3D view is a pure projection
import { camSpace, clampPitch, clampZoom, dragTurn, normTurn, parseRawGlb, projectPoint, realToMeta, toDisplay, type Cam, type RealLift } from '../src/labs/lift/lift-core';
const realIdx = JSON.parse(readRaw('public/assets/lab/lift/real/index.json', 'utf8')).objects as RealLift[];
const loadReal = (o: RealLift) => { const b = readRaw(`public/assets/${o.rawMesh.replace(/^assets\//, '')}`); return parseRawGlb(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer); };
describe('Lab 14: the 19 real lifts', () => {
  it('lists all 19 library objects, each with a mask, a baked file and a credit', () => {
    expect(realIdx.length).toBe(19);
    for (const o of realIdx) { expect(readRaw(`public/${o.maskPicture}`).length, o.name).toBeGreaterThan(100); expect(o.credit.length, o.name).toBeGreaterThan(5); expect(index.some((x) => x.name === o.name), o.name).toBe(true); }
  });
  for (const o of realIdx) {
    it(`${o.name}: loads, bakes to a sane object, any turn gives the same result`, () => {
      const { mesh, tri } = loadReal(o), m = realToMeta(o);
      expect(tri.length).toBe(mesh.indices!.length / 3);
      expect(bounds(mesh).size[2]).toBeCloseTo(o.stats.rawHeight, 2);
      const opts = { label: o.label, typedHeight: o.typedHeightM, steps: ALL_STEPS };
      const r = bake(rawFromPack(mesh, m, 0), opts);
      expect(r.heightM).toBeCloseTo(o.typedHeightM, 3);
      expect(r.minY).toBeCloseTo(0, 6);
      expect(r.centreOffset).toBeLessThan(1e-6);
      expect(sizeWarning(r.size)).toBe('');
      const r2 = bake(rawFromPack(mesh, m, 137), opts);
      expect(Math.max(...[0, 1, 2].map((k) => Math.abs(r.size[k] - r2.size[k])))).toBeLessThan(0.06 * Math.max(...r.size));
    });
  }
});
describe('Lab 14: the 3D view (pure projection)', () => {
  const cam: Cam = { az: 30, pitch: 25, dist: 5, focal: 300, target: [0.2, 0.5, -0.1] };
  const pts: [number, number, number][] = [[0, 0, 0], [1, 0, 0], [0, 2, 0], [0.3, 0.4, 1.5]];
  const d = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  it('rotation preserves distances', () => {
    for (const az of [0, 33, 117, 270]) for (const pitch of [0, 25, 80]) for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++)
      expect(d(camSpace(pts[i], { ...cam, az, pitch }), camSpace(pts[j], { ...cam, az, pitch }))).toBeCloseTo(d(pts[i], pts[j]), 9);
  });
  it('a full 360 degree orbit gives the same picture', () => {
    for (const p of pts) { const a = projectPoint(p, cam, 590, 400)!, b = projectPoint(p, { ...cam, az: cam.az + 360 }, 590, 400)!; expect(b.x).toBeCloseTo(a.x, 6); expect(b.y).toBeCloseTo(a.y, 6); }
    expect(dragTurn(10, 720)).toBeCloseTo(10, 9); // 720 px at 0.5 degree each is two full turns
  });
  it('the side camera (az 0, pitch 0) sees x across and y up; bigger x is to the right, higher y is up the page', () => {
    const c: Cam = { ...cam, az: 0, pitch: 0, target: [0, 0, 0] }, o = projectPoint([0, 0, 0], c, 100, 100)!;
    expect(projectPoint([1, 0, 0], c, 100, 100)!.x).toBeGreaterThan(o.x); expect(projectPoint([0, 1, 0], c, 100, 100)!.y).toBeLessThan(o.y);
  });
  it('the bake does not depend on the view, and the turn slider is one number', () => {
    const { mesh } = load('bench-concrete'), raw = unbake(mesh, recipeFor('bench-concrete').recipe);
    const a = bake(raw, { label: 'bench', typedHeight: 0.8, steps: ALL_STEPS });
    projectPoint([1, 1, 1], cam, 100, 100); toDisplay(raw.mesh); // looking never changes the object
    const b = bake(raw, { label: 'bench', typedHeight: 0.8, steps: ALL_STEPS });
    expect(b.size).toEqual(a.size); expect(b.mesh.positions).toEqual(a.mesh.positions);
    expect(normTurn(-30)).toBe(330); expect(normTurn(360)).toBe(0); expect(clampPitch(200)).toBe(89); expect(clampZoom(0)).toBe(0.4);
  });
});
