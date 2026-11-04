import type { Mesh } from "../../slice/slice";

// Cut-out and lift, then bake (pipeline stages 2 to 3 of the photo-to-object path).
// The real bake runs on the CPU in pipelines/ccpipe (Python) on a raw lift that came from a GPU, and the raw lifts are too big to ship.
// So this file writes the bake RULES from docs/pipelines.md step 4 in TypeScript, and the Lab proves them on a recorded, baked game object:
// "unbake" a recorded GLB into a raw-looking lift (z up, turned, tilted by the camera layout, wrong size, off the ground), then bake it again and check we get the recorded object back.

export const FACE_CAP = 6000;
/** Typical heights per label, metres (docs/pipelines.md step 4). */
export const TYPICAL_HEIGHT: Record<string, number> = { bench: 0.8, wall: 0.9, "low wall": 0.9, rail: 1.0, handrail: 1.0, ledge: 0.5, platform: 0.5, steps: 0.7, stairs: 0.7 };
export const typicalHeight = (label: string): number | null => TYPICAL_HEIGHT[label.trim().toLowerCase()] ?? null;

export interface Steps { noLayout: boolean; upright: boolean; face: boolean; ground: boolean; reduce: boolean; scale: boolean; colour: boolean }
export const ALL_STEPS: Steps = { noLayout: true, upright: true, face: true, ground: true, reduce: true, scale: true, colour: true };
export const STEP_NAMES: { key: keyof Steps; name: string; rule: string; breaks: string }[] = [
  { key: "noLayout", name: "Ignore the camera layout", rule: "The lift also gives a layout (turn, move, size in the camera's frame). The layout tilts the object by the camera's pitch, so the bake does not apply it.", breaks: "The object leans back by the camera's tilt, so its top is no longer flat and its height is wrong." },
  { key: "upright", name: "Turn z-up to y-up", rule: "The lift's mesh stands upright with z as up. The game has y as up, so turn it a quarter turn.", breaks: "The object lies on its side: its height becomes its depth." },
  { key: "face", name: "Face the side camera", rule: "Turn it about the vertical until its flat box on the floor is the smallest possible, with the longer side along x (the side camera's view).", breaks: "The object stays at whatever angle the lift gave it, so the side camera sees it cut across." },
  { key: "ground", name: "Centre and stand on the ground", rule: "Move it so its middle is at x = 0, z = 0 and its lowest point is at y = 0.", breaks: "The object floats, or sinks, or sits off to one side of where the course expects it." },
  { key: "reduce", name: "Reduce to 6,000 faces", rule: "Merge triangles (quadric reduction, tried again until under the cap) so a browser draws many objects.", breaks: "The object keeps its raw triangles: 84,204 to 387,796 of them for our four photos, many times what the game allows." },
  { key: "scale", name: "Scale to the typed height", rule: "Scale so the height is the number typed, else the typical height for the label.", breaks: "The object keeps the lift's own size, which is a guess in arbitrary units (a bench at 0.42)." },
  { key: "colour", name: "Take colour from the splat", rule: "Each texel of a 1024 x 1024 picture is coloured from its 4 nearest Gaussians (degree-0 colour 0.5 + 0.282 x dc).", breaks: "The object is plain grey." },
];

export interface Raw { mesh: Mesh; rawFaces: number; layoutPitchDeg: number }
export interface Bounds { min: [number, number, number]; max: [number, number, number]; size: [number, number, number] }

export function bounds(m: Mesh): Bounds {
  const p = m.positions, min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { if (p[i + k] < min[k]) min[k] = p[i + k]; if (p[i + k] > max[k]) max[k] = p[i + k]; }
  return { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
}
export const faceCount = (m: Mesh): number => (m.indices ? m.indices.length / 3 : m.positions.length / 9);

const map = (m: Mesh, f: (x: number, y: number, z: number) => [number, number, number]): Mesh => {
  const p = m.positions, out: number[] = new Array(p.length);
  for (let i = 0; i < p.length; i += 3) { const r = f(p[i], p[i + 1], p[i + 2]); out[i] = r[0]; out[i + 1] = r[1]; out[i + 2] = r[2]; }
  return { positions: out, indices: m.indices };
};
const rad = (d: number) => (d * Math.PI) / 180;

export interface UnbakeRecipe { yawDeg: number; pitchDeg: number; rawHeight: number; rawFaces: number; offset: [number, number, number] }
/** Turn a baked game object back into something that looks like a raw lift: z up, turned about the vertical, off the ground, in the lift's own size, carrying the camera layout's tilt. */
export function unbake(baked: Mesh, r: UnbakeRecipe): Raw {
  const b = bounds(baked), s = r.rawHeight / b.size[1], c = Math.cos(rad(r.yawDeg)), sn = Math.sin(rad(r.yawDeg));
  const mesh = map(baked, (x, y, z) => {
    // y-up to z-up: (x, y, z) -> (x, -z, y), then turn about z, then scale, then move off the ground
    const ux = x, uy = -z, uz = y;
    const tx = ux * c - uy * sn, ty = ux * sn + uy * c;
    return [tx * s + r.offset[0], ty * s + r.offset[1], uz * s + r.offset[2]];
  });
  return { mesh, rawFaces: r.rawFaces, layoutPitchDeg: r.pitchDeg };
}

/** The same raw lift, turned a further `extraDeg` about the vertical (the Lab's turn slider). The "face the side camera" step turns it back; with that step off the object stays cut across. */
export const withExtraYaw = (r: UnbakeRecipe, extraDeg: number): UnbakeRecipe => ({ ...r, yawDeg: r.yawDeg + extraDeg });

/** One real raw lift as kept in public/assets/lab/lift/raw (index.json holds the numbers; the .bin holds the decimated mesh and its vertex colours). */
export interface RawPackMeta { name: string; label: string; file: string; kib: number; photo_credit: string; licence: string; typed_height_m: number; scale_source: string; raw_height: number; raw_faces: number; drawn_faces: number; tilt_deg: number; yaw_deg_recorded: number; bake_factor: number; lift_seconds: number; usd_estimate: number }
/** Read a .bin written by scripts/lab-lift-rawpack.py: u32 vertices, u32 faces, float32 xyz, uint8 rgb, uint16 indices. Colours come back per triangle (the mean of its three corners). */
export function parseRawPack(buf: ArrayBuffer): { mesh: Mesh; tri: string[] } {
  const dv = new DataView(buf), nv = dv.getUint32(0, true), nf = dv.getUint32(4, true);
  const positions: number[] = new Array(nv * 3), indices: number[] = new Array(nf * 3), rgb = new Uint8Array(buf, 8 + nv * 12, nv * 3);
  for (let i = 0; i < nv * 3; i++) positions[i] = dv.getFloat32(8 + i * 4, true);
  const at = 8 + nv * 15;
  for (let i = 0; i < nf * 3; i++) indices[i] = dv.getUint16(at + i * 2, true);
  const tri: string[] = [];
  for (let t = 0; t < nf; t++) { let r = 0, g = 0, b = 0; for (let k = 0; k < 3; k++) { const v = indices[t * 3 + k]; r += rgb[v * 3]; g += rgb[v * 3 + 1]; b += rgb[v * 3 + 2]; } tri.push(`rgb(${Math.round(r / 3)},${Math.round(g / 3)},${Math.round(b / 3)})`); }
  return { mesh: { positions, indices }, tri };
}
/** A real raw lift, turned `extraDeg` about its own vertical (z) axis: the Lab's turn slider on real data. Orientation, size and tilt are the lift's own. */
export function rawFromPack(mesh: Mesh, meta: RawPackMeta, extraDeg: number): Raw {
  const c = Math.cos(rad(extraDeg)), s = Math.sin(rad(extraDeg));
  return { mesh: map(mesh, (x, y, z) => [x * c - y * s, x * s + y * c, z]), rawFaces: meta.raw_faces, layoutPitchDeg: meta.tilt_deg };
}

export interface BakeOptions { label: string; typedHeight: number | null; steps: Steps }
export interface BakeResult { mesh: Mesh; size: [number, number, number]; heightM: number; scaleSource: string; factor: number; faces: number; minY: number; centreOffset: number; tiltDeg: number; yawDeg: number }

/** The bake rules, in the order the pipeline applies them. Each step can be switched off to see what it was for. */
export function bake(raw: Raw, o: BakeOptions): BakeResult {
  const st = o.steps;
  let m = raw.mesh, tilt = 0;
  if (!st.noLayout) { const c = Math.cos(rad(raw.layoutPitchDeg)), s = Math.sin(rad(raw.layoutPitchDeg)); m = map(m, (x, y, z) => [x, y * c - z * s, y * s + z * c]); tilt = raw.layoutPitchDeg; } // applying the layout: tilt about x
  if (st.upright) m = map(m, (x, y, z) => [x, z, -y]); // z up to y up
  let yaw = 0;
  if (st.face) {
    let best = Infinity;
    for (let d = 0; d < 180; d += 0.5) { // smallest horizontal bounding box over turns about the vertical
      const c = Math.cos(rad(d)), s = Math.sin(rad(d));
      const t = map(m, (x, y, z) => [x * c - z * s, y, x * s + z * c]), b = bounds(t), area = b.size[0] * b.size[2];
      if (area < best - 1e-12) { best = area; yaw = d; }
    }
    const c = Math.cos(rad(yaw)), s = Math.sin(rad(yaw));
    m = map(m, (x, y, z) => [x * c - z * s, y, x * s + z * c]);
    const b = bounds(m);
    if (b.size[2] > b.size[0]) m = map(m, (x, y, z) => [z, y, -x]); // longer side along x
  }
  if (st.ground) { const b = bounds(m); m = map(m, (x, y, z) => [x - (b.min[0] + b.max[0]) / 2, y - b.min[1], z - (b.min[2] + b.max[2]) / 2]); }
  const target = o.typedHeight ?? typicalHeight(o.label), h0 = bounds(m).size[1];
  let factor = 1, source = "none (the lift's own size)";
  if (st.scale && target !== null && h0 > 0) { factor = target / h0; source = o.typedHeight !== null ? "typed" : `typical:${o.label.trim().toLowerCase()}`; m = map(m, (x, y, z) => [x * factor, y * factor, z * factor]); }
  const b = bounds(m);
  return { mesh: m, size: b.size, heightM: b.size[1], scaleSource: source, factor, faces: st.reduce ? Math.min(raw.rawFaces, FACE_CAP) : raw.rawFaces, minY: b.min[1], centreOffset: Math.hypot((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2), tiltDeg: tilt, yawDeg: yaw };
}

/** The thin-box lesson: a long thin bar is "height" in its thin direction, so a bigger typed height stretches the bar by the same factor. */
export const barLength = (typedHeight: number, extentAspect: number): number => typedHeight * extentAspect;
export const SIZE_LIMIT_M = 12;
export const sizeWarning = (size: [number, number, number]): string => Math.max(...size) > SIZE_LIMIT_M ? `${Math.max(...size).toFixed(1)} m is longer than any piece in the game; check the box and the typed height.` : "";

/** Recorded numbers (not computed here). Sources: docs/pipelines.md pipeline 7, the mesh.json files in data/eval/cc-38-photo-to-3d/r3, and the lift json files in docs/evidence/cc-133-lifts. */
export const RECORDED_COST = {
  lift_seconds_range: [8, 10] as [number, number], mask_seconds_range: [0.3, 2] as [number, number], per_object_seconds: 15, first_object_seconds: [90, 100] as [number, number], per_object_usd: 0.02,
  bakeSeconds: { bench01: 7.85, mural01: 5.59, mural02: 7.27, rail01: 8.98 } as Record<string, number>,
  monkeyBars: { mask_load_seconds: 14.5, lift_load_seconds: 44.3, mask_seconds: 0.3, lift_seconds: 9.2, wall_seconds: 113.2, usd_estimate: 0.0051, extent_aspect: 21.702 },
};
/** What we kept of the real lifts, per object in public/assets/objects (CC-38 round 3). */
export const RECORDED_LIFTS: Record<string, { photo: string; rawHeight: number; yawDeg: number; tiltDeg: number; rawFaces: number; bakedFaces: number; factor: number }> = {
  "bench-concrete": { photo: "bench01", rawHeight: 0.4246, yawDeg: 0, tiltDeg: 1.7, rawFaces: 387796, bakedFaces: 5820, factor: 1.8842 },
  "railing-iron": { photo: "rail01", rawHeight: 0.397, yawDeg: 90.5, tiltDeg: 1.55, rawFaces: 84204, bakedFaces: 5820, factor: 2.5186 },
};
/** Stand-in recipe for objects whose raw lift we did not keep. */
export const STAND_IN: UnbakeRecipe = { yawDeg: 37, pitchDeg: 12, rawHeight: 0.45, rawFaces: 150000, offset: [0.8, -1.1, 0.35] };
export function recipeFor(name: string): { recipe: UnbakeRecipe; recorded: boolean } {
  const r = RECORDED_LIFTS[name];
  // recorded raw size, turn and tilt where we have them; the turn is nudged off 0 so the "face the camera" step has work to do
  return r ? { recipe: { yawDeg: r.yawDeg || 37, pitchDeg: Math.max(r.tiltDeg, 12), rawHeight: r.rawHeight, rawFaces: r.rawFaces, offset: [0.8, -1.1, 0.35] }, recorded: true } : { recipe: STAND_IN, recorded: false };
}

/** One real raw lift from public/assets/lab/lift/real/index.json (photo, mask, lift, bake all recorded). */
export interface RealLift { name: string; label: string; photo: string; typedHeightM: number; credit: string; licence: string; rawMesh: string; maskPicture: string; bakedGlb: string; stats: { rawHeight: number; rawExtents: number[]; rawFaces: number; previewFaces: number; yawDeg: number; tiltDeg: number; costUsd: number; liftSeconds: number; maskSeconds: number; padded?: boolean } }
/** The numbers the turn slider and the bake need, in the shape the older raw packs use. */
export const realToMeta = (o: RealLift): RawPackMeta => ({ name: o.name, label: o.label, file: o.rawMesh, kib: 0, photo_credit: o.credit, licence: o.licence, typed_height_m: o.typedHeightM, scale_source: "typed", raw_height: o.stats.rawHeight, raw_faces: o.stats.rawFaces, drawn_faces: o.stats.previewFaces, tilt_deg: o.stats.tiltDeg, yaw_deg_recorded: o.stats.yawDeg, bake_factor: 0, lift_seconds: o.stats.liftSeconds, usd_estimate: o.stats.costUsd });

/** Read a raw lift preview .glb (z up, POSITION + COLOR_0 uint8 normalized, uint16 indices). Colours come back per triangle as "rgb(r,g,b)". */
export function parseRawGlb(buf: ArrayBuffer): { mesh: Mesh; tri: string[] } {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error("not a .glb file");
  let json: any = null, bin = 0;
  for (let at = 12; at < dv.byteLength;) { const len = dv.getUint32(at, true), type = dv.getUint32(at + 4, true); if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, at + 8, len))); else if (type === 0x004e4942) bin = at + 8; at += 8 + len + ((4 - (len % 4)) % 4); }
  const prim = json.meshes[0].primitives[0];
  const read = (acc: number, w: number, size: number, get: (at: number) => number): number[] => {
    const a = json.accessors[acc], bv = json.bufferViews[a.bufferView], base = bin + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0), stride = bv.byteStride ?? size * w, out: number[] = [];
    for (let i = 0; i < a.count; i++) for (let k = 0; k < w; k++) out.push(get(base + i * stride + k * size));
    return out;
  };
  const positions = read(prim.attributes.POSITION, 3, 4, (at) => dv.getFloat32(at, true));
  const ia = json.accessors[prim.indices], indices = ia.componentType === 5125 ? read(prim.indices, 1, 4, (at) => dv.getUint32(at, true)) : read(prim.indices, 1, 2, (at) => dv.getUint16(at, true));
  const col = prim.attributes.COLOR_0 !== undefined ? read(prim.attributes.COLOR_0, 3, 1, (at) => dv.getUint8(at)) : null;
  const tri: string[] = [];
  for (let t = 0; t < indices.length / 3; t++) { let r = 160, g = 160, b = 160; if (col) { r = g = b = 0; for (let k = 0; k < 3; k++) { const v = indices[t * 3 + k]; r += col[v * 3] / 3; g += col[v * 3 + 1] / 3; b += col[v * 3 + 2] / 3; } } tri.push(`rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`); }
  return { mesh: { positions, indices }, tri };
}

// ---- the 3D view: one pure projection, shared by every picture the Lab draws in 3D ----
/** Raw lifts are z up; the picture is y up. (x, y, z) -> (x, z, -y). */
export const toDisplay = (m: Mesh): Mesh => map(m, (x, y, z) => [x, z, -y]);
/** Turntable angle of the raw lift, 0 to 360 (the slider shows the same number). Dragging adds `dxPixels` times `degPerPixel`. */
export const normTurn = (deg: number): number => ((deg % 360) + 360) % 360;
export const dragTurn = (turn: number, dxPixels: number, degPerPixel = 0.5): number => normTurn(turn + dxPixels * degPerPixel);
export const clampPitch = (deg: number): number => Math.max(-10, Math.min(89, deg));
export const clampZoom = (z: number): number => Math.max(0.4, Math.min(4, z));
export interface Cam { az: number; pitch: number; dist: number; focal: number; target: [number, number, number] }
/** Move a point into the camera's frame: relative to the target, turned by the azimuth about y, then tipped by the pitch. Only turns, so distances are kept. az 0 = the side camera (looks along -z, x across, y up). */
export function camSpace(p: [number, number, number], cam: Pick<Cam, "az" | "pitch" | "target">): [number, number, number] {
  const a = rad(cam.az), q = rad(cam.pitch), x = p[0] - cam.target[0], y = p[1] - cam.target[1], z = p[2] - cam.target[2];
  const x1 = x * Math.cos(a) - z * Math.sin(a), z1 = x * Math.sin(a) + z * Math.cos(a);
  return [x1, y * Math.cos(q) - z1 * Math.sin(q), y * Math.sin(q) + z1 * Math.cos(q)];
}
/** Perspective: pixel position and how far in front of the camera (null when behind it). */
export function projectPoint(p: [number, number, number], cam: Cam, W: number, H: number): { x: number; y: number; depth: number } | null {
  const c = camSpace(p, cam), depth = cam.dist - c[2];
  if (depth < 0.05 * cam.dist) return null;
  return { x: W / 2 + (cam.focal * c[0]) / depth, y: H / 2 - (cam.focal * c[1]) / depth, depth };
}
