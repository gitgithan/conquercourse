import * as THREE from 'three/webgpu';
import type { CourseData } from '../course/course';
import { groundAt } from '../sim/terrain';
import { bandParams, stretchAt } from '../sim/band';
import type { WorldState } from '../sim/world';

// The elastic band drawn from the simulator's own numbers: a striped post and a band from its top to the runner's belt.
// A stretched band gets longer, thinner and redder (red means it is near its snap limit). Nothing here decides anything.
export interface BandView { update(w: WorldState): void }

export const BAND_BELT = 1.0; // m above the feet where the band is clipped
const POST_TOP = 1.15; // m above the ground

export function createBandView(scene: THREE.Scene, course: CourseData): BandView {
  const p = bandParams(course);
  const ground = groundAt(course.terrain, p.x);
  const group = new THREE.Group();
  scene.add(group);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, POST_TOP, 14), new THREE.MeshStandardMaterial({ color: 0xf2efe6 }));
  post.position.set(p.x, ground + POST_TOP / 2, 0); group.add(post);
  for (let i = 0; i < 3; i++) { // red stripes
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.1, 14), new THREE.MeshStandardMaterial({ color: 0xd33a2c }));
    stripe.position.set(p.x, ground + 0.2 + i * 0.35, 0); group.add(stripe);
  }
  const hook = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshStandardMaterial({ color: 0x4a4f55, metalness: 0.5 }));
  hook.position.set(p.x, ground + POST_TOP, 0); group.add(hook);
  const mat = new THREE.MeshBasicMaterial({ color: 0x2ca66f });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 10), mat); // a unit tube, scaled and turned each frame
  group.add(band);
  const color = new THREE.Color();
  return {
    update(w) {
      const top = new THREE.Vector3(p.x, ground + POST_TOP, 0);
      let end = new THREE.Vector3(p.x - 0.35, ground + 0.25, 0); // unclipped: it hangs from the post
      let s = 0;
      if (w.band) { end = new THREE.Vector3(w.runner.x, w.runner.y + BAND_BELT, 0); s = stretchAt(p, w.runner.x); }
      const d = end.clone().sub(top), len = Math.max(0.05, d.length());
      const radius = w.band ? 0.045 * Math.sqrt(p.rest / Math.max(p.rest, len)) + 0.012 : 0.03; // a long band is thin
      band.scale.set(radius, len, radius);
      band.position.copy(top).add(end).multiplyScalar(0.5);
      band.rotation.z = Math.atan2(d.y, d.x) + Math.PI / 2;
      color.setHSL((1 - Math.min(1, s / p.snap)) * 0.33, 0.75, 0.45); // green, then yellow, then red as it nears the snap
      mat.color.copy(color);
    },
  };
}
