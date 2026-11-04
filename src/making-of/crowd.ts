// Promo scene 8 (CC-133): ten rigged characters run onto a platform from behind, leap to a high platform and land spread out around the made ninja warrior,
// who then hops left and right. Same actor and same clips as the Course; the time comes from the film's stepped clock (performance.now), one step per picture.
// Page: crowd-stage.html (not part of the shipped site). ?ninja=<url of the glb> picks the made character.
import * as THREE from 'three/webgpu';
import { createRookieActor, type ActorState, type RookieActor } from '../render/actor';
import { CAST_BASE, castUrl } from '../characters/cast';
import { pageQuery } from '../flags';

const q = pageQuery();
const ease = (u: number) => { const c = Math.max(0, Math.min(1, u)); return c * c * (3 - 2 * c); };
const clamp01 = (u: number) => Math.max(0, Math.min(1, u));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const AWAY = Math.PI / 2, TOWARD = -Math.PI / 2; // the actor faces +x; AWAY walks into the screen (-z), TOWARD faces the camera
const P2Y = 2.0, P2Z = -11;
const TAKEOFF = 6.6, FLIGHT = 1.5, LAND = TAKEOFF + FLIGHT; // all leap together
const HOP0 = LAND + 1.8, HOP = 0.95, GAP = 0.35; // hops start after a pause

interface Who { actor: RookieActor; start: [number, number]; slot: [number, number]; delay: number; ninja: boolean; row: [number, number]; yaw: number; dist: number }

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
  box(10, 0.14, 8.4, 0xcfc9bb, 0, 0.07, -3.6);              // platform one, where they run to
  box(22, 0.5, 4.2, 0xb9915e, 0, P2Y - 0.25, P2Z);          // platform two, up in the air
  for (const sx of [-10.2, 10.2]) box(0.8, P2Y, 3.6, 0x8f6d44, sx, P2Y / 2, P2Z);
  box(8, 0.5, 4.2, 0x8f6d44, 0, P2Y / 2 - 0.3, P2Z - 0.1).visible = false;

  const cast = (await (await fetch(`${CAST_BASE}/index.json`)).json() as { items: { id: string }[] }).items.slice(0, 8);
  const mk = async (rookie: 'a' | 'b', url?: string) => createRookieActor(scene, { rookie, url, fit: !!url });
  const crew: Who[] = [];
  const urls: (string | undefined)[] = [undefined, undefined, ...cast.map((c) => castUrl(c.id))]; // Pip, Juno and the eight
  // where each one stops on platform one (ninja at the centre), then where each lands on platform two (ninja in the middle of eleven)
  const stop: [number, number][] = [[-3.4, -1.6], [-2.2, -1.8], [-1.1, -1.5], [1.1, -1.5], [2.2, -1.8], [3.4, -1.6], [-2.4, -5.2], [-0.8, -5.6], [0.8, -5.6], [2.4, -5.2]];
  const land: number[] = [-6.5, -5.2, -3.9, -2.6, -1.3, 1.3, 2.6, 3.9, 5.2, 6.5];
  for (let i = 0; i < 10; i++) {
    const actor = await mk(i === 1 ? 'b' : 'a', urls[i]);
    actor.object.visible = false;
    crew.push({ actor, start: [(stop[i][0] < 0 ? -1 : 1) * (3.6 + (i % 3) * 0.9), 12 + (i % 3)], slot: stop[i], delay: 0.28 * i, ninja: false, row: [land[i], P2Z], yaw: AWAY, dist: 0 });
  }
  const ninjaUrl = q.get('ninja') || undefined;
  const ninja: Who = { actor: await mk('a', ninjaUrl), start: [0, -3.6], slot: [0, -3.6], delay: 0, ninja: true, row: [0, P2Z + 1.6], yaw: AWAY, dist: 0 };
  const tickOf = (t: number) => Math.floor(t * 120);
  const put = (w: Who, x: number, y: number, z: number, yaw: number, st: Partial<ActorState>) => {
    w.actor.object.visible = true;
    const s: ActorState = { tick: tickOf(st.tick !== undefined ? st.tick / 120 : 0), x: w.dist, y: 0, vx: 0, vy: 0, grounded: true, mode: 'run', squat: false, landedTicksAgo: null, facing: 1, ...st };
    w.actor.update(s);
    w.actor.object.position.set(x, y, z);
    w.actor.object.rotation.y = yaw;
  };
  const hops = [3.2, -3.2, 3.2, -3.2, 1.6, 0]; // ninja x targets after each hop (the first starts from the middle)
  const hopsEnd = HOP0 + hops.length * (HOP + GAP);

  function frame(t: number) {
    // 1. everyone runs in from behind the camera and stops on platform one
    const phase1 = t < TAKEOFF;
    for (let i = 0; i < crew.length; i++) {
      const w = crew[i], [sx, sz] = w.start, [ex, ez] = w.slot;
      if (phase1) {
        const L = Math.hypot(ex - sx, ez - sz), speed = 4.6, run = clamp01(((t - w.delay) * speed) / L);
        const r = (t - w.delay) <= 0 ? 0 : run;
        const brake = ease(clamp01((r - 0.86) / 0.14)); // slows over the last 14 percent
        const pos = r < 0.86 ? r : 0.86 + (r - 0.86) * (1 - 0.5 * brake);
        const u = Math.min(1, pos);
        const x = lerp(sx, ex, u), z = lerp(sz, ez, u);
        const moving = r > 0 && r < 1 - 1e-3;
        if (r <= 0) { w.actor.object.visible = false; continue; }
        w.dist = u * L;
        put(w, x, z < 0.4 && z > -8 ? 0.14 : 0, z, AWAY, { tick: Math.floor(w.dist * 60), vx: moving ? 4 : 0, x: w.dist });
      } else if (t < LAND) {
        const p = clamp01((t - TAKEOFF) / FLIGHT), [ex, ez] = w.slot, [lx, lz] = w.row;
        const jitter = 0.12 * i;
        const e = ease(clamp01(p * 1.0));
        const x = lerp(ex, lx, e), z = lerp(ez, lz, e), y = lerp(0.14, P2Y, e) + 3.0 * 4 * p * (1 - p);
        const yaw = lerp(AWAY, TOWARD, ease(clamp01((p - 0.1) / 0.7)));
        put(w, x, y, z, yaw, { tick: Math.floor(w.dist * 60), vx: 3, vy: 6 * (1 - 2 * p) + jitter * 0, grounded: false, y: y, x: w.dist });
      } else {
        const ago = (t - LAND) * 120;
        put(w, w.row[0], P2Y, w.row[1], TOWARD, { tick: tickOf(t), vx: 0, landedTicksAgo: ago < 60 ? ago : null, x: w.dist });
      }
    }
    // the ninja stands in the middle of platform one, leaps with the others, lands in the middle, then hops left and right
    {
      const w = ninja;
      if (t < TAKEOFF) put(w, 0, 0.14, -3.6, AWAY, { tick: tickOf(t), vx: 0 });
      else if (t < LAND) {
        const p = clamp01((t - TAKEOFF) / FLIGHT), e = ease(p);
        put(w, 0, lerp(0.14, P2Y, e) + 3.2 * 4 * p * (1 - p), lerp(-3.6, w.row[1], e), lerp(AWAY, TOWARD, ease(clamp01((p - 0.1) / 0.7))), { tick: 0, vx: 3, vy: 6 * (1 - 2 * p), grounded: false, y: 1 });
      } else if (t < HOP0) put(w, 0, P2Y, w.row[1], TOWARD, { tick: tickOf(t), vx: 0, landedTicksAgo: Math.min(59, (t - LAND) * 120) < 59 ? (t - LAND) * 120 : null });
      else {
        const k = Math.min(hops.length - 1, Math.floor((t - HOP0) / (HOP + GAP))), local = t - HOP0 - k * (HOP + GAP);
        const from = k === 0 ? 0 : hops[k - 1], to = hops[k], dirR = to > from;
        const yaw = dirR ? 0 : Math.PI, p = clamp01(local / HOP);
        const turn = k === 0 ? 1 : ease(clamp01(local / 0.25));
        const prevYaw = k === 0 ? TOWARD : (hops[k - 1] > (k > 1 ? hops[k - 2] : 0) ? 0 : Math.PI);
        let dy = prevYaw - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        const yw = yaw + dy * (1 - turn);
        const x = lerp(from, to, ease(p)), y = P2Y + 1.9 * 4 * p * (1 - p);
        if (local < HOP) put(w, x, y, w.row[1], k === 0 ? lerp(TOWARD, yaw, ease(clamp01(local / 0.25))) : yw, { tick: 0, vx: 3, vy: 6 * (1 - 2 * p), grounded: false, y: 1 });
        else put(w, to, P2Y, w.row[1], yaw, { tick: tickOf(t), vx: 0, landedTicksAgo: (local - HOP) * 120 });
      }
    }
    // camera
    const behind = ease(clamp01((t - 5.2) / 1.6));        // swings from behind the runners up to the front of platform two
    const cx = 0;
    if (t < TAKEOFF - 0.4) {
      camera.position.set(cx, 3.4, 10.5); camera.lookAt(0, 0.9, -3.5);
    } else if (t < HOP0 - 0.6) {
      const u = ease(clamp01((t - (TAKEOFF - 0.4)) / (FLIGHT + 0.8)));
      camera.position.set(0, lerp(3.4, 5.0, u), lerp(10.5, 4.2, u)); camera.lookAt(0, lerp(0.9, P2Y + 1.6, u), lerp(-3.5, P2Z, u));
    } else {
      const u = ease(clamp01((t - (HOP0 - 0.6)) / 1.4)), nx = ninja.actor.object.position.x;
      camera.position.set(lerp(0, nx * 0.35, 1) , lerp(5.0, 3.9, u), lerp(4.2, 1.6, u)); camera.lookAt(nx * 0.5, P2Y + 1.0, P2Z);
    }
    void behind; void hopsEnd;
    renderer.render(scene, camera);
  }

  const w = window as unknown as { __crowdReady?: boolean; __crowdEnd: number; __crowdT?: number };
  w.__crowdEnd = hopsEnd + 0.8;
  const t0 = performance.now();
  w.__crowdReady = true;
  const loop = () => { const t = (performance.now() - t0) / 1000; w.__crowdT = t; frame(t); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
main().catch((e) => { console.error(e); (window as unknown as { __crowdReady: string }).__crowdReady = 'failed ' + e; });
