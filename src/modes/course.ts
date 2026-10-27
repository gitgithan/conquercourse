import * as THREE from 'three/webgpu';
import courseJson from '../course/default-course.json';
import type { CourseData } from '../course/course';
import { NO_INPUT, type RunnerInput } from '../sim/runner';
import { DT } from '../sim/units';
import { newWorld, stepWorld, type GameEvent, type WorldState } from '../sim/world';
import { DEFAULT_WALL } from '../sim/wall';
import { DEFAULT_ROPE } from '../sim/rope';
import { inputFor, searchIdealRun, type Plan } from '../sim/ideal';

// The Course: the five obstacles in a row. The simulator decides everything; this file only draws it
// and turns keys into inputs. Time comes from the simulator's tick count, never from the browser's clock.
const course = courseJson as unknown as CourseData;

export interface CourseGame {
  backend: 'webgpu' | 'webgl2';
  world: () => WorldState;
  restart: () => void;
}

const MESSAGES: Record<string, string> = {
  splash: 'Splash! You fell in the water. Press R to try again.',
  cleared: 'You made it! Press R to run it again.',
};

export async function startCourse(host: HTMLElement): Promise<CourseGame> {
  const params = new URLSearchParams(location.search);
  const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL: params.get('backend') === 'webgl2' });
  await renderer.init();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fc5e8);
  const camera = new THREE.PerspectiveCamera(40, host.clientWidth / host.clientHeight, 0.1, 400);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7f5a, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(20, 40, 30);
  scene.add(sun);

  // ground: platforms are boxes, water fills the gaps
  const stone = new THREE.MeshStandardMaterial({ color: 0xb9b2a3 });
  const grass = new THREE.MeshStandardMaterial({ color: 0x7aa95c });
  const bed = new THREE.MeshStandardMaterial({ color: 0xd9453a });
  for (const p of course.terrain.platforms) {
    const bottom = course.terrain.waterY - 2;
    const h = p.top - bottom;
    const m = new THREE.Mesh(new THREE.BoxGeometry(p.x1 - p.x0, h, 5), p.bouncy ? bed : p.top === 0 ? grass : stone);
    m.position.set((p.x0 + p.x1) / 2, bottom + h / 2, 0);
    scene.add(m);
  }
  const water = new THREE.Mesh(new THREE.BoxGeometry(400, 0.1, 30), new THREE.MeshStandardMaterial({ color: 0x2f7fc1, transparent: true, opacity: 0.8 }));
  water.position.set(60, course.terrain.waterY, 0);
  scene.add(water);

  // the warped wall: a quarter circle, flat at the bottom and upright at the top
  if (course.wall) {
    const H = course.wall.height ?? DEFAULT_WALL.height;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    for (let i = 0; i <= 24; i++) {
      const th = (i / 24) * (Math.PI / 2);
      shape.lineTo(H * Math.sin(th), H * (1 - Math.cos(th)));
    }
    shape.lineTo(H, 0);
    shape.lineTo(0, 0);
    const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 5, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xc9893b }));
    wall.position.set(course.wall.x0, 0, -2.5);
    scene.add(wall);
  }

  // the rope hangs from its anchor; it is drawn straight down (it only swings with the runner)
  const ropeLen = course.rope?.length ?? DEFAULT_ROPE.length;
  const ropeGroup = new THREE.Group();
  if (course.rope) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, ropeLen, 8), new THREE.MeshStandardMaterial({ color: 0x8a5a2b }));
    rope.position.y = -ropeLen / 2;
    ropeGroup.add(rope);
    ropeGroup.position.set(course.rope.anchorX, course.rope.anchorY, 0);
    scene.add(ropeGroup);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 5), stone);
    beam.position.set(course.rope.anchorX, course.rope.anchorY + 0.2, 0);
    scene.add(beam);
  }

  // the runner (a capsule until the Rookie is wired in)
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.1, 6, 12), new THREE.MeshStandardMaterial({ color: 0xf07b1d }));
  scene.add(body);

  // HUD
  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:16px;top:12px;font:600 18px system-ui,sans-serif;color:#10141c;text-shadow:0 1px 0 #fff8;pointer-events:none';
  const msg = document.createElement('div');
  msg.style.cssText = 'position:fixed;left:0;right:0;top:38%;text-align:center;font:700 28px system-ui,sans-serif;color:#10141c;text-shadow:0 1px 0 #fff;pointer-events:none';
  const help = document.createElement('div');
  help.style.cssText = 'position:fixed;left:16px;bottom:12px;font:500 14px system-ui,sans-serif;color:#10141c;pointer-events:none';
  help.textContent = 'Hold → to run · Space to jump (or let go of the rope, or press on the trampoline) · ↓ to bend your knees when you land · R to restart · C for camera';
  document.body.append(hud, msg, help);

  // input
  const keys = new Set<string>();
  let jumpQueued = false;
  let camMode: 'side' | 'chase' = 'side';
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space') { jumpQueued = true; e.preventDefault(); }
    if (e.code === 'KeyR') restart();
    if (e.code === 'KeyC') camMode = camMode === 'side' ? 'chase' : 'side';
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('resize', () => {
    renderer.setSize(host.clientWidth, host.clientHeight);
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
  });

  // bot: ?bot=ideal runs the ideal line the simulator found, so the whole course can be filmed hands-free
  let plan: Plan | null = null;
  const botState = { next: 0, caught: null as number | null, bedAt: null as number | null };
  if (params.get('bot') === 'ideal') plan = searchIdealRun(course).plan;

  let world = newWorld(course);
  const log: GameEvent[] = [];
  function restart() {
    world = newWorld(course);
    log.length = 0;
    botState.next = 0; botState.caught = null; botState.bedAt = null;
    msg.textContent = '';
  }

  let last = performance.now();
  let acc = 0;
  const camPos = new THREE.Vector3();
  function frame(now: number) {
    acc = Math.min(acc + (now - last) / 1000, 0.25);
    last = now;
    while (acc >= DT) {
      acc -= DT;
      let input: RunnerInput = NO_INPUT;
      if (plan) input = inputFor(plan, world, botState);
      else {
        input = { run: keys.has('ArrowRight') || keys.has('KeyD'), jump: jumpQueued, jumpSpeed: 0, squat: keys.has('ArrowDown') || keys.has('KeyS') };
        jumpQueued = false;
      }
      world = stepWorld(world, input, course);
      log.push(...world.events);
    }
    const r = world.runner;
    body.position.set(r.x, r.y + 0.85, 0);
    ropeGroup.rotation.z = world.swing ? -world.swing.theta : 0;
    if (world.outcome !== 'running') msg.textContent = MESSAGES[world.outcome] ?? '';
    hud.textContent = `Time ${(r.tick / 120).toFixed(1)} s   ·   ${Math.max(0, Math.round(r.x))} m of ${course.finishX} m`;
    const tx = r.x + 5, ty = r.y + 2.5;
    const want = camMode === 'side' ? new THREE.Vector3(tx, ty + 1, 24) : new THREE.Vector3(r.x - 7, r.y + 4, 12);
    camPos.lerp(want, 0.12);
    camera.position.copy(camPos);
    camera.lookAt(tx, ty, 0);
    renderer.render(scene, camera);
    document.documentElement.dataset.tick = String(r.tick);
    document.documentElement.dataset.outcome = world.outcome;
    document.documentElement.dataset.mode = world.mode;
    requestAnimationFrame(frame);
  }
  camPos.set(5, 3.5, 24);
  requestAnimationFrame(frame);

  const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';
  return { backend, world: () => world, restart };
}
