// ?mode=lineup: the group photo for the film. The two Rookies (Pip and Juno) and the eight starter characters stand in an arc, facing the camera, on a clean stage.
// Each one is a real character loaded the way the game loads it; only the standing place and the turn toward the camera are set here.
import * as THREE from 'three/webgpu';
import { createStage } from '../render/scene';
import { createRookieActor } from '../render/actor';
import { castUrl, CAST_BASE } from '../characters/cast';

export async function startLineup(host: HTMLElement) {
  const stage = await createStage(host, false);
  const { scene, camera } = stage;
  scene.background = new THREE.Color(0xe9efe4);
  const hide = document.createElement('style'); hide.textContent = 'body>*:not(canvas):not(#fc-root){display:none !important}'; document.head.appendChild(hide); // a clean stage: no page buttons
  scene.children.filter((o) => (o as THREE.Mesh).geometry instanceof THREE.PlaneGeometry).forEach((o) => ((o as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: 0xe9efe4 })));
  const cast = ((await (await fetch(`${CAST_BASE}/index.json`)).json()) as { items: { id: string }[] }).items.map((c) => c.id);
  const half = Math.ceil(cast.length / 2);
  // the two Rookies, Pip and Juno, stand in the middle with the starter cast on both sides
  const crew: { id?: string; rookie: 'a' | 'b' }[] = [...cast.slice(0, half).map((id) => ({ id, rookie: 'a' as const })), { rookie: 'a' }, { rookie: 'b' }, ...cast.slice(half).map((id) => ({ id, rookie: 'a' as const }))];
  const n = crew.length, spread = 1.12, radius = 6.5;
  const mid = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    const a = await createRookieActor(scene, { rookie: crew[i].rookie, url: crew[i].id ? castUrl(crew[i].id!) : undefined, fit: crew[i].id !== undefined });
    a.update({ tick: 0, x: 0, y: 0, vx: 0, vy: 0, grounded: true, mode: 'run', squat: false, landedTicksAgo: null, facing: 1 });
    const t = (i - mid) * spread / radius * 1.0; // angle along the arc
    a.object.position.set(Math.sin(t) * radius, 0, radius - Math.cos(t) * radius - 0.0);
    a.object.rotation.y = -Math.PI / 2 - t; // +x is the way the runner faces: turn it toward the camera
  }
  camera.fov = 30; camera.updateProjectionMatrix();
  camera.position.set(0, 1.45, 12.6); camera.lookAt(0, 1.05, 0);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-2, 4, 9); scene.add(sun);
  document.documentElement.dataset.ready = 'true';
  return stage;
}
