import * as THREE from 'three/webgpu';
import type { CourseData } from '../course/course';
import { barDrawnY, poleParamsOf } from '../sim/pole-ride';
import { groundAt } from '../sim/terrain';
import type { WorldState } from '../sim/world';

// The pole vault drawn from the simulator's own numbers (CC-239): the pole (lying, carried or planted), the plant box, the bar on two posts and the cushion.
// Nothing here decides anything: it reads the world's pole state. The bar drops when the world says it was knocked.
export interface PoleView { update(w: WorldState): void }

export function createPoleView(scene: THREE.Scene, course: CourseData): PoleView {
  const ps = course.pole!, p = poleParamsOf(ps);
  const group = new THREE.Group();
  scene.add(group);
  const wood = new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.6 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x4a4f55, metalness: 0.5, roughness: 0.5 });
  const barMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 });
  const mat = new THREE.MeshStandardMaterial({ color: 0x2d6fb5, roughness: 0.9 });
  const boxMat = new THREE.MeshBasicMaterial({ color: 0xf0a020, transparent: true, opacity: 0.5 });
  const gy = (x: number) => { const g = groundAt(course.terrain, x); return Number.isFinite(g) ? g : 0; };

  // the pole: one thin cylinder stretched between two points
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 10), wood);
  group.add(pole);
  const between = (m: THREE.Mesh, ax: number, ay: number, bx: number, by: number) => {
    const len = Math.hypot(bx - ax, by - ay) || 0.01;
    m.position.set((ax + bx) / 2, (ay + by) / 2, 0);
    m.scale.set(1, len, 1);
    m.rotation.z = Math.atan2(by - ay, bx - ax) - Math.PI / 2;
  };

  // the plant box: a flat orange strip on the ground, so the player knows where to hold E
  const box = new THREE.Mesh(new THREE.BoxGeometry(ps.x1 - ps.x0, 0.04, 1.2), boxMat);
  box.position.set((ps.x0 + ps.x1) / 2, gy(ps.x0) + 0.03, 0);
  group.add(box);

  // the bar on two posts, drawn where the model puts the body's passing height
  const by = barDrawnY(ps);
  for (const dz of [-0.9, 0.9]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, by + 0.4 - gy(ps.barX), 0.1), steel);
    post.position.set(ps.barX, gy(ps.barX) + (by + 0.4 - gy(ps.barX)) / 2, dz);
    group.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 10), barMat);
  bar.rotation.x = Math.PI / 2;
  group.add(bar);

  // the cushion past the bar
  const cush = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 3), mat);
  cush.position.set(ps.barX + 2.6, gy(ps.barX + 2.6) - 0.22, 0);
  group.add(cush);

  let used = false; // the pole has been picked up once, so it no longer lies at the start
  let fall = 0; // 0..1: the bar dropping
  let lastTick = 0;
  return {
    update(w) {
      const pw = w.pole, r = w.runner, g = gy(r.x);
      if (pw?.carrying || pw?.ride) used = true;
      if (r.tick < lastTick || r.tick === 0) used = false; // a new try: the pole lies at the start again
      lastTick = r.tick;
      if (pw?.ride) { // planted: from the tip up to the hands
        const rd = pw.ride, top = rd.t < rd.path.length ? rd.path[Math.min(rd.t, rd.path.length - 1)] : rd.path[rd.path.length - 1];
        between(pole, rd.tipX, rd.baseY, rd.tipX + top.x, rd.baseY + top.y);
        pole.visible = !rd.result || rd.t < (rd.result.releaseTick ?? Infinity);
      } else if (pw?.carrying) { // carried low, tip ahead
        const f = w.runner.vx < -0.1 ? -1 : 1;
        between(pole, r.x - f * 0.6, g + 1.1, r.x + f * (p.length - 0.6), g + 0.8);
        pole.visible = true;
      } else if (used) {
        pole.visible = false; // let go: the pole falls away (not drawn)
      } else { // lying on the ground at the pick-up spot
        between(pole, ps.pickX - p.length / 2, gy(ps.pickX) + 0.05, ps.pickX + p.length / 2, gy(ps.pickX) + 0.05);
        pole.visible = true;
      }
      const down = !!pw?.barDown;
      fall = down ? Math.min(1, fall + 0.08) : 0;
      bar.position.set(ps.barX, by - fall * (by - gy(ps.barX) - 0.1), 0);
    },
  };
}
