import * as THREE from 'three/webgpu';
import { Vector3 } from 'three/webgpu';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadClip, type Clip, type Phase } from '../motion/clip';
import { DemoMotion, legLength, type Clips } from '../motion/timeline';
import { loadRookie, type RookieId } from '../render/rookie';
import { createStage } from '../render/scene';
import { pageQuery } from '../flags';

// ?demo=welcome-tile&tile=courses|editor|slicer|community: a small staged scene for one picture on the welcome screen (CC-246).
// scripts/welcome-tiles.mjs screenshots the canvas. The same Rookies and the same flat colours as the game; nothing here ships to players.

const PHASES: Phase[] = ['run', 'leap', 'land', 'hang', 'swing'];
const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 1, ...extra });
const box = (w: number, h: number, d: number, color: number, x: number, y: number, z: number, extra: THREE.MeshStandardMaterialParameters = {}) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, extra)); m.position.set(x, y + h / 2, z); return m;
};
const cyl = (r: number, h: number, color: number, x: number, y: number, z: number) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), mat(color)); m.position.set(x, y + h / 2, z); return m;
};
const tree = (x: number, z: number, s = 1) => {
  const g = new THREE.Group();
  g.add(cyl(0.16 * s, 1.5 * s, 0x8a5a2b, x, 0, z));
  const c = new THREE.Mesh(new THREE.SphereGeometry(1.1 * s, 14, 10), mat(0x5aa84e)); c.position.set(x, 2.1 * s, z); g.add(c);
  return g;
};
const OUTLINE = new THREE.LineBasicMaterial({ color: 0x17201d });
const outlined = (m: THREE.Mesh) => { const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), OUTLINE); m.add(e); return m; };

async function photoPlane(url: string, w: number, h: number): Promise<THREE.Mesh> {
  const tex = await new THREE.TextureLoader().loadAsync(url); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
}
async function objectOf(url: string, height: number): Promise<THREE.Object3D> {
  const o = (await new GLTFLoader().loadAsync(url)).scene;
  const b = new THREE.Box3().setFromObject(o), s = height / (b.max.y - b.min.y);
  o.scale.setScalar(s); const b2 = new THREE.Box3().setFromObject(o); o.position.y -= b2.min.y; return o;
}

export async function startWelcomeTile(): Promise<void> {
  const tile = pageQuery().get('tile') ?? 'courses';
  const W = 400, H = 340;
  const host = document.createElement('div'); host.style.cssText = `position:fixed;left:0;top:0;width:${W}px;height:${H}px`; document.body.append(host);
  const stage = await createStage(host, false);
  const { scene, camera, renderer } = stage;
  stage.rookie.visible = false;
  scene.background = new THREE.Color(0xa9d3f2);
  camera.fov = 38; camera.aspect = W / H; camera.updateProjectionMatrix();

  const clips = Object.fromEntries(await Promise.all(PHASES.map(async (p) => [p, await loadClip(p)]))) as Record<Phase, Clip>;
  const run = clips.run;
  const clipLeg = legLength(run.names, (i) => new Vector3(...run.frames[0][i]));
  const place = async (id: RookieId, tick: number, x: number, z: number, turn = 0) => {
    const r = await loadRookie(id, run.names, run.parents);
    const pose = new DemoMotion(clips as Clips, r.legLength / clipLeg).pose(tick);
    r.apply(pose.joints.map((j) => new Vector3(j.x - pose.hips.x + x, j.y, j.z + z)));
    if (turn) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = turn; g.attach(r.object); scene.add(g); } else scene.add(r.object);
    return pose;
  };
  const lane = (x0: number, x1: number, z = 0) => scene.add(box(x1 - x0, 0.02, 3.4, 0xe8c58a, (x0 + x1) / 2, 0, z));

  if (tile === 'courses') {
    // a Rookie in the air over a box, on a lane, with a wall and trees behind
    lane(-8, 8);
    scene.add(outlined(box(1.5, 0.9, 1.4, 0xff9a3c, 0, 0, 0)));
    scene.add(outlined(box(2.6, 1.8, 0.5, 0x0f6b5c, 3.4, 0, -1.6)));
    scene.add(outlined(box(1.2, 0.5, 1, 0xff9a3c, -3.4, 0, 0.2)));
    for (const [x, z, s] of [[-4, -4, 1], [0.5, -5, 1.2], [5, -4.5, 1]]) scene.add(tree(x, z, s));
    await place('a', 440, 0, 0);
    camera.position.set(1.2, 1.9, 6.2); camera.lookAt(0, 1.3, 0);
  } else if (tile === 'editor') {
    // a Rookie beside placed pieces on a grid, with a ghost piece about to be placed
    const grid = new THREE.GridHelper(14, 14, 0x17201d, 0x6b7f8a); grid.position.y = 0.01; scene.add(grid);
    scene.add(box(14, 0.01, 14, 0xdfe9d6, 0, -0.01, 0));
    scene.add(outlined(box(1.4, 0.8, 1, 0xff9a3c, -2.2, 0, -0.4)));
    scene.add(outlined(box(2, 0.4, 1, 0x0f6b5c, -0.4, 0, -1.2)));
    scene.add(cyl(0.06, 1.2, 0xf4f1ea, 2.6, 0, -0.5), cyl(0.06, 1.2, 0xf4f1ea, 3.6, 0, -0.5));
    const rail = cyl(0.06, 1, 0xf4f1ea, 3.1, 1.2, -0.5); rail.rotation.z = Math.PI / 2; scene.add(rail);
    const ghost = box(1.6, 1.1, 1, 0xffd27a, 1.2, 0, 1.2, { transparent: true, opacity: 0.55 }); ghost.add(new THREE.LineSegments(new THREE.EdgesGeometry(ghost.geometry), new THREE.LineBasicMaterial({ color: 0xff9a3c }))); scene.add(ghost);
    await place('b', 60, -1.0, 2.2);
    camera.position.set(2.0, 2.5, 7.6); camera.lookAt(0, 0.9, 0.4);
  } else if (tile === 'slicer') {
    // a real-place map on the ground, one lane lifted out of it, a Rookie running along the lane
    const map = await photoPlane('/assets/thumbs/montmartre-paris.webp', 11, 7);
    map.rotation.x = -Math.PI / 2; map.position.set(0, 0.01, -1.2); scene.add(map);
    const strip = await photoPlane('/assets/thumbs/montmartre-paris.webp', 11, 1.5);
    strip.rotation.x = -Math.PI / 2; strip.position.set(0, 0.03, 1.3); scene.add(strip);
    for (const dz of [-0.78, 0.78]) scene.add(box(11, 0.06, 0.08, 0xff9a3c, 0, 0, 1.3 + dz)); // the cut edges
    scene.add(outlined(box(1, 0.6, 1.1, 0x0f6b5c, 1.9, 0.03, 1.3)));
    await place('a', 80, -0.8, 1.3);
    camera.position.set(0.8, 2.3, 5.4); camera.lookAt(-0.2, 0.8, 1.0);
  } else {
    // both Rookies with photo cut-outs and real objects
    lane(-8, 8);
    const frames: [string, number, number, number][] = [['/assets/thumbs/eixample-barcelona.webp', -2.6, 2.1, -0.1], ['/assets/thumbs/san-francisco-lombard.webp', 0.2, 2.6, 0], ['/assets/thumbs/circular-quay-sydney.webp', 3, 2, 0.1]];
    for (const [url, x, y, rz] of frames) {
      const p = await photoPlane(url, 2.2, 1.5); p.position.set(x, y, -1.6); p.rotation.z = rz; scene.add(p);
      const f = box(2.4, 1.7, 0.08, 0xf4f1ea, x, 0, -1.65); f.position.y = y; f.rotation.z = rz; scene.add(f);
    }
    const bench = await objectOf('/assets/objects/bench-concrete.glb', 0.6); bench.position.x = -2.7; bench.position.z = 0.3; scene.add(bench);
    const hyd = await objectOf('/assets/objects/hydrant-red.glb', 0.8); hyd.position.set(3.1, 0, 0.5); scene.add(hyd);
    await place('a', 90, -0.8, 0.4);
    await place('b', 120, 1.5, 0.1);
    camera.position.set(0, 1.9, 7); camera.lookAt(0, 1.2, 0);
  }
  renderer.setAnimationLoop(null);
  renderer.render(scene, camera);
  document.documentElement.dataset.tile = tile;
  document.documentElement.dataset.ready = 'true';
}
