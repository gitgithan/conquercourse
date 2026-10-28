// ?demo=actor[&rookie=a|b][&t0=ticks]: the real simulator runs the default course hands-free on the ideal plan,
// and the Rookie actor is drawn instead of a capsule (side camera). Game time is the tick count; ticks come from performance.now only.
import * as THREE from 'three/webgpu';
import course from '../course/default-course.json';
import ideal from '../course/default-course.ideal.json';
import type { CourseData } from '../course/course';
import { inputFor, type Plan } from '../sim/ideal';
import { newWorld, stepWorld, type WorldState } from '../sim/world';
import { DEFAULT_ROPE, ropePoint } from '../sim/rope';
import { TICKS_PER_SECOND } from '../sim/units';
import { createStage } from '../render/scene';
import { createRookieActor } from '../render/actor';
import { actorStateFor } from '../motion/actor-state';
import { lookUrl } from '../render/look';

const data = course as unknown as CourseData;

export async function startActorDemo(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const stage = await createStage(document.body, false);
  const { scene, camera } = stage;
  // the stage's endless green floor would hide the gaps and the water
  scene.children.filter((o) => (o as THREE.Mesh).geometry instanceof THREE.PlaneGeometry).forEach((o) => (o.visible = false));
  scene.background = new THREE.Color(0xbfdcf2);

  const mat = (color: number) => new THREE.MeshStandardMaterial({ color });
  for (const p of data.terrain.platforms) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(p.x1 - p.x0, p.top + 4, 4), mat(p.bouncy ? 0xd9534f : 0x8a9a5b));
    box.position.set((p.x0 + p.x1) / 2, (p.top - 4) / 2, -2.1); // the front face is just behind the Rookie
    scene.add(box);
  }
  const water = new THREE.Mesh(new THREE.BoxGeometry(400, 0.1, 6), new THREE.MeshStandardMaterial({ color: 0x3b7fc4 }));
  water.position.set(60, data.terrain.waterY, -1);
  scene.add(water);
  if (data.wall) {
    const h = 4.3;
    const shape = new THREE.Shape();
    shape.moveTo(data.wall.x0, 0);
    for (let i = 0; i <= 24; i++) {
      const th = (i / 24) * (Math.PI / 2);
      shape.lineTo(data.wall.x0 + h * Math.sin(th), h * (1 - Math.cos(th)));
    }
    shape.lineTo(data.wall.x0 + h, 0);
    const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 4, bevelEnabled: false }), mat(0xb08b5a));
    wall.position.z = -4.1;
    scene.add(wall);
  }
  const rope = data.rope ? { ...DEFAULT_ROPE, ...data.rope } : null;
  const ropeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 8), mat(0x8a5a2b));
  if (rope) scene.add(ropeMesh);

  const actor = await createRookieActor(scene, { rookie: params.get('rookie') === 'b' ? 'b' : 'a', url: params.get('look') ? lookUrl(params.get('look')!) : undefined });

  // the whole run up front: states[tick] is the simulator's world at that tick
  const plan = ideal.plan as Plan;
  const st = { next: 0, caught: null as number | null, bedAt: null as number | null };
  let w: WorldState = newWorld(data);
  const worlds: { w: WorldState; squat: boolean }[] = [{ w, squat: false }];
  for (let i = 0; i < TICKS_PER_SECOND * 80; i++) {
    const input = inputFor(plan, w, st, data);
    w = stepWorld(w, input, data);
    worlds.push({ w, squat: input.squat });
    if (w.outcome !== 'running') break;
  }
  const t0 = Number(params.get('t0') ?? 0);
  const start = performance.now();

  const show = (tick: number) => {
    const i = Math.min(Math.max(tick, 0), worlds.length - 1);
    const { w: cur, squat } = worlds[i];
    const s = actorStateFor(cur, squat);
    actor.update(s);
    camera.position.set(s.x + 1.5, s.y + 2, 8);
    camera.lookAt(s.x + 1.5, s.y + 1.5, 0);
    if (rope) {
      const sw = cur.swing;
      const grip = sw ? sw.grip : rope.length;
      const th = sw ? sw.theta : 0;
      const end = ropePoint(rope, grip, th);
      const a = new THREE.Vector3(rope.anchorX, rope.anchorY, 0);
      const b = new THREE.Vector3(end.x, end.y, 0);
      ropeMesh.position.copy(a).add(b).multiplyScalar(0.5);
      ropeMesh.scale.set(1, a.distanceTo(b), 1);
      ropeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    }
    document.documentElement.dataset.tick = String(i);
    return s;
  };
  Object.assign(window, { __joints: () => actor.joints().map((p) => [-p.z, p.y, p.x]), __showTick: show, __ticks: () => worlds.length });

  stage.renderer.setAnimationLoop(() => {
    if (!params.has('pose')) show(t0 + Math.floor(((performance.now() - start) / 1000) * TICKS_PER_SECOND));
    stage.renderer.render(scene, camera);
  });
  document.documentElement.dataset.backend = stage.backend;
  document.documentElement.dataset.ready = 'true';
}
