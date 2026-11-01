// ?demo=groupmoves (film only): the group photo for shot 11 (see group-moves.ts). Add &t=<seconds> to freeze at a time, or drive window.__groupAt(t) for a stepped capture.
import * as THREE from 'three/webgpu';
import { createStage } from '../render/scene';
import { createRookieActor, type RookieActor } from '../render/actor';
import { CAST_BASE, castUrl } from '../characters/cast';
import { pageQuery } from '../flags';
import { CREW_SIZE, FILM_LINK, FILM_SECONDS, FILM_SLOGAN, MOVE_OF_SLOT, ROOKIE_SLOTS, cameraOf, cardAt, dimAt, momentOf, poseOf, spotOf } from './group-moves';

export async function startGroupMoves(): Promise<void> {
  const { scene, camera, renderer } = await createStage(document.body, false);
  scene.children.filter((o) => (o as THREE.Mesh).geometry instanceof THREE.PlaneGeometry).forEach((o) => (o.visible = false));
  scene.background = new THREE.Color(0x1b2430);
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 7.6, 0.3, 72), new THREE.MeshStandardMaterial({ color: 0x77818f, roughness: 0.85 }));
  platform.position.set(0, -0.15, 1.2); platform.scale.set(1, 1, 0.55); scene.add(platform);
  const key = new THREE.DirectionalLight(0xfff2e0, 2.6); key.position.set(-3, 7, 12); scene.add(key);
  const rim = new THREE.DirectionalLight(0x8ab4ff, 1.6); rim.position.set(4, 5, -6); scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const cast = (await (await fetch(`${CAST_BASE}/index.json`)).json() as { items: { id: string }[] }).items.map((c) => c.id);
  const ids = cast.slice(0, CREW_SIZE - ROOKIE_SLOTS.length);
  const actors: RookieActor[] = [];
  for (let i = 0; i < CREW_SIZE; i++) {
    const r = ROOKIE_SLOTS.indexOf(i as 4 | 5);
    if (r >= 0) actors.push(await createRookieActor(scene, { rookie: r === 0 ? 'a' : 'b' }));
    else { const id = ids.shift()!; actors.push(await createRookieActor(scene, { rookie: 'a', url: castUrl(id), fit: true })); }
  }
  // the bar overhead for the swing
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 12), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
  scene.add(bar);
  const sSlot = MOVE_OF_SLOT.indexOf('swing');
  { const sp = spotOf(sSlot); bar.position.set(sp.x, 2.12, sp.z); bar.rotation.order = 'YXZ'; bar.rotation.set(Math.PI / 2, sp.yaw, 0); }

  const veil = document.createElement('div'); veil.style.cssText = 'position:fixed;inset:0;background:#0b0f14;opacity:0;pointer-events:none;z-index:5';
  const card = document.createElement('div'); card.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;opacity:0;pointer-events:none;z-index:6;font-family:system-ui,sans-serif;color:#fff;text-align:center';
  card.innerHTML = `<img src="/brand/conquercourse-logo.svg" alt="ConquerCourse" style="height:240px;background:#fff;border-radius:18px;padding:14px 26px"><div style="font-size:44px;font-weight:600;letter-spacing:.02em">${FILM_SLOGAN}</div><div style="margin-top:28px;font-size:64px;font-weight:800;background:#ffd23f;color:#111;padding:8px 40px;border-radius:12px">Play Now</div><div id="film-link" style="font-size:40px;font-weight:600">${FILM_LINK}</div>`;
  document.body.append(veil, card);
  const hide = document.createElement('style'); hide.textContent = 'button,#cc-feedback-btn,.feedback{display:none !important}'; document.head.appendChild(hide);

  const at = (t: number) => {
    const c = cameraOf(t);
    camera.fov = c.fov; camera.updateProjectionMatrix(); camera.position.set(0, c.y, c.z); camera.lookAt(0, 1.0, 0);
    for (let i = 0; i < CREW_SIZE; i++) {
      const p = poseOf(MOVE_OF_SLOT[i], momentOf(i, t)), sp = spotOf(i);
      actors[i].update(p.state);
      const fx = Math.cos(sp.yaw), fz = -Math.sin(sp.yaw); // the way the character faces: toward the camera
      actors[i].object.position.set(sp.x + fx * p.ahead, p.lift, sp.z + fz * p.ahead);
      actors[i].object.rotation.y = sp.yaw;
    }
    veil.style.opacity = String(dimAt(t)); card.style.opacity = String(cardAt(t));
    renderer.render(scene, camera);
  };
  renderer.setAnimationLoop(null);
  const w = window as unknown as { __groupAt: (t: number) => void; __groupSeconds: number };
  w.__groupAt = at; w.__groupSeconds = FILM_SECONDS;
  at(Number(pageQuery().get('t') ?? 0));
  document.documentElement.dataset.ready = 'true';
}
