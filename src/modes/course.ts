import * as THREE from 'three/webgpu';
import courseJson from '../course/default-course.json';
import type { CourseData } from '../course/course';
import { NO_INPUT, type RunnerInput } from '../sim/runner';
import { DT } from '../sim/units';
import { newWorld, stepWorld, type GameEvent, type WorldState } from '../sim/world';
import { DEFAULT_WALL } from '../sim/wall';
import { DEFAULT_ROPE } from '../sim/rope';
import { inputFor, searchIdealRun, type Plan } from '../sim/ideal';
import { gapSpecs, minSpeedForWall } from '../sim/needs';
import { ouch } from '../sim/landing';

// The Course: the five obstacles in a row. The simulator decides everything; this file only draws it
// and turns keys into inputs. Time comes from the simulator's tick count, never from the browser's clock.
const defaultCourse = courseJson as unknown as CourseData;

export interface CourseGame {
  backend: 'webgpu' | 'webgl2';
  world: () => WorldState;
  restart: () => void;
}

const MESSAGES: Record<string, string> = {
  splash: 'Splash! You fell in the water. Press R to try again.',
  cleared: 'You made it! Press R to run it again.',
};

export async function startCourse(host: HTMLElement, course: CourseData = defaultCourse): Promise<CourseGame> {
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
  water.position.set(course.finishX / 2, course.terrain.waterY, 0);
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
  help.textContent = 'Hold ← or → to run · Space to jump (or let go of the rope, or press on the trampoline) · hold ↓ when you land from a high drop · R restart · C camera · T Dojo';
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:50%;top:26%;transform:translateX(-50%);width:min(520px,92vw);background:#fffffff2;border:1px solid #cfd6d0;border-radius:12px;padding:16px;font:16px/1.4 system-ui,sans-serif;color:#17201d;display:none;gap:10px;box-shadow:0 8px 30px #0003';
  const hint = document.createElement('div');
  hint.style.cssText = 'position:fixed;left:50%;bottom:48px;transform:translateX(-50%);font:600 20px system-ui,sans-serif;color:#10141c;background:#fffc;border-radius:10px;padding:8px 16px;pointer-events:none';
  const gauge = document.createElement('div');
  gauge.style.cssText = 'position:fixed;left:50%;top:10px;transform:translateX(-50%);width:min(420px,60vw);font:600 15px system-ui,sans-serif;color:#10141c;text-shadow:0 1px 0 #fff8;pointer-events:none;text-align:center';
  gauge.innerHTML = '<div id="gtext">Speed</div><div style="position:relative;height:14px;background:#10141c33;border-radius:7px;margin-top:3px"><div id="gfill" style="height:100%;width:0;background:#0f6b5c;border-radius:7px"></div><div id="gneed" style="position:absolute;top:-4px;width:3px;height:22px;background:#c4572a;display:none"></div></div><div id="gnext" style="margin-top:4px;font-weight:500"></div>';
  const dojoBtn = document.createElement('button');
  dojoBtn.textContent = 'Dojo (T)';
  dojoBtn.style.cssText = 'position:fixed;right:16px;top:12px;font:600 15px system-ui,sans-serif;border:1px solid #0f6b5c;background:#0f6b5c;color:#fff;border-radius:8px;padding:6px 14px;cursor:pointer';
  dojoBtn.onclick = () => openDojo();
  document.body.append(hud, msg, help, panel, hint, gauge, dojoBtn);
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;left:50%;top:44%;transform:translateX(-50%);font:700 22px system-ui,sans-serif;color:#10141c;background:#fffffff0;border-radius:10px;padding:6px 14px;pointer-events:none;display:none';
  document.body.append(toast);
  let toastUntil = 0, squashUntil = 0, squashDepth = 1;
  const gText = gauge.querySelector('#gtext') as HTMLElement, gFill = gauge.querySelector('#gfill') as HTMLElement;
  const gNeed = gauge.querySelector('#gneed') as HTMLElement, gNext = gauge.querySelector('#gnext') as HTMLElement;
  const specs = gapSpecs(course);
  const zoneOf = (x: number) => course.zones?.find((z) => x >= z.x0 && x < z.x1);
  const wallNeed = course.wall ? minSpeedForWall(course.wall) : Infinity;
  const GAUGE_MAX = 10;
  // numbers painted on the course so the player can see how wide a gap is and how high the wall is
  function label(text: string, x: number, y: number) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 96;
    const g = c.getContext('2d')!; g.fillStyle = '#fffffff0'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#10141c'; g.font = '700 54px system-ui'; g.textAlign = 'center'; g.fillText(text, 128, 66);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c) }));
    sp.scale.set(3.2, 1.2, 1); sp.position.set(x, y, 0.5); scene.add(sp);
  }
  for (const g of specs) { const z = zoneOf(g.x); if (z && (z.id === 'gap' || z.id === 'landing')) label(`${g.width.toFixed(1)} m`, g.x + g.width / 2, Math.max(0, g.rise) + 3); }
  if (course.wall) label(`${(course.wall.height ?? DEFAULT_WALL.height).toFixed(1)} m high`, course.wall.x0 + 2, (course.wall.height ?? DEFAULT_WALL.height) + 1.2);
  if (course.rope) label(`rope ${ropeLen.toFixed(0)} m`, course.rope.anchorX, course.rope.anchorY + 1.6);

  // input
  const keys = new Set<string>();
  let jumpQueued = false;
  let camMode: 'side' | 'chase' = 'side';
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space') { jumpQueued = true; e.preventDefault(); }
    if (e.code === 'KeyR') restart();
    if (e.code === 'KeyT') openDojo();
    if (e.code === 'Escape' && replay) { replay = null; showAgain(); }
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
  const frames: { x: number; y: number }[] = [];
  let replay: { i: number; from: number; to: number } | null = null;
  let falls = 0;
  let everCleared = false;
  try { everCleared = localStorage.getItem('cc.course.cleared') === '1'; } catch { /* keep going */ }
  let windows: ReturnType<typeof searchIdealRun>['windows'] | null = null;
  const zoneAt = (x: number) => course.zones?.find((z) => x >= z.x0 && x < z.x1);
  function restart() {
    world = newWorld(course);
    log.length = 0;
    botState.next = 0; botState.caught = null; botState.bedAt = null;
    msg.textContent = '';
    frames.length = 0; replay = null; panel.style.display = 'none';
    squashUntil = 0; toastUntil = 0; toast.style.display = 'none';
  }

  // The Dojo is reachable any time: it opens on the obstacle nearest the runner (R2-G4).
  function openDojo() {
    const x = world.runner.x;
    const z = zoneAt(x)?.id ?? 'gap';
    location.search = trainLink(z, x);
  }

  // The Dojo opens on the very obstacle the player fell at, with its real numbers (R1-L1, R1-L3).
  function trainLink(zoneId: string, x: number): string {
    const q = new URLSearchParams({ mode: 'dojo', ex: zoneId, from: 'course' });
    const jump = [...log].reverse().find((e) => e.type === 'jump');
    if (jump?.detail?.vx) q.set('speed', (jump.detail.vx as number).toFixed(1));
    if (zoneId === 'gap' || zoneId === 'landing') {
      const g = specs.find((q2) => x >= q2.x - 0.5 && x <= q2.x + q2.width + 1) ?? specs.find((q2) => q2.x >= x - 12);
      if (g) { q.set('ex', 'gap'); q.set('width', g.width.toFixed(1)); q.set('rise', g.rise.toFixed(1)); q.set('needed', g.needed.toFixed(1)); }
    }
    if (zoneId === 'wall') { q.set('ex', 'wall'); q.set('wallh', String(course.wall?.height ?? DEFAULT_WALL.height)); }
    if (zoneId === 'rope') { q.set('ex', 'rope'); q.set('length', String(course.rope?.length ?? DEFAULT_ROPE.length)); }
    return '?' + q.toString();
  }

  // After a fall: retry at once, one tip, a skippable replay, and the offer to train that obstacle.
  let lastFall: 'splash' | 'slide' = 'splash';
  function onFall(what: 'splash' | 'slide') {
    falls++;
    lastFall = what;
    const r = world.runner;
    const zone = zoneAt(what === 'slide' && course.wall ? course.wall.x0 + 1 : r.x);
    const jump = [...log].reverse().find((e) => e.type === 'jump');
    let tip = 'Try again.';
    if (what === 'slide') tip = 'You ran out of speed on the curve. Start the run-up earlier and keep running.';
    else if (zone?.id === 'trampoline') tip = 'Press Space at the bottom of the bounce for extra height.';
    else if (zone?.id === 'rope') tip = 'Grab the rope on the way up, then press Space to let go when you are rising.';
    else if (!jump) tip = 'Press Space just before the edge.';
    else if (jump && (jump.detail?.vx as number) !== undefined && (zone?.id === 'gap' || zone?.id === 'landing')) {
      const g = specs.find((q2) => r.x >= q2.x - 0.5 && r.x <= q2.x + q2.width + 1) ?? specs.find((q2) => q2.x >= r.x - 12);
      const v = jump.detail!.vx as number;
      tip = g && v < g.needed ? `You left the edge at ${v.toFixed(1)} m/s, but this ${g.width.toFixed(1)} m gap needs at least ${g.needed.toFixed(1)} m/s. Run longer before you jump.` : 'Your speed was enough. Try pressing Space a little closer to the edge.';
    } else {
      windows ??= searchIdealRun(course).windows;
      const w = windows.find((q) => q.obstacle.startsWith('edge') && Math.abs(q.best - r.x) < 9);
      if (w) tip = r.x < w.best ? 'You jumped a bit late. Try pressing Space a little earlier.' : 'You jumped a bit early. Try pressing Space a little later.';
    }
    const train = everCleared || falls >= 3;
    panel.innerHTML = '';
    panel.style.display = 'grid';
    const h = document.createElement('strong');
    h.textContent = what === 'slide' ? 'You slid back down the wall.' : `You fell in the water at the ${zone?.name ?? 'course'}.`;
    const t = document.createElement('div'); t.textContent = tip;
    const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
    const mk = (label: string, fn: () => void, primary = false) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = `font:inherit;border:1px solid ${primary ? '#0f6b5c' : '#b9c2bb'};background:${primary ? '#0f6b5c' : '#fff'};color:${primary ? '#fff' : '#17201d'};border-radius:8px;padding:6px 12px;cursor:pointer;font-weight:${primary ? 700 : 400}`;
      b.onclick = fn; row.appendChild(b); return b;
    };
    const retry = mk('Try again (R)', restart, true);
    mk('Watch what happened', () => { panel.style.display = 'none'; replay = { i: Math.max(0, frames.length - 240), from: Math.max(0, frames.length - 240), to: frames.length }; });
    if (train) mk(`Train the ${zone?.name ?? 'obstacle'}`, () => { location.search = trainLink(zone?.id ?? 'gap', r.x); });
    panel.append(h, t, row);
    retry.focus();
  }

  function showAgain() { falls--; onFall(lastFall); }

  // Controls are taught while you play: one short hint at a time, then none.
  function hintFor(w: WorldState): string {
    const r = w.runner;
    if (everCleared || falls > 0) return '';
    if (r.tick < 60 || (r.x < 4 && r.tick < 600)) return 'Hold → to run';
    const g = specs.find((q2) => q2.x + 0.2 >= r.x && q2.x - r.x < 9);
    if (g && r.grounded) return 'Press Space just before the edge to jump';
    return '';
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
        input = { run: keys.has('ArrowRight') || keys.has('KeyD'), left: keys.has('ArrowLeft') || keys.has('KeyA'), jump: jumpQueued, jumpSpeed: 0, squat: keys.has('ArrowDown') || keys.has('KeyS') };
        jumpQueued = false;
      }
      const prev = world.outcome;
      world = stepWorld(world, input, course);
      log.push(...world.events);
      for (const e of world.events) {
        if (e.type === 'land' && (e.detail?.impact as number) > 2 && !e.detail?.bouncy) {
          const o = ouch(e.detail?.peakDecel as number);
          squashUntil = world.runner.tick + 40; squashDepth = e.detail?.squat ? 0.7 : o >= 6 ? 0.6 : 0.88;
          if (o >= 3) {
            toast.textContent = o >= 8 ? 'Ouch! Dangerous landing: bend your knees (↓) on big drops.' : o >= 6 ? 'Hard landing: you stumble. Hold ↓ to bend your knees.' : 'Firm landing.';
            toast.style.display = 'block'; toastUntil = world.runner.tick + 90;
          }
        }
      }
      if (replay === null && prev === 'running') frames.push({ x: world.runner.x, y: world.runner.y });
      if (frames.length > 1200) frames.shift();
      if (prev === 'running' && world.outcome === 'splash') onFall('splash');
      if (world.events.some((e) => e.type === 'wall-slide')) onFall('slide');
      if (prev === 'running' && world.outcome === 'cleared') { everCleared = true; try { localStorage.setItem('cc.course.cleared', '1'); } catch { /* ok */ } }
    }
    let r = world.runner;
    if (replay) {
      const f = frames[replay.i];
      replay.i += 1;
      if (replay.i >= replay.to || !f) { replay = null; if (world.outcome !== 'running') showAgain(); } else r = { ...r, x: f.x, y: f.y };
    }
    const sq = world.runner.tick < squashUntil ? squashDepth : 1;
    body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    body.position.set(r.x, r.y + 0.85 * sq, 0);
    if (world.runner.tick > toastUntil) toast.style.display = 'none';
    hint.textContent = hintFor(world);
    hint.style.display = hint.textContent ? 'block' : 'none';
    ropeGroup.rotation.z = world.swing ? world.swing.theta : 0;
    msg.textContent = world.outcome === 'cleared' ? MESSAGES.cleared : '';
    const spd = Math.abs(r.vx);
    gText.textContent = `Speed ${spd.toFixed(1)} m/s`;
    gFill.style.width = `${Math.min(100, (spd / GAUGE_MAX) * 100)}%`;
    const nextGap = specs.find((g) => g.x + 0.2 >= r.x && g.x - r.x < 40 && ['gap', 'landing'].includes(zoneOf(g.x)?.id ?? ''));
    let need = 0, msgNext = '';
    if (nextGap && world.mode === 'run') { need = nextGap.needed; msgNext = `Next gap: ${nextGap.width.toFixed(1)} m wide. You need at least ${need.toFixed(1)} m/s at the edge.`; }
    else if (course.wall && world.mode === 'run' && r.x < course.wall.x0 && course.wall.x0 - r.x < 45) { need = wallNeed; msgNext = `Warped wall: ${(course.wall.height ?? DEFAULT_WALL.height).toFixed(1)} m high. You need at least ${need.toFixed(1)} m/s at its foot.`; }
    gNeed.style.display = need ? 'block' : 'none';
    gNeed.style.left = `${Math.min(100, (need / GAUGE_MAX) * 100)}%`;
    gFill.style.background = need && spd < need ? '#c4572a' : '#0f6b5c';
    gNext.textContent = msgNext;
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
