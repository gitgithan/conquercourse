// The Grand Entrance (CC-133): the walkers in the tunnel page are the game's own rigged characters, drawn from behind.
// Pip and Juno are the two Rookies; the eight cast characters walk in at the end. They run the game's own run clip through the game's own actor,
// so this is the same method the Course uses (the cast is fitted to the one skeleton at load, as in Meet the crew).
// The page (public/making-of/timeline.html) loads this file late, once its own cards are showing, and calls window.CCWalk.update() every frame.
// If anything here fails, the page keeps its flat figures and portraits.
import * as THREE from 'three/webgpu';
import { createRookieActor, type ActorState, type RookieActor } from '../render/actor';
import { CAST_BASE, castUrl } from '../characters/cast';

export interface WalkInput { moving: boolean; juno: boolean; crew: number } // crew: 0 not there yet, 1 arrived
interface Walker { actor: RookieActor; x: number; tick: number }

const FACE_AWAY = Math.PI / 2; // the actor faces +x; this turns it to walk away from the camera (-z)
const SLOTS = [-0.9, -1.5, -2.1, -2.7, 0.9, 1.5, 2.1, 2.7]; // the eight, four each side of Pip and Juno
const ease = (u: number) => { const c = Math.max(0, Math.min(1, u)); return c * c * (3 - 2 * c); };

async function start(): Promise<void> {
  const host = document.createElement('div');
  host.id = 'walk3d';
  host.setAttribute('aria-hidden', 'true');
  document.getElementById('view')!.appendChild(host);
  const wantWebGL2 = new URLSearchParams(location.search).get('backend') === 'webgl2';
  const renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true, forceWebGL: wantWebGL2 });
  await renderer.init();
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  const size = () => { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 4, 0.1, 60);
  camera.position.set(0, 0.95, 3.76);
  camera.lookAt(0, 0.7, 0);
  size();
  addEventListener('resize', size);
  scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x3a2a1c, 1.5));
  const key = new THREE.DirectionalLight(0xfff0d8, 2.2); key.position.set(-2, 5, 6); scene.add(key); // from the camera's side, so the backs are lit
  const rim = new THREE.DirectionalLight(0xffb44a, 3.0); rim.position.set(0, 3, -7); scene.add(rim); // the warm glow of the gate, from the front of the walkers

  let pipW: Walker | null = null, junoW: Walker | null = null;
  const crewW: (Walker | null)[] = [];
  const add = async (rookie: 'a' | 'b', url?: string): Promise<Walker> => {
    const actor = await createRookieActor(scene, { rookie, url, fit: !!url });
    actor.object.visible = false;
    return { actor, x: 0, tick: 0 };
  };
  const api = {
    pip: false, juno: false, crew: [] as boolean[],
    update(inp: WalkInput) {
      const arrive = ease(inp.crew), settled = inp.crew >= 0.98;
      const run = (w: Walker, moving: boolean, x: number, z: number, show: boolean) => {
        w.actor.object.visible = show;
        if (!show) return;
        if (moving) { w.x += 0.05; w.tick += 1; }
        const s: ActorState = { tick: w.tick, x: w.x, y: 0, vx: moving ? 2.4 : 0, vy: 0, grounded: true, mode: 'run', squat: false, landedTicksAgo: null, facing: 1 };
        w.actor.update(s);
        w.actor.object.position.set(x, 0, z);
        w.actor.object.rotation.y = FACE_AWAY;
      };
      if (pipW) run(pipW, inp.moving, -0.3 * arrive, 0, true);
      if (junoW) run(junoW, inp.moving, 0.6 - 0.3 * arrive, 0, inp.juno);
      for (let i = 0; i < SLOTS.length; i++) {
        const w = crewW[i];
        if (!w) continue;
        run(w, !settled && inp.crew > 0, SLOTS[i], 2.2 * (1 - arrive), inp.crew > 0);
      }
      renderer.render(scene, camera);
    },
  };
  (window as unknown as { CCWalk: typeof api }).CCWalk = api;

  // first the two Rookies, then the cast one by one; each that loads tells the page so it can hide its flat picture
  const cast = (await (await fetch(`${CAST_BASE}/index.json`)).json() as { items: { id: string }[] }).items.slice(0, 8);
  const told = () => document.dispatchEvent(new CustomEvent('ccwalk'));
  try { pipW = await add('a'); api.pip = true; told(); } catch { return; }
  try { junoW = await add('b'); api.juno = true; told(); } catch { /* the flat Juno stays */ }
  for (let i = 0; i < cast.length; i++) {
    try { crewW[i] = await add('a', castUrl(cast[i].id)); api.crew[i] = true; } catch { crewW[i] = null; api.crew[i] = false; }
    told();
  }
}
start().catch(() => { /* the page keeps its flat figures */ });
