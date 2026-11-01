// ?demo=lineup: the two Rookies (Pip and Juno) and the eight starter cast characters stand in an arc on a clean stage, all facing the camera (the group photo for the film).
// Film use only: the camera drifts slowly from the left to the right of the group, a pure function of the clock, so a stepped capture is the same every run.
import * as THREE from 'three/webgpu';
import { createStage } from '../render/scene';
import { createRookieActor, type RookieActor, type ActorState } from '../render/actor';
import { CAST_BASE, castUrl } from '../characters/cast';
import { pageQuery } from '../flags';

const STAND: ActorState = { tick: 0, x: 0, y: 0, vx: 0, vy: 0, grounded: true, mode: 'run', squat: false, landedTicksAgo: null, facing: 1 };

export async function startLineup(): Promise<void> {
  const params = pageQuery();
  const stage = await createStage(document.body, false);
  const { scene, camera, renderer } = stage;
  scene.children.filter((o) => (o as THREE.Mesh).geometry instanceof THREE.PlaneGeometry).forEach((o) => (o.visible = false));
  scene.background = new THREE.Color(0x1b2430);
  scene.fog = new THREE.Fog(0x1b2430, 14, 34);
  // a round stage with a lighter ring, lit from the front and above
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.8, 0.2, 64), new THREE.MeshStandardMaterial({ color: 0x77818f, roughness: 0.85 }));
  disc.position.y = -0.1; scene.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.7, 0.07, 12, 96), new THREE.MeshStandardMaterial({ color: 0xff9a3c, emissive: 0xff9a3c, emissiveIntensity: 0.6 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.02; scene.add(ring);
  const key = new THREE.DirectionalLight(0xfff2e0, 2.6); key.position.set(-3, 7, 9); scene.add(key);
  const rim = new THREE.DirectionalLight(0x8ab4ff, 1.6); rim.position.set(4, 5, -6); scene.add(rim);

  const cast = (await (await fetch(`${CAST_BASE}/index.json`)).json() as { items: { id: string; name: string }[] }).items;
  // the Rookie stands in the middle; the cast on both sides, the arc bending toward the camera
  const order: (string | null)[] = [];
  cast.forEach((c, i) => (i % 2 === 0 ? order.push(c.id) : order.unshift(c.id)));
  order.splice(Math.floor(order.length / 2), 0, null);
  const n = order.length;
  const actors: RookieActor[] = [];
  const spots: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const id = order[i];
    const actor = await createRookieActor(scene, { rookie: 'a', url: id ? castUrl(id) : undefined, fit: !!id });
    const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1; // -1 .. 1
    const ang = u * 0.95; // radians along the arc
    spots.push([Math.sin(ang) * 4.1, 3.6 - Math.cos(ang) * 3.6, -Math.PI / 2 - ang * 0.5]);
    actors.push(actor);
  }
  document.documentElement.dataset.lineup = String(n);
  document.querySelectorAll('button, .feedback, #feedback').forEach((e) => ((e as HTMLElement).style.display = 'none'));
  const t0 = performance.now();
  const dur = Number(params.get('dur') ?? 5);
  const ease = (x: number) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };
  const frame = () => {
    const u = ease((performance.now() - t0) / 1000 / dur);
    const a = -0.55 + 1.1 * u; // the camera glides from a little left of the middle to a little right, always looking at the middle of the group
    camera.fov = 34; camera.updateProjectionMatrix();
    camera.position.set(Math.sin(a) * 8.6, 1.1 + 0.15 * u, 1.6 + Math.cos(a) * 8.6);
    camera.lookAt(0, 1.05, 1.4);
    // the actor poses itself in world axes, so it is moved to its place after it has posed
    actors.forEach((ac, i) => { ac.update(STAND); ac.object.position.set(spots[i][0], 0, spots[i][1]); ac.object.rotation.y = spots[i][2]; });
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };
  renderer.setAnimationLoop(null);
  document.documentElement.dataset.ready = 'true';
  requestAnimationFrame(frame);
}
