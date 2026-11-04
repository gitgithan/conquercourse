// Promo scene 9 (CC-133): the close. All eleven characters stand facing the camera round the logo and slogan; the "Play now" link sits at the bottom, clear of everyone.
// Page: close-stage.html (not part of the shipped site). ?ninja=<url of the glb> picks the made ninja warrior. Time comes from the film's stepped clock.
import * as THREE from 'three/webgpu';
import { createRookieActor, type ActorState } from '../render/actor';
import { CAST_BASE, castUrl } from '../characters/cast';
import { pageQuery } from '../flags';

const q = pageQuery();
const W = 1920, H = 1080, PPM = 125; // picture size, pixels per metre at scale 1
const TOWARD = -Math.PI / 2; // the actor faces +x; this turns it to the camera
const ease = (u: number) => { const c = Math.max(0, Math.min(1, u)); return c * c * (3 - 2 * c); };

// where each stands: centre x, feet y (pixels in the picture), size (1 = 1.8 m is 225 px). The link band is x 560..1360, y 880..1040: nobody goes there.
const SPOTS: [number, number, number][] = [
  [960, 228, 1.0],                                              // the ninja warrior, top centre above the logo
  [600, 285, 1.0], [1320, 285, 1.0],                             // top, either side of the ninja
  [150, 500, 1.05], [400, 500, 1.05], [1520, 500, 1.05], [1770, 500, 1.05],   // middle rows, left and right of the logo
  [150, 800, 1.05], [400, 800, 1.05], [1520, 800, 1.05], [1770, 800, 1.05],   // lower rows
];

async function main() {
  const host = document.getElementById('v')!;
  const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL: q.get('backend') === 'webgl2' });
  await renderer.init(); renderer.setPixelRatio(1); renderer.setSize(W, H);
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x131921);
  const camera = new THREE.OrthographicCamera(-W / 2 / PPM, W / 2 / PPM, H / 2 / PPM, -H / 2 / PPM, 0.1, 100);
  camera.position.set(0, 0, 30); camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x556070, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(-3, 6, 12); scene.add(sun);

  const cast = (await (await fetch(`${CAST_BASE}/index.json`)).json() as { items: { id: string }[] }).items.slice(0, 8);
  const ninjaUrl = q.get('ninja') || undefined;
  // the ninja first (spot 0), then Pip and Juno, then the eight of the starter cast
  const who: { rookie: 'a' | 'b'; url?: string }[] = [{ rookie: 'a', url: ninjaUrl }, { rookie: 'a' }, { rookie: 'b' }, ...cast.map((c) => ({ rookie: 'a' as const, url: castUrl(c.id) }))];
  const actors = [];
  for (let i = 0; i < SPOTS.length; i++) {
    const a = await createRookieActor(scene, { rookie: who[i].rookie, url: who[i].url, fit: !!who[i].url });
    a.object.visible = false; actors.push(a);
  }
  const state = (tick: number): ActorState => ({ tick, x: 0, y: 0, vx: 0, vy: 0, grounded: true, mode: 'run', squat: false, landedTicksAgo: null, facing: 1 });

  const t0 = performance.now();
  const w = window as unknown as { __closeReady?: boolean | string };
  const frame = (t: number) => {
    actors.forEach((a, i) => {
      const [x, fy, s] = SPOTS[i];
      const pop = ease((t - 0.15 * i) / 0.45); // each pops in, one after the other
      a.object.visible = pop > 0;
      a.update(state(0));
      a.object.scale.setScalar(s * 1 * Math.max(0.01, pop));
      a.object.position.set((x - W / 2) / PPM, (H / 2 - fy) / PPM, 0);
      a.object.rotation.y = TOWARD;
    });
    renderer.render(scene, camera);
  };
  w.__closeReady = true;
  const loop = () => { frame((performance.now() - t0) / 1000); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
main().catch((e) => { console.error(e); (window as unknown as { __closeReady: string }).__closeReady = 'failed ' + e; });
