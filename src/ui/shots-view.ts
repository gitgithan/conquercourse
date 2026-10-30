import * as THREE from 'three/webgpu';
import type { CourseData } from '../course/course';
import { ballsAt, BALL_R } from '../sim/shots';
import type { WorldState } from '../sim/world';

// The timed ball launchers drawn from the simulator's own numbers: a short barrel at each launcher, and the balls where the tick puts them.
// Nothing here decides anything: it reads the world's tick, the same for every player. A thin line before each shot shows the next one is coming.
export interface ShotsView { update(w: WorldState): void }

export function createShotsView(scene: THREE.Scene, course: CourseData): ShotsView {
  const shots = course.shots ?? [];
  const iron = new THREE.MeshStandardMaterial({ color: 0x4a4f55, metalness: 0.5, roughness: 0.5 });
  const ballMat = new THREE.MeshStandardMaterial({ color: 0xe8622c, roughness: 0.7 });
  const group = new THREE.Group();
  scene.add(group);
  for (const s of shots) {
    // the barrel points the way the ball leaves
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 1.4, 20), iron);
    barrel.rotation.z = Math.PI / 2 + (s.vx < 0 ? 0 : Math.PI);
    barrel.position.set(s.x + (s.vx < 0 ? 0.5 : -0.5), s.y, 0);
    group.add(barrel);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.8), iron);
    post.position.set(s.x + (s.vx < 0 ? 1.0 : -1.0), s.y - 0.1, 0);
    group.add(post);
  }
  const pool = Array.from({ length: 24 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 18, 12), ballMat); m.visible = false; group.add(m); return m; });
  return {
    update(w) {
      const flying = ballsAt(shots, w.runner.tick);
      pool.forEach((m, i) => {
        const b = flying[i];
        m.visible = !!b;
        if (b) { m.position.set(b.x, b.y, 0); m.scale.setScalar(b.r / BALL_R); }
      });
    },
  };
}
