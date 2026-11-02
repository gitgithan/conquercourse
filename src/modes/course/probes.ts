import * as THREE from 'three/webgpu';
import type { CourseData } from '../../course/course';
import { measureFacing } from '../../characters/facing';
import { makeObstacle } from '../../course/collide';
import { feetOf } from '../../sim/holds';
import { topAt } from '../../sim/beam';
import type { createRookieActor } from '../../render/actor';
import type { CourseCamera } from './camera';
import type { CourseState } from './state';

type Actor = Awaited<ReturnType<typeof createRookieActor>>;

export interface ProbeDeps {
  course: CourseData;
  params: URLSearchParams;
  st: CourseState;
  camera: THREE.PerspectiveCamera;
  frontCam: THREE.PerspectiveCamera;
  renderer: { domElement: HTMLCanvasElement };
  cam: CourseCamera;
  body: THREE.Mesh;
  wear: { state(): object };
  actor: () => Actor | null;
  ledge: { x: number; y: number } | undefined;
}

// The test hooks: what the player sees (?probe=1), what the camera and the look are doing (?camprobe=1), and the measures the checks read (?check=1). None of them change the game.
export function mountProbes(deps: ProbeDeps) {
  const { course, params, st, camera, frontCam, renderer, cam, body, wear, ledge } = deps;
  const actorNow = deps.actor;
  let maxPen = 0, handErr = 9;

  // ?probe=1: where the runner moved, where its toe bone points, and which way its SKIN faces, all on screen (docs/character-facing-bug.md)
  if (params.get('probe') === '1') (window as unknown as { __heading: () => unknown }).__heading = () => {
    const actor = actorNow(); if (!actor) return null;
    const names = actor.names(), J = actor.joints(), at = (n: string) => J[names.indexOf(n)];
    const toe = at('LeftToeBase'), foot = at('LeftFoot');
    const skinned: any[] = []; actor.object.traverse((o: any) => { if (o.isSkinnedMesh) skinned.push(o); }); // eslint-disable-line @typescript-eslint/no-explicit-any
    const m = skinned.sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count)[0];
    if (!m) return { x: actor.object.position.x, boneToeDx: toe.x - foot.x, skin: null };
    m.updateMatrixWorld(true); m.skeleton.update();
    const n = m.geometry.attributes.position.count, P = new Float32Array(n * 3), v = new (actor.joints()[0].constructor as new () => { x: number; y: number; z: number })();
    for (let i = 0; i < n; i++) { m.getVertexPosition(i, v); (v as any).applyMatrix4(m.matrixWorld); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z; } // eslint-disable-line @typescript-eslint/no-explicit-any
    const bn: string[] = m.skeleton.bones.map((b: any) => b.name), rest = bn.map((nm) => { const j = at(nm); return j ? [j.x, j.y, j.z] as [number, number, number] : [0, 0, 0] as [number, number, number]; }); // eslint-disable-line @typescript-eslint/no-explicit-any
    const toward = (dir: 1 | -1) => measureFacing(P, bn, rest, [dir, 0]);
    const f = toward(1);
    const hips = at('Hips'), sp = (new (hips.constructor as new () => { x: number; y: number; z: number; set(x: number, y: number, z: number): unknown; project(c: unknown): unknown })()); sp.set(hips.x, hips.y, hips.z); sp.project(camera);
    return { screen: { x: (sp.x * 0.5 + 0.5) * renderer.domElement.clientWidth, y: (-sp.y * 0.5 + 0.5) * renderer.domElement.clientHeight }, heading: Math.cos(actor.object.rotation.y), hipsX: hips.x, x: actor.object.position.x, rotY: actor.object.rotation.y, boneToeDx: toe.x - foot.x, skinScoreRight: f.score, skinConfidenceRight: f.confidence, votes: f.votes.map((q) => [q.name, +q.score.toFixed(3)]) };
  };
  // ?camprobe=1: for scripts/course-camera-characterize.mjs (CC-133); nothing else changes
  if (params.get('camprobe') === '1') (window as unknown as { __probe: () => unknown }).__probe = () => {
    const d = camera.getWorldDirection(new THREE.Vector3());
    return { pos: camera.position.toArray(), dir: d.toArray(), up: camera.up.toArray(), fov: camera.fov, aspect: camera.aspect, camMode: cam.mode(), orbit: { ...cam.orbit }, actor: actorNow() ? actorNow()!.object.visible : null, body: body.visible, ...wear.state(), clipping: st.clip.on, pip: cam.pipFrame.style.display, frontCam: frontCam.position.toArray(), frontDir: frontCam.getWorldDirection(new THREE.Vector3()).toArray() };
  };
  // measurements for the tests, once per picture
  return (r: { x: number; y: number }) => {
    const actor = actorNow();
    if (params.get('check') === '1' && actor && ledge && st.world.mode === 'wall') {
      // how close the nearest hand gets to the wall's top edge while the climb is on
      const j = actor.joints();
      const hands = j.filter((_, i) => /Hand$/.test(actor!.names()[i]));
      const err = Math.min(...hands.map((h) => Math.hypot(h.x - ledge.x, h.y - ledge.y)));
      handErr = Math.min(handErr, err);
      document.documentElement.dataset.handErr = handErr.toFixed(3);
    }
    if (params.get('check') === '1' && actor) {
      // measurement for the tests: the deepest any joint sits inside a block or the wall, over the whole run (metres)
      const hit = makeObstacle(course);
      actor.joints().forEach((j, i) => { const o = hit(j.x, j.y, 0); if (o && Math.hypot(o.dx, o.dy) > maxPen) { maxPen = Math.hypot(o.dx, o.dy); document.documentElement.dataset.maxPenWhere = `${st.world.mode} x=${r.x.toFixed(1)} y=${r.y.toFixed(1)} joint=${i} at (${j.x.toFixed(2)}, ${j.y.toFixed(2)})`; } });
      document.documentElement.dataset.maxPen = maxPen.toFixed(3);
    }
  };
}

// ?hangtest=1.0 (radians) hangs the runner still on the first bar at that angle, for the pivot screenshots; ?planktest=0.5 stands it still on the first plank, that share of the way across, for the sag screenshots.
// Returns true when the runner is held, so the simulator is not stepped.
export function poseForShots(course: CourseData, params: URLSearchParams, st: CourseState): boolean {
  const hangTest = params.get('hangtest') !== null && course.holds?.length ? Number(params.get('hangtest')) : null;
  const plankTest = params.get('planktest') !== null && course.planks?.length ? Number(params.get('planktest')) : null;
  if (plankTest !== null) {
    const pk = course.planks![0], a = plankTest * (pk.x1 - pk.x0);
    st.world = { ...st.world, mode: 'plank', plank: { i: 0, v: 0, sagged: true }, runner: { ...st.world.runner, x: pk.x0 + a, y: topAt(pk, a, pk.x0 + a), vx: 0, vy: 0, grounded: true } };
  }
  if (hangTest !== null) {
    const f = feetOf(course.holds![0], { hold: 0, theta: hangTest, omega: 0 });
    st.world = { ...st.world, mode: 'hang', hang: { hold: 0, theta: hangTest, omega: 0 }, runner: { ...st.world.runner, x: f.x, y: f.y, vx: 0, vy: 0, grounded: false } };
  }
  return hangTest !== null || plankTest !== null;
}
