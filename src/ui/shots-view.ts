import * as THREE from 'three/webgpu';
import type { CourseData } from '../course/course';
import { ballsAt, charge, BALL_R } from '../sim/shots';
import type { WorldState } from '../sim/world';

// The timed ball launchers drawn from the simulator's own numbers: a short barrel at each launcher, and the balls where the tick puts them.
// Nothing here decides anything: it reads the world's tick, the same for every player.
// The fire meter (CC-240): a bright plunger slides along each cannon from the tail to the muzzle over the time between shots, and the ball leaves the moment it reaches the head.
export interface ShotsView { update(w: WorldState): void }

export function createShotsView(scene: THREE.Scene, course: CourseData): ShotsView {
  const shots = course.shots ?? [];
  const iron = new THREE.MeshStandardMaterial({ color: 0x4a4f55, metalness: 0.5, roughness: 0.5 });
  const ballMat = new THREE.MeshStandardMaterial({ color: 0xe8622c, roughness: 0.7 });
  const group = new THREE.Group();
  scene.add(group);
  const LEN = 2.2, R0 = 0.4; // the barrel's length and radius, m
  const trackMat = new THREE.MeshBasicMaterial({ color: 0x20262b });
  const fillMat = new THREE.MeshBasicMaterial({ color: 0xffb020 });
  const redMat = new THREE.MeshBasicMaterial({ color: 0xff3b2c });
  const plungerMat = new THREE.MeshBasicMaterial({ color: 0xfff1b0 });
  const meters = shots.map((s) => {
    const dir = s.vx < 0 ? -1 : 1; // the way the ball leaves
    const muzzle = s.x - dir * 0.2, tail = muzzle - dir * LEN;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(R0, R0 + 0.08, LEN, 20), iron);
    barrel.rotation.z = Math.PI / 2 + (dir < 0 ? 0 : Math.PI);
    barrel.position.set((muzzle + tail) / 2, s.y, 0);
    group.add(barrel);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.8), iron);
    post.position.set(tail - dir * 0.1, s.y - 0.1, 0);
    group.add(post);
    // the meter: a track along the top of the barrel, a fill that grows from the tail, and the plunger at the front of the fill
    const track = new THREE.Mesh(new THREE.BoxGeometry(LEN, 0.22, 0.3), trackMat);
    track.position.set((muzzle + tail) / 2, s.y + R0 + 0.3, 0.45);
    group.add(track);
    const fill = new THREE.Mesh(new THREE.BoxGeometry(1, 0.14, 0.32), fillMat);
    fill.position.set(tail, s.y + R0 + 0.3, 0.48);
    group.add(fill);
    const plunger = new THREE.Mesh(new THREE.CylinderGeometry(R0 + 0.12, R0 + 0.12, 0.16, 20), plungerMat);
    plunger.rotation.z = Math.PI / 2;
    plunger.position.set(tail, s.y, 0);
    group.add(plunger);
    return { s, dir, tail, fill, plunger };
  });
  const pool = Array.from({ length: 24 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 18, 12), ballMat); m.visible = false; group.add(m); return m; });
  return {
    update(w) {
      meters.forEach((m) => {
        const c = charge(m.s, w.runner.tick), len = Math.max(0.001, c * LEN);
        m.fill.scale.x = len; m.fill.position.x = m.tail + m.dir * len / 2;
        m.plunger.position.x = m.tail + m.dir * Math.min(LEN - 0.08, c * LEN);
        m.fill.material = c > 0.9 ? redMat : fillMat; // the last tenth turns red: it is about to fire
      });
      const flying = ballsAt(shots, w.runner.tick);
      pool.forEach((m, i) => {
        const b = flying[i];
        m.visible = !!b;
        if (b) { m.position.set(b.x, b.y, 0); m.scale.setScalar(b.r / BALL_R); }
      });
    },
  };
}
