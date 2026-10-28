import * as THREE from 'three/webgpu';
import type { CourseData } from '../course/course';
import { heightAt } from '../sim/terrain';
import { predictCart, predictJump, predictLaunch, predictRelease } from '../sim/predict';
import type { WorldState } from '../sim/world';
import { DEFAULT_WALL } from '../sim/wall';
import { planVault, vaultAt, type Vault } from '../sim/vault';

// The debug view (like a fighting game's hitbox mode): draws what the simulator really uses, and says what a jump right now would do.
//   yellow  = the ground and the wall the runner stands on and bumps into (the collision outline, not the pretty picture)
//   cyan    = the runner's body box and the point at its feet
//   green / red = where a jump right now goes (green lands, red falls or is blocked), run on the simulator's own physics
export interface DebugView { toggle(): boolean; update(w: WorldState): void; readonly shown: boolean }

export function createDebugView(scene: THREE.Scene, course: CourseData, parent: HTMLElement, on = false): DebugView {
  const group = new THREE.Group();
  group.visible = on;
  scene.add(group);
  const mat = (c: number) => { const m = new THREE.LineBasicMaterial({ color: c, depthTest: false, transparent: true }); return m; };
  // a closed shape repeats its first point (a WebGPU line strip has no loop)
  const line = (pts: THREE.Vector3[], c: number, loop = false) => { const g = new THREE.BufferGeometry().setFromPoints(loop ? [...pts, pts[0]] : pts); const l = new THREE.Line(g, mat(c)); l.renderOrder = 999; group.add(l); return l; };
  const Z = 1.08; // just in front of the lane's near face, so it is seen from the side camera

  // the collision outline of every platform, and the wall's quarter circle
  const bottom = course.terrain.waterY;
  for (const p of course.terrain.platforms) {
    const pts: THREE.Vector3[] = [new THREE.Vector3(p.x0, bottom, Z)];
    for (let x = p.x0; x < p.x1; x += 0.05) pts.push(new THREE.Vector3(x, heightAt(p, x), Z));
    pts.push(new THREE.Vector3(p.x1, heightAt(p, p.x1), Z), new THREE.Vector3(p.x1, bottom, Z));
    line(pts, p.bouncy ? 0xff5a36 : 0xffe14a);
  }
  if (course.wall) {
    const R = course.wall.radius ?? course.wall.height ?? DEFAULT_WALL.height, x0 = course.wall.x0, pts: THREE.Vector3[] = [];
    for (let a = 0; a <= 90; a += 3) { const t = (a * Math.PI) / 180; pts.push(new THREE.Vector3(x0 + R * Math.sin(t), R - R * Math.cos(t), Z)); }
    line(pts, 0xffe14a);
  }
  // the runner's body box and feet point
  const box = line([new THREE.Vector3(-0.16, 0, Z), new THREE.Vector3(0.16, 0, Z), new THREE.Vector3(0.16, 1.75, Z), new THREE.Vector3(-0.16, 1.75, Z)], 0x2de0ff, true);
  const feet = line(Array.from({ length: 17 }, (_, i) => new THREE.Vector3(Math.cos((i / 16) * 2 * Math.PI) * 0.07, Math.sin((i / 16) * 2 * Math.PI) * 0.07, Z)), 0x2de0ff, true);
  // the preview path (up to 241 points)
  const arcMat = mat(0x38d26b);
  const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), arcMat); arc.renderOrder = 999; arc.frustumCulled = false; group.add(arc);
  const endMark = line(Array.from({ length: 17 }, (_, i) => new THREE.Vector3(Math.cos((i / 16) * 2 * Math.PI) * 0.18, Math.sin((i / 16) * 2 * Math.PI) * 0.18, Z)), 0x38d26b, true);

  // the vault's path (magenta): from the ideal plant point of the next vaultable step to just past its edge, or the real path while vaulting; a tick marks the plant
  const vaultMat = mat(0xd05cff);
  const vaultLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), vaultMat); vaultLine.renderOrder = 999; vaultLine.frustumCulled = false; vaultLine.visible = false; group.add(vaultLine);
  const plantMark = line([new THREE.Vector3(0, 0, Z), new THREE.Vector3(0, 0.7, Z)], 0xd05cff); plantMark.visible = false;
  const vaultPoints = (v: Vault) => { const out: THREE.Vector3[] = []; for (let i = 0; i <= v.n; i += 2) { const q = vaultAt(v, i); out.push(new THREE.Vector3(q.x, q.y + 0.9, Z)); } const e = vaultAt(v, v.n); out.push(new THREE.Vector3(e.x, e.y + 0.9, Z)); return out; };

  const panel = document.createElement('div');
  panel.id = 'debugpanel';
  panel.style.cssText = 'position:fixed;left:16px;bottom:124px;width:min(380px,90vw);background:#10141cdd;color:#f3f5f1;border-radius:12px;padding:8px 12px;font:13px/1.4 system-ui,sans-serif;pointer-events:none;display:' + (on ? 'block' : 'none');
  parent.appendChild(panel);
  let shown = on, tick = -1;

  return {
    toggle() { shown = !shown; group.visible = shown; panel.style.display = shown ? 'block' : 'none'; tick = -1; return shown; },
    get shown() { return shown; },
    update(w) {
      if (!shown) return;
      const r = w.runner;
      box.position.set(r.x, r.y, 0); feet.position.set(r.x, r.y, 0);
      if (w.runner.tick === tick) return; // the preview only changes when the world does
      tick = w.runner.tick;
      const pr = w.mode === 'hang' ? predictRelease(w, course) : w.mode === 'cart' ? predictCart(w, course) : w.mode === 'launch' ? predictLaunch(w, course) : predictJump(w, course);
      const n = pr.path.length;
      arc.geometry.dispose();
      arc.geometry = new THREE.BufferGeometry().setFromPoints(pr.path.length > 1 ? pr.path.map((q) => new THREE.Vector3(q.x, q.y, Z)) : [new THREE.Vector3(), new THREE.Vector3()]);
      const colour = pr.result === 'lands' ? 0x38d26b : pr.result === 'other-move' ? 0xb0b8b0 : 0xff5a4a;
      arcMat.color.setHex(colour); (endMark.material as THREE.LineBasicMaterial).color.setHex(colour);
      const last = pr.path[n - 1];
      if (last) endMark.position.set(last.x, last.y, 0);
      endMark.visible = pr.result !== 'other-move';
      // the vault path
      let vaultText = '';
      const pv = w.mode === 'run' && r.grounded ? planVault(course.terrain, r.x, r.y, r.vx) : null;
      const live = w.mode === 'vault' ? w.vault : null;
      const vv = live ?? pv?.vault ?? null;
      vaultLine.visible = vv !== null; plantMark.visible = pv !== null && live === null;
      if (vv) {
        vaultLine.geometry.dispose(); vaultLine.geometry = new THREE.BufferGeometry().setFromPoints(vaultPoints(vv));
        if (pv && !live) { plantMark.position.set(pv.plantX, r.y, 0); vaultText = `<div style="color:#d05cff;font-weight:700">Vault: plant ${(pv.vault.edge - pv.plantX).toFixed(1)} m before the step (press V between ${(pv.vault.edge - pv.windowFrom).toFixed(1)} and ${(pv.vault.edge - pv.windowTo).toFixed(1)} m), land ${(pv.vault.x1 - pv.vault.edge).toFixed(1)} m past its edge</div>`; }
        else if (live) vaultText = `<div style="color:#d05cff;font-weight:700">Vaulting: the path goes from ${live.x0.toFixed(1)} to ${live.x1.toFixed(1)} m in ${(live.n / 120).toFixed(2)} s</div>`;
      }
      const hex = '#' + colour.toString(16).padStart(6, '0');
      panel.innerHTML = `${vaultText}<strong>Debug view (B)</strong><div>${r.grounded ? 'On the ground' : 'In the air'} · speed ${Math.abs(r.vx).toFixed(1)} m/s · ${r.y.toFixed(2)} m up</div>`
        + `<div style="color:${hex};font-weight:700">${w.mode === 'cart' ? 'If the cart rolls on: ' : w.mode === 'hang' || w.mode === 'launch' ? 'If you let go now: ' : r.grounded || pr.result === 'other-move' ? 'If you jump now: ' : 'You are in the air; carrying on: '}${pr.why}</div>`
        + `<div style="color:#c9d1c9;font-size:12px;margin-top:3px"><span style="color:#ffe14a">yellow</span> = what you stand on and bump into · <span style="color:#2de0ff">blue</span> = your body box · <span style="color:#38d26b">green</span>/<span style="color:#ff5a4a">red</span> = where a jump now goes</div>`;
    },
  };
}
