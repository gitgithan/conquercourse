import * as THREE from 'three/webgpu';
import type { CourseData } from '../course/course';
import { railsOf, trackSegments } from '../sim/cart';
import { BAR_AHEAD, BAR_HEIGHT } from '../motion/poses';
import type { WorldState } from '../sim/world';

// The coaster the Course draws: two rails and ties along the smooth curve, posts down to the water, and the cart.
// Looks only; the rails the simulator rides are the same curve (src/sim/cart.ts), so the picture and the physics agree.
const RAIL_GAP = 0.34; // m, each rail's distance from the middle of the lane
const CART_LENGTH = 1.7, CART_DEPTH = 1.0, CART_HEIGHT = 0.4;

export interface TrackView {
  group: THREE.Group;
  cart: THREE.Group;
  place(w: WorldState, flyingCart: boolean): void; // the cart follows the runner; the rails never move
}

export function buildTrack(course: CourseData): TrackView {
  const track = course.track!;
  const railsList = trackSegments(track).map((_, i) => railsOf(track, i));
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9ced4, metalness: 0.6, roughness: 0.35, transparent: true, opacity: 0.62, depthWrite: false });
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, transparent: true, opacity: 0.42, depthWrite: false });
  const post = new THREE.MeshStandardMaterial({ color: 0x8d949c, transparent: true, opacity: 0.28, depthWrite: false });
  const STEP = 0.4;
  // Draw each rail section separately so visible gaps match the ride physics.
  const floor = course.terrain.waterY - 2;
  railsList.forEach((rails) => {
    const n = Math.max(2, Math.ceil((rails.x1 - rails.x0) / STEP));
    const pt = (i: number) => { const x = rails.x0 + ((rails.x1 - rails.x0) * i) / n; return { x, y: rails.y(x) }; };
    const railMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.07, 0.07), steel, n * 2);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), t = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const a = pt(i), b = pt(i + 1), len = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
      q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), ang); s.set(len * 1.02, 1, 1);
      for (const [k, z] of [[0, -RAIL_GAP], [1, RAIL_GAP]] as const) { t.set((a.x + b.x) / 2, (a.y + b.y) / 2, z); m.compose(t, q, s); railMesh.setMatrixAt(i * 2 + k, m); }
    }
    group.add(railMesh);
    const tieCount = Math.max(1, Math.floor((rails.x1 - rails.x0) / 0.7));
    const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.05, RAIL_GAP * 2 + 0.2), wood, tieCount);
    for (let i = 0; i < tieCount; i++) {
      const x = Math.min(rails.x1, rails.x0 + 0.35 + i * 0.7), ang = Math.atan(rails.slope(x));
      q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), ang); s.set(1, 1, 1); t.set(x, rails.y(x) - 0.06, 0); m.compose(t, q, s); ties.setMatrixAt(i, m);
    }
    group.add(ties);
    const posts: number[] = [];
    for (let x = rails.x0; x <= rails.x1 + 1e-6; x += 4) posts.push(x);
    const postMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 1, 0.16), post, posts.length * 2);
    posts.forEach((x, i) => {
      const top = rails.y(x) - 0.08, h = Math.max(0.1, top - floor);
      q.identity(); s.set(1, h, 1);
      for (const [k, z] of [[0, -RAIL_GAP], [1, RAIL_GAP]] as const) { t.set(x, floor + h / 2, z); m.compose(t, q, s); postMesh.setMatrixAt(i * 2 + k, m); }
    });
    group.add(postMesh);
  });

  // the cart: a low red box with a front lip; the rider sits on top of it (the runner's feet are the box's top)
  const cart = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(CART_LENGTH, CART_HEIGHT, CART_DEPTH), new THREE.MeshStandardMaterial({ color: 0xd9453a, roughness: 0.55 }));
  body.position.y = -CART_HEIGHT / 2;
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, CART_DEPTH), new THREE.MeshStandardMaterial({ color: 0xb23a31 }));
  lip.position.set(CART_LENGTH / 2 - 0.06, 0.1, 0);
  const wheelGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.06, 14), wheelMat = new THREE.MeshStandardMaterial({ color: 0x20262b });
  for (const dx of [-0.55, 0.55]) for (const z of [-RAIL_GAP, RAIL_GAP]) {
    const wh = new THREE.Mesh(wheelGeo, wheelMat); wh.rotation.x = Math.PI / 2; wh.position.set(dx, -CART_HEIGHT - 0.0, z); cart.add(wh);
  }
  cart.add(body, lip);
  // the grab bar the rider holds (the seated pose puts both hands on it)
  const grab = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, CART_DEPTH * 0.85, 10), steel);
  grab.rotation.x = Math.PI / 2; grab.position.set(BAR_AHEAD, BAR_HEIGHT, 0);
  cart.add(grab);
  for (const z of [-CART_DEPTH * 0.4, CART_DEPTH * 0.4]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, BAR_HEIGHT, 0.04), steel); post.position.set(BAR_AHEAD, BAR_HEIGHT / 2, z); cart.add(post); }
  group.add(cart);
  return {
    group, cart,
    place(w, flyingCart) {
      const c = w.cart;
      const show = !!c || flyingCart;
      cart.visible = show;
      if (!show) return;
      cart.position.set(w.runner.x, w.runner.y, 0);
      if (c) cart.rotation.z = c.tilt;
      else cart.rotation.z = Math.atan2(w.runner.vy, Math.max(0.1, Math.abs(w.runner.vx))) * Math.sign(w.runner.vx || 1); // flying on: it points where it goes
    },
  };
}
