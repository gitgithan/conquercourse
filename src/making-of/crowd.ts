// Promo scene 8 (CC-133, owner 2026-11-05): the made ninja warrior stands alone, front view; the camera turns to 45 degrees and the ten others jump onto the platform
// into a row with the ninja in the middle; the camera turns to the side view and zooms to fit; then, from the middle outwards, each does a jump shot and freezes in the air.
// Same actor and same clips as the Course; the time comes from the film's stepped clock (performance.now), one step per picture.
// Page: crowd-stage.html (not part of the shipped site). ?ninja=<url of the glb> picks the made character.
import * as THREE from 'three/webgpu';
import { createRookieActor, type ActorState, type RookieActor } from '../render/actor';
import { CAST_BASE, castUrl } from '../characters/cast';
import { pageQuery } from '../flags';

const q = pageQuery();
const ease = (u: number) => { const c = Math.max(0, Math.min(1, u)); return c * c * (3 - 2 * c); };
const clamp01 = (u: number) => Math.max(0, Math.min(1, u));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const N = 11, MID = 5, GAP_X = 1.5, PT = 1.2;           // eleven places along the course (x), the platform top PT metres up
const ORDER = [5, 4, 6, 3, 7, 2, 8, 1, 9, 0, 10];          // middle first, then left and right of it, wider and wider
const HEIGHT = [2.2, 1.5, 2.4, 1.9, 1.3, 2.6, 1.7, 2.3, 1.4, 2.5, 1.8];       // how high each one freezes, by place in the row
const PROG = [0.5, 0.3, 0.62, 0.42, 0.7, 0.35, 0.55, 0.25, 0.66, 0.45, 0.58];  // how far through the leap the body is when it freezes (the pose)
const TURN = [0, 0.3, -0.3, -0.2, 0.25, 0.35, -0.35, -0.25, 0.2, 0.3, -0.3];   // a little turn to either side
// the shot: hold in front, turn to 45 degrees, the ten jump on, turn to the side and zoom to fit, then the freeze jumps
const HOLD = 1.0, TURN1 = 2.0, ARR0 = HOLD + 1.2, ARR_STEP = 0.3, ARR_FLIGHT = 0.8;
const ARR_END = ARR0 + 9 * ARR_STEP + ARR_FLIGHT + 0.5, TURN2 = 2.2, J0 = ARR_END + TURN2 + 0.4, STEP = 0.75, RISE = 0.6, TAIL = 1.8;

async function main() {
  const host = document.getElementById('v')!;
  const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL: q.get('backend') === 'webgl2' });
  await renderer.init();
  renderer.setPixelRatio(1);
  const size = () => { renderer.setSize(host.clientWidth, host.clientHeight); camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); };
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fc3e6);
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 200);
  size(); addEventListener('resize', size);
  scene.add(new THREE.HemisphereLight(0xdfeeff, 0x6a7a5a, 1.7));
  const sun = new THREE.DirectionalLight(0xfff2dc, 2.4); sun.position.set(-4, 10, 8); scene.add(sun);
  const box = (w: number, h: number, d: number, color: number, x: number, y: number, z: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.9 })); m.position.set(x, y, z); scene.add(m); return m; };
  box(120, 0.4, 120, 0x6fae6a, 0, -0.2, 0);                 // grass
  box(19, PT, 3.2, 0xcfc9bb, 0, PT / 2, 0);                 // the platform they stand on

  const cast = (await (await fetch(`${CAST_BASE}/index.json`)).json() as { items: { id: string }[] }).items.slice(0, 8);
  const mk = async (rookie: 'a' | 'b', url?: string) => createRookieActor(scene, { rookie, url, fit: !!url });
  const ninjaUrl = q.get('ninja') || undefined;
  const urls: (string | undefined)[] = [undefined, undefined, ...cast.map((c) => castUrl(c.id))]; // Pip, Juno and the eight
  const actors: RookieActor[] = [];
  let u = 0;
  for (let i = 0; i < N; i++) {
    if (i === MID) { actors.push(await mk('a', ninjaUrl)); continue; }
    actors.push(await mk(u === 1 ? 'b' : 'a', urls[u])); u++;
  }
  // the actor faces +x, the way the course runs: the front camera is on +x, the side camera on +z
  const pose = (i: number, x: number, y: number, z: number, yaw: number, st: Partial<ActorState>, t: number) => {
    const a = actors[i];
    a.object.visible = true;
    a.update({ tick: Math.floor(t * 120), x: 0, y: 0, vx: 0, vy: 0, grounded: true, mode: 'run', squat: false, landedTicksAgo: null, facing: 1, ...st } as ActorState);
    a.object.position.set(x, y, z);
    a.object.rotation.y = yaw;
  };
  const slotX = (i: number) => (i - MID) * GAP_X;
  const arrOrder = ORDER.filter((i) => i !== MID);          // the ten arrive middle outwards too

  function frame(t: number) {
    for (let i = 0; i < N; i++) {
      const x = slotX(i);
      if (i === MID) {
        const p = clamp01((t - J0 - 0) / RISE), e = ease(p);
        if (t < J0) pose(i, x, PT, 0, 0, {}, t);
        else pose(i, x, PT + HEIGHT[i] * e, 0, TURN[i], { tick: 0, vx: 3, vy: 6 * (1 - 2 * PROG[i] * e), grounded: false, y: 1 }, 0);
        continue;
      }
      const k = arrOrder.indexOf(i), a0 = ARR0 + k * ARR_STEP;
      if (t < a0) { actors[i].object.visible = false; continue; }
      const jk = ORDER.indexOf(i), js = J0 + jk * STEP;
      if (t >= js) {                                        // the freeze jump
        const e = ease(clamp01((t - js) / RISE));
        pose(i, x, PT + HEIGHT[i] * e, 0, TURN[i], { tick: 0, vx: 3, vy: 6 * (1 - 2 * PROG[i] * e), grounded: false, y: 1 }, 0);
      } else if (t < a0 + ARR_FLIGHT) {                     // jumps onto the platform from the ground in front (+z)
        const p = clamp01((t - a0) / ARR_FLIGHT), e = ease(p);
        pose(i, x, lerp(0, PT, e) + 1.1 * 4 * p * (1 - p), lerp(3.6, 0, e), 0, { tick: 0, vx: 3, vy: 6 * (1 - 2 * p), grounded: false, y: 1 }, 0);
      } else pose(i, x, PT, 0, 0, { tick: Math.floor(t * 120), vx: 0, landedTicksAgo: Math.min(59, (t - a0 - ARR_FLIGHT) * 120) }, t);
    }
    // camera: front (+x), turn to 45 degrees, hold, turn to the side (+z) while the view widens to fit all eleven, hold
    const th1 = (Math.PI / 4) * ease(clamp01((t - HOLD) / TURN1));
    const th2 = (Math.PI / 4) * ease(clamp01((t - ARR_END) / TURN2));
    const th = th1 + th2, wide = ease(clamp01((t - ARR_END) / TURN2));
    const R = lerp(7.5, 16.5, wide), cy = lerp(PT + 1.9, PT + 2.2, wide), ty = lerp(PT + 1.0, PT + 1.5, wide);
    camera.position.set(R * Math.cos(th), cy, R * Math.sin(th)); camera.lookAt(0, ty, 0);
    renderer.render(scene, camera);
  }

  const w = window as unknown as { __crowdReady?: boolean; __crowdEnd: number; __crowdT?: number };
  w.__crowdEnd = J0 + (N - 1) * STEP + RISE + TAIL;
  const t0 = performance.now();
  w.__crowdReady = true;
  const loop = () => { const t = (performance.now() - t0) / 1000; w.__crowdT = t; frame(t); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
main().catch((e) => { console.error(e); (window as unknown as { __crowdReady: string }).__crowdReady = 'failed ' + e; });
