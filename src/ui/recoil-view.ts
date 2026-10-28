import * as THREE from 'three/webgpu';
import type { CourseData } from '../course/course';
import { groundAt } from '../sim/terrain';
import { recoilParams, type WorldState } from '../sim/world';

// The launcher drawn from the simulator's own numbers: a pad on the deck with the launcher standing on it, the launcher on the runner's back once clipped on,
// and the balls (or crates) flying back. A heavier ball is drawn bigger. Nothing here decides anything: it reads `world.recoil`.
export interface RecoilView { update(w: WorldState, facing: 1 | -1): void }

export function createRecoilView(scene: THREE.Scene, course: CourseData): RecoilView {
  const p = recoilParams(course);
  const deck = groundAt(course.terrain, (p.x0 + p.x1) / 2);
  const iron = new THREE.MeshStandardMaterial({ color: 0x4a4f55, metalness: 0.5, roughness: 0.5 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x0f8a7a, emissive: 0x063d36 });
  const rubber = new THREE.MeshStandardMaterial({ color: p.kind === 'crate' ? 0x8a5a2b : 0xe8622c, roughness: 0.8 });
  const group = new THREE.Group();
  scene.add(group);

  const pad = new THREE.Mesh(new THREE.BoxGeometry(p.x1 - p.x0, 0.06, 1.7), teal);
  pad.position.set((p.x0 + p.x1) / 2, deck + 0.03, 0); group.add(pad);

  // a launcher: a tank with a barrel for the cannon, a crate on a strap for the crate piece
  const launcher = (): THREE.Group => {
    const g = new THREE.Group();
    if (p.kind === 'crate') {
      const side = Math.cbrt(p.ballMass / 600) * 1.2 + 0.2;
      const crate = new THREE.Mesh(new THREE.BoxGeometry(side, side, side), rubber);
      crate.position.set(0, side / 2, 0); g.add(crate);
      return g;
    }
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 16), iron); tank.position.set(0.1, 0.4, 0); g.add(tank);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.9, 16), iron);
    barrel.rotation.z = Math.PI / 2; barrel.position.set(-0.25, 0.75, 0); g.add(barrel);
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 8, 16), teal); mouth.rotation.y = Math.PI / 2; mouth.position.set(-0.72, 0.75, 0); g.add(mouth);
    return g;
  };
  const station = launcher(); station.position.set((p.x0 + p.x1) / 2, deck + 0.06, 0); group.add(station);
  const worn = launcher(); worn.visible = false; group.add(worn);

  const r = p.kind === 'crate' ? 0.35 : Math.cbrt(p.ballMass / 12) * 0.22 + 0.06;
  const geo = p.kind === 'crate' ? new THREE.BoxGeometry(r * 1.6, r * 1.6, r * 1.6) : new THREE.SphereGeometry(r, 18, 12);
  const balls = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(geo, rubber); m.visible = false; group.add(m); return m; });

  return {
    update(w, facing) {
      const st = w.recoil;
      const loaded = !!st && st.armed > 0;
      station.visible = !st || (!loaded && st.fired === 0);
      worn.visible = loaded;
      if (loaded) { worn.position.set(w.runner.x - 0.35 * facing, w.runner.y + 0.45, 0); worn.scale.x = facing; }
      balls.forEach((m, i) => {
        const b = st?.balls[i];
        m.visible = !!b;
        if (b) m.position.set(b.x, b.y + r, 0);
      });
    },
  };
}
