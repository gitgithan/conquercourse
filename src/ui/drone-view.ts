import * as THREE from 'three/webgpu';
import type { CourseData } from '../course/course';
import { groundAt } from '../sim/terrain';
import { droneParams, type WorldState } from '../sim/world';

// The cargo drone drawn from the simulator's own numbers: a pad on the deck with the drone resting on it, the drone leaning and lifting as it flies
// (the rotors spin faster when it pushes harder), and the drone parked where it set the rider down. Nothing here decides anything: it reads `world.drone`.
export interface DroneView { update(w: WorldState, facing: 1 | -1): void }

export function createDroneView(scene: THREE.Scene, course: CourseData): DroneView {
  const p = droneParams(course);
  const deck = groundAt(course.terrain, (p.x0 + p.x1) / 2);
  const frame = new THREE.MeshStandardMaterial({ color: 0xdfe3e6, metalness: 0.3, roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2c3036, metalness: 0.4, roughness: 0.6 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x0f8a7a, emissive: 0x063d36 });
  const low = new THREE.MeshStandardMaterial({ color: 0xd8472f, emissive: 0x5a1409 });
  const disc = new THREE.MeshBasicMaterial({ color: 0xb8c4cc, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
  const group = new THREE.Group();
  scene.add(group);

  const pad = new THREE.Mesh(new THREE.BoxGeometry(p.x1 - p.x0, 0.06, 1.7), teal);
  pad.position.set((p.x0 + p.x1) / 2, deck + 0.03, 0); group.add(pad);

  // the drone: a body, four arms, eight rotors (two on each arm end), skids with handles for the rider's hands
  const drone = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.28, 0.9), frame); body.position.y = 0; drone.add(body);
  const battery = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.6), dark); battery.position.y = 0.23; drone.add(battery);
  const rotors: THREE.Group[] = [];
  for (const [ax, az] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.07), dark);
    arm.position.set(ax * 0.9, 0.02, az * 0.5); arm.rotation.y = az * ax * 0.35; drone.add(arm);
    for (const side of [-1, 1]) {
      const r = new THREE.Group();
      r.position.set(ax * 1.55 + side * 0.3 * ax, 0.14, az * 0.85 + side * 0.2);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 10), dark); r.add(hub);
      const blades = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 0.08), dark); r.add(blades);
      const blades2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 1.2), dark); r.add(blades2);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.01, 24, 1, true), disc); ring.position.y = 0.01; r.add(ring);
      drone.add(r); rotors.push(r);
    }
  }
  for (const z of [-0.4, 0.4]) { // skids hang under the frame; the rider stands on them and holds the handles
    const skid = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.06), dark); skid.position.set(0, -p.hang, z); drone.add(skid);
    for (const x of [-0.6, 0.6]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, p.hang, 0.04), dark); leg.position.set(x, -p.hang / 2, z); drone.add(leg); }
  }
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.9), teal); handle.position.set(0.28, -p.hang + 1.05, 0); drone.add(handle);
  group.add(drone);

  let parked: { x: number; y: number } | null = null; // where the drone stands after it set the rider down
  let spin = 0, last = performance.now();
  const rest = { x: (p.x0 + p.x1) / 2, y: deck + 0.06 + p.hang };
  return {
    update(w) {
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
      const d = w.mode === 'drone' ? w.drone : null;
      let power = 0;
      if (d) {
        parked = null;
        drone.visible = true;
        drone.position.set(d.x, d.y, 0); drone.rotation.z = -d.lean;
        power = d.empty ? 0 : 0.5 + Math.min(1, d.thrust / (p.maxThrust * 0.6)) * 0.5;
        battery.material = d.energy < 0.2 * p.battery * 3600 ? low : dark; // the battery glows red when a fifth is left
        parked = { x: d.x, y: d.y };
      } else if (parked && w.runner.grounded) {
        drone.visible = true; drone.position.set(parked.x - 1.8, parked.y, 0); drone.rotation.z = 0; // parked beside the rider, not over them
      } else if (parked) { drone.visible = false; // let go in the air: the drone is gone from the picture
      } else { drone.visible = true; drone.position.set(rest.x, rest.y, 0); drone.rotation.z = 0; }
      spin += dt * power * 60;
      for (const r of rotors) r.rotation.y = spin;
    },
  };
}
