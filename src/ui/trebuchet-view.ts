import * as THREE from 'three/webgpu';
import type { CourseData } from '../course/course';
import { groundAt } from '../sim/terrain';
import { pieces, startLaunch, type Launch } from '../sim/trebuchet';
import { trebuchetParams, type WorldState } from '../sim/world';

// The trebuchet drawn from the simulator's own numbers: a frame, the arm, the counterweight box (bigger for a heavier weight) and the sling.
// Nothing here decides anything: it reads the Launch state of the world, and when the rider has been let go it keeps the last pose.
export interface TrebuchetView { update(w: WorldState): void }

export function createTrebuchetView(scene: THREE.Scene, course: CourseData): TrebuchetView {
  const p = trebuchetParams(course);
  const deck = groundAt(course.terrain, p.x);
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a2b });
  const iron = new THREE.MeshStandardMaterial({ color: 0x4a4f55, metalness: 0.5, roughness: 0.5 });
  const rope = new THREE.LineBasicMaterial({ color: 0xe8dcc0 });
  const group = new THREE.Group();
  scene.add(group);
  // frame: two A-shaped posts (one on each side of the lane), a base beam, and the axle
  const Z = 0.75;
  for (const z of [-Z, Z]) {
    for (const lean of [-0.9, 0.9]) {
      const h = Math.hypot(lean, p.axleHeight);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, h, 0.16), wood);
      post.position.set(p.x - lean / 2, deck + p.axleHeight / 2, z);
      post.rotation.z = Math.atan2(lean, p.axleHeight);
      group.add(post);
    }
  }
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, Z * 2 + 0.3, 12), iron);
  axle.rotation.x = Math.PI / 2; axle.position.set(p.x, deck + p.axleHeight, 0); group.add(axle);
  // arm: one beam from the counterweight end to the sling end (a unit box stretched and turned each frame)
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1, 0.18, 0.22), wood); group.add(arm);
  const side = Math.cbrt(p.counterweight / 2600) * 1.1 + 0.25; // a box of lead-ish density: 2600 kg per cubic metre in the picture
  const weight = new THREE.Mesh(new THREE.BoxGeometry(side, side, 1.0), iron); group.add(weight);
  const slingGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const sling = new THREE.Line(slingGeo, rope); group.add(sling);
  let last: Launch = startLaunch(p, deck);
  return {
    update(w) {
      if (w.launch) last = w.launch;
      const q = pieces(p, last);
      const dx = q.tip.x - q.weight.x, dy = q.tip.y - q.weight.y;
      arm.scale.x = Math.hypot(dx, dy); arm.position.set((q.tip.x + q.weight.x) / 2, (q.tip.y + q.weight.y) / 2, 0); arm.rotation.z = Math.atan2(dy, dx);
      weight.position.set(q.weight.x, q.weight.y - side / 2, 0);
      sling.geometry.setFromPoints([new THREE.Vector3(q.tip.x, q.tip.y, 0), new THREE.Vector3(q.rider.x, q.rider.y, 0)]);
      sling.visible = !!w.launch; // once the rider is let go the sling hangs loose and is not drawn
    },
  };
}
