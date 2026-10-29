import * as THREE from 'three/webgpu';
import type { CourseData } from '../course/course';
import { groundAt } from '../sim/terrain';
import { isAimable } from '../sim/recoil';
import { recoilParams, type WorldState } from '../sim/world';

// The launcher drawn from the simulator's own numbers: a pad on the deck with the launcher standing on it, the launcher on the runner's back once clipped on,
// and the balls flying back. A heavier ball is drawn bigger. A big cannon is a wheeled air cannon with a wide barrel, a pressure tank and a muzzle:
// the barrel tilts with the aim (it points backward and down, so the push goes forward and up), and dots show where the shot would land.
// Nothing here decides anything: it reads `world.recoil` and the preview path the Course hands in.
export interface RecoilView { update(w: WorldState, facing: 1 | -1, preview?: { x: number; y: number }[]): void }

export function createRecoilView(scene: THREE.Scene, course: CourseData): RecoilView {
  const p = recoilParams(course);
  const big = isAimable(p);
  const deck = groundAt(course.terrain, (p.x0 + p.x1) / 2);
  const iron = new THREE.MeshStandardMaterial({ color: 0x4a4f55, metalness: 0.5, roughness: 0.5 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8c949c, metalness: 0.6, roughness: 0.4 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x0f8a7a, emissive: 0x063d36 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0xe8622c, roughness: 0.8 });
  const dotMat = new THREE.MeshBasicMaterial({ color: 0x14b8a6 });
  const group = new THREE.Group();
  scene.add(group);

  const pad = new THREE.Mesh(new THREE.BoxGeometry(p.x1 - p.x0, 0.06, 1.9), teal);
  pad.position.set((p.x0 + p.x1) / 2, deck + 0.03, 0); group.add(pad);

  type Launcher = { root: THREE.Group; barrel?: THREE.Group };
  // a launcher: a tank with a barrel for the small cannon, a wheeled cannon with a tilting barrel for the big one
  const launcher = (): Launcher => {
    const g = new THREE.Group();
    if (big) {
      // wheels, carriage, pressure tank in front (next to the runner), and the barrel behind, pivoting at the breech
      for (const z of [-0.75, 0.75]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.16, 24), iron);
        wheel.rotation.x = Math.PI / 2; wheel.position.set(-1.0, 0.55, z); g.add(wheel);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.2, 12), steel);
        hub.rotation.x = Math.PI / 2; hub.position.set(-1.0, 0.55, z); g.add(hub);
      }
      const carriage = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 1.3), iron); carriage.position.set(-0.9, 0.95, 0); g.add(carriage);
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 1.5, 20), teal);
      tank.rotation.x = Math.PI / 2; tank.position.set(0.15, 1.5, 0); g.add(tank);
      const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 16), steel);
      gauge.rotation.x = Math.PI / 2; gauge.position.set(0.15, 1.5, 0.78); g.add(gauge);
      const pivot = new THREE.Group(); pivot.position.set(-0.2, 1.3, 0); g.add(pivot);
      const L = 2.8;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, L, 24), iron); barrel.position.set(0, L / 2, 0); pivot.add(barrel); // along +Y, then turned to point backward
      const breech = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), iron); pivot.add(breech);
      const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.06, 10, 24), teal); mouth.rotation.x = Math.PI / 2; mouth.position.set(0, L, 0); pivot.add(mouth);
      return { root: g, barrel: pivot };
    }
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 16), iron); tank.position.set(0.1, 0.4, 0); g.add(tank);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.9, 16), iron);
    barrel.rotation.z = Math.PI / 2; barrel.position.set(-0.25, 0.75, 0); g.add(barrel);
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 8, 16), teal); mouth.rotation.y = Math.PI / 2; mouth.position.set(-0.72, 0.75, 0); g.add(mouth);
    return { root: g };
  };
  const station = launcher(); station.root.position.set((p.x0 + p.x1) / 2 + (big ? 1.2 : 0), deck + 0.06, 0); group.add(station.root);
  const worn = launcher(); worn.root.visible = false; group.add(worn.root);
  // the barrel points backward and down by the aim: a cylinder along +Y turned by (90 degrees + aim) about z points along (-cos, -sin)
  const tilt = (l: Launcher, aim: number) => { if (l.barrel) l.barrel.rotation.z = Math.PI / 2 + aim; };
  tilt(station, p.angle);

  const r = big ? 0.2 + Math.cbrt(p.ballMass) * 0.07 : Math.cbrt(p.ballMass / 12) * 0.22 + 0.06;
  const geo = new THREE.SphereGeometry(r, 18, 12);
  const balls = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(geo, rubber); m.visible = false; group.add(m); return m; });

  // where the shot would land: dots along the predicted path and a ring at the landing
  const DOTS = 40;
  const dots = Array.from({ length: DOTS }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), dotMat); m.visible = false; group.add(m); return m; });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.07, 8, 28), dotMat); ring.rotation.x = Math.PI / 2; ring.visible = false; group.add(ring);

  return {
    update(w, facing, preview) {
      const st = w.recoil;
      const loaded = !!st && st.armed > 0;
      station.root.visible = !st || (!loaded && st.fired === 0);
      worn.root.visible = loaded;
      if (loaded) {
        worn.root.position.set(w.runner.x - (big ? 0.2 : 0.35) * facing, w.runner.y + (big ? 0.05 : 0.45), 0); worn.root.scale.x = facing;
        tilt(worn, st!.aim ?? p.angle);
      }
      balls.forEach((m, i) => {
        const b = st?.balls[i];
        m.visible = !!b;
        if (b) m.position.set(b.x, b.y + r, 0);
      });
      const show = loaded && !!preview && preview.length > 2;
      dots.forEach((d, i) => {
        d.visible = show;
        if (show) { const q = preview![Math.min(preview!.length - 1, Math.round(((i + 1) * (preview!.length - 1)) / (DOTS + 1)))]; d.position.set(q.x, q.y + 0.9, 0); }
      });
      ring.visible = show;
      if (show) { const q = preview![preview!.length - 1]; ring.position.set(q.x, q.y + 0.1, 0); }
    },
  };
}
