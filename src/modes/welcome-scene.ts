import * as THREE from 'three/webgpu';
import { Vector3 } from 'three/webgpu';
import { loadClip, type Clip, type Phase } from '../motion/clip';
import { DemoMotion, legLength, type Clips } from '../motion/timeline';
import { TICKS_PER_SECOND } from '../sim/units';
import { loadRookie, type RookieId } from '../render/rookie';
import { createStage } from '../render/scene';

// The 3D background of the welcome screen (CC-246): the two Rookies run in place while a small toon park scrolls past and the camera drifts.
// Loaded after the first paint. With reduced motion everything stands still (one frame is drawn).

const PHASES: Phase[] = ['run', 'leap', 'land', 'hang', 'swing'];
const WRAP_M = 36; // the scenery repeats every 36 m
const FIRST_TICK = 600, LAST_TICK = 8800, PERIOD = 9000; // the run after the first leap and landing
const SEATS: { id: RookieId; x: number; z: number; lag: number }[] = [{ id: 'a', x: -4.6, z: 0, lag: 0 }, { id: 'b', x: 4.6, z: 0, lag: 24 }];

const mat = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 1 });
const box = (w: number, h: number, d: number, color: number, x: number, y: number, z: number) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)); m.position.set(x, y + h / 2, z); return m;
};
const cyl = (r: number, h: number, color: number, x: number, y: number, z: number) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), mat(color)); m.position.set(x, y + h / 2, z); return m;
};

/** One stretch of park: a clear lane with the obstacles on its far side, and trees and hills behind it. Built once and repeated. */
function stretch(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(WRAP_M, 0.02, 3.2, 0xe8c58a, WRAP_M / 2, 0, 0)); // the running lane
  for (let x = 2; x < WRAP_M; x += 6) g.add(box(0.12, 0.03, 3.2, 0xfff3d6, x, 0, 0)); // lane stripes
  const orange = 0xff9a3c, teal = 0x0f6b5c, cream = 0xf4f1ea;
  g.add(box(1.6, 0.9, 1.2, orange, 7, 0, -2.6)); // a box to leap, beside the lane
  g.add(box(2.4, 1.4, 0.4, teal, 15, 0, -2.6)); // a wall to climb, beside the lane
  // a pull-up bar frame
  g.add(cyl(0.05, 2.4, cream, 22, 0, -2.6), cyl(0.05, 2.4, cream, 25, 0, -2.6));
  const bar = cyl(0.05, 3, cream, 23.5, 2.4, -2.6); bar.rotation.z = Math.PI / 2; g.add(bar);
  // a row of poles
  for (let i = 0; i < 4; i++) g.add(cyl(0.12, 1.1, 0x6b4eff, 29 + i * 1.3, 0, -2.6));
  g.add(box(2, 0.5, 0.8, orange, 33, 0, -2.6));
  // trees and bushes behind
  for (let x = 1; x < WRAP_M; x += 4.5) {
    const z = -4 - ((x * 7) % 5), h = 1.6 + ((x * 13) % 3) * 0.5;
    g.add(cyl(0.18, h, 0x8a5a2b, x, 0, z));
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.1 + (x % 3) * 0.2, 14, 10), mat(x % 2 ? 0x4f9d4a : 0x6bb85a));
    crown.position.set(x, h + 0.7, z); g.add(crown);
  }
  for (let x = 3; x < WRAP_M; x += 9) { // far hills
    const hill = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 12), mat(0x7fb86a));
    hill.scale.set(1.8, 0.7, 1); hill.position.set(x, -2, -26); g.add(hill);
  }
  return g;
}

export async function mountWelcomeScene(host: HTMLElement, still: boolean): Promise<void> {
  const stage = await createStage(host, false);
  const { scene, camera, renderer } = stage;
  scene.background = new THREE.Color(0xa9d3f2);
  scene.fog = new THREE.Fog(0xcfe6f7, 18, 60);
  stage.rookie.visible = false;

  const world = new THREE.Group(); scene.add(world);
  for (const k of [-1, 0, 1]) { const s = stretch(); s.position.x = k * WRAP_M; world.add(s); }

  const clips = Object.fromEntries(await Promise.all(PHASES.map(async (p) => [p, await loadClip(p)]))) as Record<Phase, Clip>;
  const run = clips.run;
  const clipLeg = legLength(run.names, (i) => new Vector3(...run.frames[0][i]));
  const runners = await Promise.all(SEATS.map(async (s) => {
    const rookie = await loadRookie(s.id, run.names, run.parents);
    scene.add(rookie.object);
    return { ...s, rookie, motion: new DemoMotion(clips as Clips, rookie.legLength / clipLeg, PERIOD) };
  }));
  // how fast the Rookie covers the ground while running: the scenery scrolls by exactly that, so the feet do not slide
  const m0 = runners[0].motion;
  const speed = (m0.pose(LAST_TICK).hips.x - m0.pose(FIRST_TICK).hips.x) / ((LAST_TICK - FIRST_TICK) / TICKS_PER_SECOND);

  const draw = (sec: number) => {
    const span = LAST_TICK - FIRST_TICK;
    for (const r of runners) {
      const tick = FIRST_TICK + (Math.floor(sec * TICKS_PER_SECOND) + r.lag) % span;
      const pose = r.motion.pose(tick);
      r.rookie.apply(pose.joints.map((j) => new Vector3(j.x - pose.hips.x + r.x, j.y, j.z + r.z)));
    }
    world.position.x = -((sec * speed) % WRAP_M);
    camera.position.set(Math.sin(sec * 0.12) * 1.3, 1.7 + Math.sin(sec * 0.09) * 0.25, 8.6 + Math.sin(sec * 0.07) * 0.6);
    camera.lookAt(Math.sin(sec * 0.12) * 0.5, 1.25, 0);
  };
  draw(0);
  host.dataset.ready = 'true';
  document.documentElement.dataset.welcomeScene = stage.backend;
  if (still) { renderer.setAnimationLoop(null); renderer.render(scene, camera); return; }
  const t0 = performance.now();
  renderer.setAnimationLoop(() => { draw((performance.now() - t0) / 1000); renderer.render(scene, camera); });
}
