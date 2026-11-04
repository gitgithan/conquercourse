import * as THREE from "three";

// Camera and perspective (the maths, no screen code).
// It uses the same three.js PerspectiveCamera the game draws with, and the same pixel-to-ray step the editor uses (Raycaster.setFromCamera).
// World axes are the game's: the runner goes along +x, up is +y, the right side of the body is +z.
// Camera angle 0 deg stands on +x looking back at the runner's face (the front view); 90 deg stands on +z (the side view).

export const IMG = 380; // each picture is IMG x IMG pixels
export const BODY_H = 1.8; // m
export const TARGET = new THREE.Vector3(0, 0.9, 0); // the middle of the body, where every camera looks

export const JOINTS = ["hips", "chest", "neck", "head", "shoulderL", "shoulderR", "elbowL", "wristL", "elbowR", "wristR", "hipL", "hipR", "kneeL", "ankleL", "kneeR", "ankleR"] as const;
export type JointName = (typeof JOINTS)[number];
const J = (n: JointName) => JOINTS.indexOf(n);
export const PARENT: number[] = [-1, 0, 1, 2, 1, 1, 4, 6, 5, 8, 0, 0, 10, 12, 11, 14];
export const BONES: [number, number][] = PARENT.map((p, i) => [p, i] as [number, number]).filter(([p]) => p >= 0);

// Pose A: a vault reach. The right arm reaches toward the front camera, the left trails; the right leg kicks forward.
const A_POS: Record<JointName, [number, number, number]> = {
  hips: [0, 0.95, 0], chest: [0.06, 1.38, 0], neck: [0.1, 1.55, 0], head: [0.12, 1.7, 0],
  shoulderL: [0.06, 1.38, -0.2], shoulderR: [0.06, 1.38, 0.2],
  elbowL: [-0.14, 1.26, -0.27], wristL: [-0.4, 1.2, -0.22],
  elbowR: [0.3, 1.5, 0.24], wristR: [0.55, 1.62, 0.2],
  hipL: [0, 0.95, -0.1], hipR: [0, 0.95, 0.1],
  kneeL: [-0.1, 0.55, -0.1], ankleL: [-0.38, 0.2, -0.1],
  kneeR: [0.3, 0.85, 0.12], ankleR: [0.64, 0.7, 0.12],
};
export const poseA = (): THREE.Vector3[] => JOINTS.map((n) => new THREE.Vector3(...A_POS[n]));

export interface CamSettings { fov: number; height: number; angle: number; keepSize: boolean; dist: number }
export const DEFAULT_CAM: CamSettings = { fov: 40, height: 1.2, angle: 0, keepSize: true, dist: 6 };
export const SECOND_ANGLE_DEFAULT = 90;
export const clampCam = (c: CamSettings): CamSettings => ({
  fov: Math.min(100, Math.max(8, c.fov)), height: Math.min(4.5, Math.max(0.2, c.height)),
  angle: Math.min(180, Math.max(0, c.angle)), keepSize: !!c.keepSize, dist: Math.min(60, Math.max(1.5, c.dist)),
});

// How far the camera stands (flat distance from the body's middle).
// Keeping the body the same size on screen means moving back as the lens zooms in: 75% of the picture height is the body.
export function cameraDistance(c: CamSettings): number {
  if (!c.keepSize) return c.dist;
  return (BODY_H / 0.75 / 2) / Math.tan((c.fov * Math.PI) / 360);
}

export function makeCamera(c0: CamSettings): THREE.PerspectiveCamera {
  const c = clampCam(c0), a = (c.angle * Math.PI) / 180, d = cameraDistance(c);
  const cam = new THREE.PerspectiveCamera(c.fov, 1, 0.05, 1000);
  cam.position.set(d * Math.cos(a), c.height, d * Math.sin(a));
  cam.up.set(0, 1, 0);
  cam.lookAt(TARGET);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
}

// Field of view to focal length in pixels: f = (H/2) / tan(fov/2).
export const focalPx = (fovDeg: number, h = IMG): number => h / 2 / Math.tan((fovDeg * Math.PI) / 360);
export const tiltDeg = (cam: THREE.PerspectiveCamera): number => { const d = new THREE.Vector3(); cam.getWorldDirection(d); return (Math.asin(d.y) * 180) / Math.PI; };

export interface Px { x: number; y: number; depth: number }
// 3D point to picture pixel with the camera's own projection matrix; depth is the distance along the view direction.
export function toPx(cam: THREE.PerspectiveCamera, p: THREE.Vector3): Px {
  const q = p.clone().applyMatrix4(cam.matrixWorldInverse);
  const n = q.clone().applyMatrix4(cam.projectionMatrix);
  return { x: ((n.x + 1) / 2) * IMG, y: ((1 - n.y) / 2) * IMG, depth: -q.z };
}

// A line segment in the picture, cut at the near plane so a point behind the camera never draws.
export function segmentPx(cam: THREE.PerspectiveCamera, a: THREE.Vector3, b: THREE.Vector3): [Px, Px] | null {
  const qa = a.clone().applyMatrix4(cam.matrixWorldInverse), qb = b.clone().applyMatrix4(cam.matrixWorldInverse);
  const near = 0.1;
  if (-qa.z < near && -qb.z < near) return null;
  const cut = (inside: THREE.Vector3, outside: THREE.Vector3) => { const t = (-inside.z - near) / (-inside.z + outside.z); return inside.clone().lerp(outside, t); };
  if (-qa.z < near) qa.copy(cut(qb, qa)); else if (-qb.z < near) qb.copy(cut(qa, qb));
  const f = (q: THREE.Vector3): Px => { const n = q.clone().applyMatrix4(cam.projectionMatrix); return { x: ((n.x + 1) / 2) * IMG, y: ((1 - n.y) / 2) * IMG, depth: -q.z }; };
  return [f(qa), f(qb)];
}

// Pixel to ray, the editor's step: Raycaster.setFromCamera.
export function rayThroughPixel(cam: THREE.PerspectiveCamera, x: number, y: number): THREE.Ray {
  const r = new THREE.Raycaster();
  r.setFromCamera(new THREE.Vector2((x / IMG) * 2 - 1, -((y / IMG) * 2 - 1)), cam);
  return r.ray.clone();
}

// ---- the second pose: the same photo, a different body ----
export type Limb = "armR" | "armL" | "legR" | "legL";
export const LIMBS: Limb[] = ["armR", "armL", "legR", "legL"];
export const LIMB_JOINTS: Record<Limb, [number, number]> = { armR: [J("elbowR"), J("wristR")], armL: [J("elbowL"), J("wristL")], legR: [J("kneeR"), J("ankleR")], legL: [J("kneeL"), J("ankleL")] };
export const LIMB_LABEL: Record<Limb, string> = { armR: "right arm", armL: "left arm", legR: "right leg", legL: "left leg" };

export interface Alt { pose: THREE.Vector3[]; approx: number[] } // approx: joints with no exact answer (bone too short to reach the ray), put at the nearest spot
// Keep every bone length and put each flipped joint on the same ray from the front camera (so the front photo cannot change).
// A joint on its ray has two spots a bone-length from its parent: the near one and the far one. A flipped joint takes the one A did not.
export function altPose(a: THREE.Vector3[], front: THREE.PerspectiveCamera, flips: Limb[]): Alt {
  const o = front.position, b = a.map((p) => p.clone()), approx: number[] = [];
  const flipped = new Set<number>();
  for (const l of flips) for (const j of LIMB_JOINTS[l]) flipped.add(j);
  for (let i = 0; i < a.length; i++) {
    const p = PARENT[i];
    if (p < 0 || !flipped.has(i)) { if (p >= 0 && !flipped.has(i)) b[i].copy(a[i]); continue; }
    const len = a[i].distanceTo(a[p]), u = a[i].clone().sub(o).normalize(), tA = a[i].distanceTo(o);
    const w = o.clone().sub(b[p]), uw = u.dot(w), disc = uw * uw - (w.lengthSq() - len * len);
    if (disc < 0) { b[i].copy(o).addScaledVector(u, -uw); approx.push(i); continue; }
    const s = Math.sqrt(disc), t1 = -uw - s, t2 = -uw + s;
    const t = Math.abs(t1 - tA) > Math.abs(t2 - tA) ? t1 : t2; // the root farthest from where A was
    b[i].copy(o).addScaledVector(u, t);
  }
  return { pose: b, approx };
}

// Largest gap between two pictures of the same joints, in pixels.
export function maxPixelGap(cam: THREE.PerspectiveCamera, p: THREE.Vector3[], q: THREE.Vector3[]): number {
  let m = 0;
  p.forEach((v, i) => { const a = toPx(cam, v), b = toPx(cam, q[i]); m = Math.max(m, Math.hypot(a.x - b.x, a.y - b.y)); });
  return m;
}
export const maxDepthGap = (p: THREE.Vector3[], q: THREE.Vector3[], cam: THREE.PerspectiveCamera): number => Math.max(...p.map((v, i) => Math.abs(toPx(cam, v).depth - toPx(cam, q[i]).depth)));
export const maxBoneChange = (p: THREE.Vector3[], q: THREE.Vector3[]): number => Math.max(...BONES.map(([x, y]) => Math.abs(p[x].distanceTo(p[y]) - q[x].distanceTo(q[y]))));

// ---- numbers ----
// Vanishing point of every line that runs in world direction d: where it lands in the picture, or null if d runs parallel to the picture plane.
export function vanishingPoint(cam: THREE.PerspectiveCamera, d: THREE.Vector3): { x: number; y: number } | null {
  const v = d.clone().transformDirection(cam.matrixWorldInverse);
  if (Math.abs(v.z) < 1e-6) return null;
  const s = v.z < 0 ? 1 : -1; // the far end of the line, in front of the camera
  const nx = (cam.projectionMatrix.elements[0] * v.x * s) / (-v.z * s), ny = (cam.projectionMatrix.elements[5] * v.y * s) / (-v.z * s);
  return { x: ((nx + 1) / 2) * IMG, y: ((1 - ny) / 2) * IMG };
}
// The horizon row: where the ground's vanishing line cuts the picture (null when the camera looks so far down that it is off the picture).
export function horizonRow(cam: THREE.PerspectiveCamera): number | null {
  const v = vanishingPoint(cam, new THREE.Vector3(1, 0, 0)) ?? vanishingPoint(cam, new THREE.Vector3(0, 0, 1));
  return v ? v.y : null;
}

export interface BoneRow { name: string; trueLen: number; shownPx: number; share: number }
export const FORESHORTEN_BONES: [string, JointName, JointName][] = [
  ["right upper arm", "shoulderR", "elbowR"], ["right forearm", "elbowR", "wristR"], ["right thigh", "hipR", "kneeR"], ["right shin", "kneeR", "ankleR"],
  ["left upper arm", "shoulderL", "elbowL"], ["left forearm", "elbowL", "wristL"], ["left thigh", "hipL", "kneeL"], ["left shin", "kneeL", "ankleL"],
];
// Share shown: the picture length divided by what the same bone would show if it lay across the picture at that depth. 1 = side-on, near 0 = pointing at the lens.
export function foreshortening(cam: THREE.PerspectiveCamera, pose: THREE.Vector3[]): BoneRow[] {
  const f = focalPx(cam.fov);
  return FORESHORTEN_BONES.map(([name, a, b]) => {
    const pa = toPx(cam, pose[J(a)]), pb = toPx(cam, pose[J(b)]), len = pose[J(a)].distanceTo(pose[J(b)]);
    const shownPx = Math.hypot(pa.x - pb.x, pa.y - pb.y), across = (f * len) / ((pa.depth + pb.depth) / 2);
    return { name, trueLen: len, shownPx, share: shownPx / across };
  });
}
// How much bigger the nearest joint looks than the farthest, from the same picture (depth ratio).
export function nearFarRatio(cam: THREE.PerspectiveCamera, pose: THREE.Vector3[]): number {
  const d = pose.map((p) => toPx(cam, p).depth);
  return Math.max(...d) / Math.min(...d);
}

// The camera numbers a person would read off.
export interface CamFacts { fovDeg: number; focalPx: number; dist: number; height: number; tilt: number; horizon: number | null; vpTrack: { x: number; y: number } | null; vpAcross: { x: number; y: number } | null; nearFar: number }
export function camFacts(cam: THREE.PerspectiveCamera, pose: THREE.Vector3[]): CamFacts {
  const flat = Math.hypot(cam.position.x, cam.position.z);
  return {
    fovDeg: cam.fov, focalPx: focalPx(cam.fov), dist: flat, height: cam.position.y, tilt: tiltDeg(cam), horizon: horizonRow(cam),
    vpTrack: vanishingPoint(cam, new THREE.Vector3(1, 0, 0)), vpAcross: vanishingPoint(cam, new THREE.Vector3(0, 0, 1)), nearFar: nearFarRatio(cam, pose),
  };
}

// The game's own cameras, from src/modes/course.ts (side view: field of view 40, 25 m back, a little above the runner; first person: 75).
export const GAME_SIDE: CamSettings = { fov: 40, height: 4, angle: 90, keepSize: false, dist: 25 };
export const GAME_FIRST_PERSON_FOV = 75;
