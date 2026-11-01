// ?demo=group: the Rookie and the eight cast characters stand in a gentle arc on a clean stage, facing the camera (the group photo that ends the film).
// Film use only; the camera drifts a little on a pure function of the clock, so a stepped capture is the same every run.
import * as THREE from 'three/webgpu';
import { createStage } from '../render/scene';
import { createRookieActor, type RookieActor, type ActorState } from '../render/actor';
import { CAST_BASE, castUrl } from '../characters/cast';
import { pageQuery } from '../flags';

const STAND: ActorState = { tick: 0, x: 0, y: 0, vx: 0, vy: 0, grounded: true, mode: 'run', squat: false, landedTicksAgo: null, facing: 1 };

export async function startGroup(): Promise<void> {
  const params = pageQuery();
  const { scene, camera, renderer } = await createStage(document.body, false);
  scene.children.filter((o) => (o as THREE.Mesh).geometry instanceof THREE.PlaneGeometry).forEach((o) => (o.visible = false));
  scene.background = new THREE.Color(0x1b2430);
  scene.fog = new THREE.Fog(0x1b2430, 14, 34);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.4, 0.2, 64), new THREE.MeshStandardMaterial({ color: 0x77818f, roughness: 0.85 }));
  disc.position.y = -0.1; scene.add(disc);
  const key = new THREE.DirectionalLight(0xfff2e0, 2.6); key.position.set(-3, 7, 9); scene.add(key);
  const rim = new THREE.DirectionalLight(0x8ab4ff, 1.6); rim.position.set(4, 5, -6); scene.add(rim);
  const cast = (await (await fetch(`${CAST_BASE}/index.json`)).json() as { items: { id: string }[] }).items;
  const order: (string | null)[] = [];
  cast.forEach((c, i) => (i % 2 === 0 ? order.push(c.id) : order.unshift(c.id)));
  order.splice(Math.floor(order.length / 2), 0, null); // the Rookie stands in the middle
  const actors: RookieActor[] = [], spots: [number, number, number][] = [];
  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    actors.push(await createRookieActor(scene, { rookie: 'a', url: id ? castUrl(id) : undefined, fit: !!id }));
    const u = (i / (order.length - 1)) * 2 - 1, ang = u * 0.95;
    spots.push([Math.sin(ang) * 4.7, 3.6 - Math.cos(ang) * 3.6, -Math.PI / 2 - ang * 0.5]);
  }
  document.documentElement.dataset.group = String(order.length);
  document.querySelectorAll('button, .feedback, #feedback').forEach((e) => ((e as HTMLElement).style.display = 'none'));
  const t0 = performance.now(), dur = Number(params.get('dur') ?? 4);
  const ease = (x: number) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };
  const frame = () => {
    const u = ease((performance.now() - t0) / 1000 / dur), a = -0.18 + 0.36 * u;
    camera.fov = 46; camera.updateProjectionMatrix();
    camera.position.set(Math.sin(a) * 7.6, 1.2, 1.6 + Math.cos(a) * 7.6);
    camera.lookAt(0, 0.95, 1.4);
    actors.forEach((ac, i) => { ac.update(STAND); ac.object.position.set(spots[i][0], 0, spots[i][1]); ac.object.rotation.y = spots[i][2]; });
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };
  renderer.setAnimationLoop(null);
  document.documentElement.dataset.ready = 'true';
  requestAnimationFrame(frame);
}
