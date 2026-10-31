import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { addBadge } from './says';
import { PRIZE_TURN_MS, turnAngle } from '../community/flow';

// The prize screen (CC-247): a finished 3D piece appears in the middle of the window on a turntable that turns a full 360 degrees,
// so you can enjoy it before doing anything else. Soft light, a floor, a short name. With "reduce motion" on, it is a still picture.
const STYLE = `
.prize{position:fixed;inset:0;z-index:80;background:rgba(14,20,18,.72);display:flex;align-items:center;justify-content:center;font:16px/1.4 system-ui,sans-serif}
.prize .card{background:#f6f8f5;color:#17201d;border-radius:18px;padding:18px 20px;width:min(560px,92vw);display:grid;gap:10px;justify-items:center;box-shadow:0 20px 60px rgba(0,0,0,.4)}
.prize h2{margin:0;font-size:24px}.prize .sub{color:#58635d;font-size:14px;margin:0}
.prize canvas{width:100%;aspect-ratio:1/1;max-height:50vh;border-radius:14px;background:radial-gradient(circle at 50% 40%,#fdfbf4,#d9e2da);display:block}
.prize .row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.prize button,.prize a.btn{font:inherit;border:1px solid #b9c2bb;background:#fff;color:#17201d;border-radius:10px;padding:8px 16px;cursor:pointer;text-decoration:none;display:inline-block}
.prize .go{background:#0f6b5c;border-color:#0f6b5c;color:#fff}.prize button:disabled{opacity:.5;cursor:default}`;
let styled = false;

export interface PrizeInput {
  glb: ArrayBuffer;
  name: string;
  editorHref: string;
  /** Shares the piece; resolves with a plain-words note. */
  share?: () => Promise<string>;
}
export type PrizeEnd = 'kept' | 'again' | 'closed';

const reduced = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Shows the prize and resolves when the person presses one of its buttons (or Escape). */
export function openPrize(p: PrizeInput): Promise<PrizeEnd> {
  if (!styled) { styled = true; document.head.append(Object.assign(document.createElement('style'), { textContent: STYLE })); }
  return new Promise((done) => {
    const shade = Object.assign(document.createElement('div'), { className: 'prize', id: 'prize' });
    shade.setAttribute('role', 'dialog'); shade.setAttribute('aria-label', `Your new piece: ${p.name}`);
    const card = document.createElement('div'); card.className = 'card'; shade.append(card);
    const h = Object.assign(document.createElement('h2'), { textContent: p.name }); h.id = 'prize-name';
    const sub = Object.assign(document.createElement('p'), { textContent: 'Your new 3D piece. It is saved in this browser.' }); sub.className = 'sub'; sub.id = 'prize-sub';
    const canvas = document.createElement('canvas'); canvas.id = 'prize-canvas';
    const row = document.createElement('div'); row.className = 'row';
    const btn = (text: string, id: string, cls = '') => { const b = Object.assign(document.createElement('button'), { textContent: text, id, className: cls, type: 'button' }); row.append(b); return b; };
    const keep = btn('Keep in my pieces', 'prize-keep', 'go');
    const share = p.share ? btn('Share', 'prize-share') : null;
    const again = btn('Make another', 'prize-again');
    const open = Object.assign(document.createElement('a'), { textContent: 'Open in the World Editor', href: p.editorHref, className: 'btn', id: 'prize-editor' }); row.append(open);
    card.append(h, canvas, sub, row);
    addBadge(card, 'builder'); // CC-243
    document.body.append(shade);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c4b8, 1.5));
    const sun = new THREE.DirectionalLight(0xfff3e0, 1.6); sun.position.set(2, 4, 3); scene.add(sun);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    const spin = new THREE.Group(); scene.add(spin);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.04, 64), new THREE.MeshStandardMaterial({ color: 0xeae6da, roughness: 0.9 })); scene.add(floor);
    const still = reduced();
    let raf = 0, t0 = 0, closed = false;
    const size = () => { const w = canvas.clientWidth || 480; renderer.setSize(w, w, false); camera.aspect = 1; camera.updateProjectionMatrix(); };
    const frame = (t: number) => {
      if (closed) return;
      if (!t0) t0 = t;
      const a = turnAngle(t - t0, still);
      spin.rotation.y = a; shade.dataset.turn = (a / (Math.PI * 2)).toFixed(3);
      renderer.render(scene, camera);
      if (!still) raf = requestAnimationFrame(frame);
    };
    shade.dataset.motion = still ? 'still' : 'turning'; shade.dataset.turnMs = String(PRIZE_TURN_MS);
    new GLTFLoader().parse(p.glb, '', (g) => {
      const obj = g.scene; const box = new THREE.Box3().setFromObject(obj); const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
      obj.position.set(-c.x, -box.min.y, -c.z); spin.add(obj);
      const r = Math.max(sz.x, sz.z, 0.1) * 0.75 + 0.1, big = Math.max(sz.x, sz.y, sz.z, 0.1);
      floor.scale.set(r, 1, r); floor.position.y = -0.02;
      camera.position.set(0, sz.y * 0.5 + big * 0.55, big * 2.3); camera.lookAt(0, sz.y * 0.45, 0);
      size(); shade.dataset.ready = '1'; raf = requestAnimationFrame(frame);
    }, () => { sub.textContent = 'Your piece is saved, but the picture could not be drawn here.'; });

    const end = (how: PrizeEnd) => { if (closed) return; closed = true; cancelAnimationFrame(raf); renderer.dispose(); shade.remove(); document.removeEventListener('keydown', onKey); done(how); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') end('closed'); };
    document.addEventListener('keydown', onKey);
    keep.onclick = () => end('kept');
    again.onclick = () => end('again');
    open.addEventListener('click', () => { closed = true; });
    if (share && p.share) share.onclick = async () => { share.disabled = true; sub.textContent = 'Sharing…'; try { sub.textContent = await p.share!(); share.textContent = 'Shared'; } catch (e) { sub.textContent = (e as Error).message; share.disabled = false; } };
    keep.focus();
  });
}
