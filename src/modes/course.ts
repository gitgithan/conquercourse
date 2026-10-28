import { hazardOf, HAZARD_INFO } from '../course/hazard';
import { buildFloor } from '../course/floor';
import { playedSounds, soundButton, soundsFor, startAudio } from '../ui/audio';
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import courseJson from '../course/default-course.json';
import type { CourseData } from '../course/course';
import { NO_INPUT, type RunnerInput } from '../sim/runner';
import { DT } from '../sim/units';
import { newWorld, stepWorld, type GameEvent, type WorldState } from '../sim/world';
import { DEFAULT_WALL } from '../sim/wall';
import { DEFAULT_ROPE } from '../sim/rope';
import { inputFor, searchIdealRun, type Plan } from '../sim/ideal';
import { flightPath, gapSpecs, minSpeedForWall, pressBand } from '../sim/needs';
import { bounce } from '../sim/trampoline';
import { DEFAULT_TRAMPOLINE } from '../sim/trampoline';
import { ouch } from '../sim/landing';
import { track } from '../ui/feedback';
import { createRookieActor } from '../render/actor';
import { lookSwitchOn, lookUrl } from '../render/look';
import { makeObstacle } from '../course/collide';
import { actorStateFor } from '../motion/actor-state';
import { groundAt } from '../sim/terrain';
import { drumsFor } from '../sim/drums';
import { createDrumLane } from '../ui/drum-lane';
import { createDebugView } from '../ui/debug-view';
import { predictRelease } from '../sim/predict';
import { cupsGroup } from '../slice/cups';

// The Course: the five obstacles in a row. The simulator decides everything; this file only draws it
// and turns keys into inputs. Time comes from the simulator's tick count, never from the browser's clock.
const defaultCourse = courseJson as unknown as CourseData;
const LANE_DEPTH = 2; // m, how thick the blocks and the wall are across the screen: thin enough that a camera ahead of the runner cannot hide them behind the block face

export interface CourseGame {
  backend: 'webgpu' | 'webgl2';
  world: () => WorldState;
  restart: () => void;
}

interface Resume { course: CourseData; world: WorldState | null; retryX: number; facing: 1 | -1; falls: number }
const MESSAGES: Record<string, string> = {
  cleared: 'You made it! Press R to run it again.',
};

export async function startCourse(host: HTMLElement, course: CourseData = defaultCourse): Promise<CourseGame> {
  const params = new URLSearchParams(location.search);
  // Coming back from the Dojo: the Course is put back exactly as it was (same course, same place), not started again.
  let resume: Resume | null = null;
  try {
    const raw = sessionStorage.getItem('cc.resume');
    sessionStorage.removeItem('cc.resume');
    if (raw && !params.get('mode')) resume = JSON.parse(raw) as Resume;
  } catch { /* start fresh */ }
  if (resume) course = resume.course;
  // ?wallh=5 makes the wall that high (for tests): the curve stays the same and the deck on top rises with it
  const wallH = Number(params.get('wallh'));
  if (course.wall && wallH >= 3 && wallH <= 6) {
    const R0 = course.wall.radius ?? course.wall.height ?? 4.3;
    course = { ...course, wall: { ...course.wall, height: wallH, radius: R0 }, terrain: { ...course.terrain, platforms: course.terrain.platforms.map((q) => (Math.abs(q.x0 - (course.wall!.x0 + R0)) < 0.5 ? { ...q, top: wallH } : q)) } };
  }
  const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL: params.get('backend') === 'webgl2' });
  await renderer.init();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fc5e8);
  const camera = new THREE.PerspectiveCamera(40, host.clientWidth / host.clientHeight, 0.1, 400);
  // the front view window (bottom right, above the drum lane's row): its frame is a div, its picture a second camera drawn in the same canvas
  const PIP_W = 260, PIP_H = 195, PIP_BOTTOM = 118;
  const frontCam = new THREE.PerspectiveCamera(38, PIP_W / PIP_H, 0.1, 100);
  let frontForced = params.get('front') === '1';
  const pipFrame = document.createElement('div');
  pipFrame.id = 'frontview';
  pipFrame.style.cssText = `position:fixed;right:16px;bottom:${PIP_BOTTOM}px;width:${PIP_W}px;height:${PIP_H}px;box-sizing:border-box;border:3px solid #17201d;border-radius:10px;pointer-events:none;display:none;box-shadow:0 4px 14px #0004`;
  const pipLabel = document.createElement('div');
  pipLabel.textContent = 'Front view (F)';
  pipLabel.style.cssText = 'position:absolute;left:8px;top:6px;font:700 12px system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px #000a';
  pipFrame.appendChild(pipLabel);
  document.body.appendChild(pipFrame);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7f5a, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(20, 40, 30);
  scene.add(sun);

  // ground: platforms are boxes, water fills the gaps
  const stone = new THREE.MeshStandardMaterial({ color: 0xb9b2a3 });
  const grass = new THREE.MeshStandardMaterial({ color: 0x7aa95c });
  const bed = new THREE.MeshStandardMaterial({ color: 0xd9453a });
  // bars hanging in the air (holds): a thin metal bar across the lane with a soft glow so they read from far away
  for (const h of course.holds ?? []) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, LANE_DEPTH + 0.6, 12), new THREE.MeshStandardMaterial({ color: 0xc9ced4, metalness: 0.7, roughness: 0.3 }));
    bar.rotation.x = Math.PI / 2; bar.position.set(h.x, h.y, 0);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.55 }));
    halo.position.set(h.x, h.y, LANE_DEPTH / 2 + 0.32);
    scene.add(bar, halo);
  }
  // a course from the editor draws its real objects instead of blocks: only the start and finish decks stay as ground
  const realObjects = !!course.scene?.length;
  const lastPlatform = course.terrain.platforms.length - 1;
  course.terrain.platforms.forEach((p, pi) => {
    if (realObjects && pi > 0 && pi < lastPlatform) return;
    const bottom = course.terrain.waterY - 2;
    const h = p.top - bottom;
    let geo: THREE.BufferGeometry = new THREE.BoxGeometry(p.x1 - p.x0, h, LANE_DEPTH);
    let at: [number, number, number] = [(p.x0 + p.x1) / 2, bottom + h / 2, 0];
    if (p.profile) {
      // a curved top: the side view's outline, pushed out across the lane
      const shape = new THREE.Shape();
      shape.moveTo(p.x0, bottom);
      for (const [px, py] of p.profile) shape.lineTo(px, py);
      shape.lineTo(p.x1, bottom);
      shape.closePath();
      geo = new THREE.ExtrudeGeometry(shape, { depth: LANE_DEPTH, bevelEnabled: false });
      at = [0, 0, -LANE_DEPTH / 2];
    }
    const m = new THREE.Mesh(geo, p.bouncy ? bed : p.top === 0 ? grass : stone);
    m.position.set(...at);
    scene.add(m);
    if (p.skin) paintSkin(p);
  });
  if (course.scene) {
    const gl = new GLTFLoader();
    const matte = new THREE.MeshStandardMaterial({ color: 0xa9a392, roughness: 0.95, flatShading: true });
    for (const it of course.scene) {
      const g = new THREE.Group();
      g.position.set(it.x, it.y, it.z); g.rotation.y = it.rotY; g.scale.setScalar(it.scale);
      scene.add(g);
      if (it.url) {
        void gl.loadAsync(it.url).then((got) => {
          const obj = got.scene, box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new THREE.Vector3());
          obj.position.set(-c.x, -box.min.y, -c.z);
          g.add(obj);
        }).catch(() => { /* no picture for this one; its collision still works */ });
      } else if (it.stack) {
        g.add(cupsGroup(it.stack));
      } else if (it.mesh) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(it.mesh.positions, 3));
        geo.setIndex(it.mesh.indices); geo.computeVertexNormals();
        g.add(new THREE.Mesh(geo, matte));
      }
    }
  }
  // a picture from a real photo painted on the front of an obstacle (looks only; the obstacle's collision is its box)
  function paintSkin(p: { x0: number; x1: number; top: number; skin?: { image: string; crop: [number, number, number, number] } }) {
    if (!p.skin) return;
    const { image, crop: [cx0, cy0, cx1, cy1] } = p.skin;
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 512 / Math.max(cx1 - cx0, cy1 - cy0));
      const cv = document.createElement('canvas');
      cv.width = Math.max(8, Math.round((cx1 - cx0) * k)); cv.height = Math.max(8, Math.round((cy1 - cy0) * k));
      cv.getContext('2d')!.drawImage(img, cx0, cy0, cx1 - cx0, cy1 - cy0, 0, 0, cv.width, cv.height);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      const faceH = p.top - course.terrain.waterY;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(p.x1 - p.x0, faceH), new THREE.MeshBasicMaterial({ map: tex }));
      plane.position.set((p.x0 + p.x1) / 2, course.terrain.waterY + faceH / 2, LANE_DEPTH / 2 + 0.01);
      scene.add(plane);
      document.documentElement.dataset.skins = String(Number(document.documentElement.dataset.skins ?? 0) + 1);
    };
    img.src = image;
  }
  const hazard = hazardOf(params.get('hazard') ?? course.hazard); // ?hazard=lava tries a floor without editing the course
  const floor = buildFloor(hazard, course.terrain.waterY, course.finishX);
  scene.add(floor.object);

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
    const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: LANE_DEPTH, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xc9893b }));
    wall.position.set(course.wall.x0, 0, -LANE_DEPTH / 2);
    scene.add(wall);
  }

  // the rope hangs from its anchor; it is drawn straight down (it only swings with the runner)
  const ropeLen = course.rope?.length ?? DEFAULT_ROPE.length;
  let ropeMesh: THREE.Mesh | null = null;
  if (course.rope) {
    ropeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, ropeLen, 8), new THREE.MeshStandardMaterial({ color: 0x8a5a2b }));
    ropeMesh.position.set(course.rope.anchorX, course.rope.anchorY - ropeLen / 2, 0);
    scene.add(ropeMesh);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, LANE_DEPTH), stone);
    beam.position.set(course.rope.anchorX, course.rope.anchorY + 0.2, 0);
    scene.add(beam);
  }

  // the runner (a capsule until the Rookie is wired in)
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.1, 6, 12), new THREE.MeshStandardMaterial({ color: 0xf07b1d }));
  scene.add(body);
  // the real Rookie replaces the capsule when its model loads; the capsule stays as the fallback
  let actor: Awaited<ReturnType<typeof createRookieActor>> | null = null;
  let choice: 'a' | 'b' = 'a';
  try { const saved = localStorage.getItem('cc.rookie'); if (saved === 'a' || saved === 'b') choice = saved; } catch { /* keep going */ }
  if (params.get('rookie') === 'a' || params.get('rookie') === 'b') choice = params.get('rookie') as 'a' | 'b';
  // CC-41: with ?look=custom a third button wears the MHR body (skinned to the Rookie's bones); nothing changes without the switch
  const look = lookSwitchOn(location.search);
  let custom = false;
  async function loadRookie(which: 'a' | 'b', wear = false) {
    try {
      const next = await createRookieActor(scene, { rookie: which, url: wear ? lookUrl(look ?? 'custom') : undefined });
      actor?.dispose();
      actor = next; body.visible = false; choice = which; custom = wear;
      if (params.get('nopush') !== '1') actor.setObstacle(makeObstacle(course));
      if (!wear) try { localStorage.setItem('cc.rookie', which); } catch { /* ok */ }
    } catch (e) { console.warn('Rookie not loaded, using the capsule', e); }
  }
  await loadRookie(choice, look !== null);
  let facing: 1 | -1 = resume ? resume.facing : 1;

  // HUD
  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:16px;top:12px;font:600 18px system-ui,sans-serif;color:#10141c;text-shadow:0 1px 0 #fff8;pointer-events:none';
  const msg = document.createElement('div');
  msg.style.cssText = 'position:fixed;left:0;right:0;top:38%;text-align:center;font:700 28px system-ui,sans-serif;color:#10141c;text-shadow:0 1px 0 #fff;pointer-events:none';
  // the controls, always visible top-left as a card of key caps (collapse with H)
  const help = document.createElement('div');
  help.id = 'keys';
  const KEYS: [string, string][] = [['← →', 'Run (hold)'], ['Space', 'Jump · let go of the rope · press on the trampoline'], ['↓', 'Bend your knees (hold, on big drops)'], ['X', 'Roll out of a big drop (tap just before you land)'], ...(course !== defaultCourse ? ([['E', 'Hold a bar with the hands (in the air; let go to fly on)'], ['← → on a bar', 'Pump the swing: push the way you swing'], ['V', 'Vault over a step with a hand on top (fast, saves energy)'], ['F', 'Front view window (it shows by itself on a bar)']] as [string, string][]) : []), ['I', 'Ideal run of this obstacle (Shift+I: the whole course, any key stops it)'], ['G', 'Drums: where the ideal run presses Space'], ['B', 'Debug view: see the collision boxes and where a jump goes'], ['Mouse', 'Drag to turn the view, wheel to zoom, double-click to reset']]; // retry, ideal run and Dojo are on the fall panel and the buttons
  help.style.cssText = 'position:fixed;left:16px;top:48px;width:290px;background:#fffffff0;border:1px solid #cfd6d0;border-radius:12px;padding:8px 10px;font:500 14px system-ui,sans-serif;color:#17201d;box-shadow:0 2px 10px #0002;pointer-events:none;display:grid;gap:5px';
  const paintKeys = (open: boolean) => {
    help.innerHTML = `<div style="font-weight:700;display:flex;justify-content:space-between">Controls <span style="font-weight:400;color:#58635d">H ${open ? 'hides' : 'shows'}</span></div>` + (open ? KEYS.map(([k, d]) => `<div style="display:grid;grid-template-columns:78px 1fr;gap:8px;align-items:center"><kbd style="font:700 13px ui-monospace,monospace;background:#eef1ec;border:1px solid #b9c2bb;border-bottom-width:3px;border-radius:6px;padding:1px 6px;text-align:center">${k}</kbd><span>${d}</span></div>`).join('') : '');
  };
  let keysOpen = true, keysTouched = false; paintKeys(true);
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:50%;top:26%;transform:translateX(-50%);width:min(520px,92vw);background:#fffffff2;border:1px solid #cfd6d0;border-radius:12px;padding:16px;font:16px/1.4 system-ui,sans-serif;color:#17201d;display:none;gap:10px;box-shadow:0 8px 30px #0003';
  const hint = document.createElement('div');
  hint.style.cssText = 'position:fixed;left:50%;bottom:124px;transform:translateX(-50%);font:600 20px system-ui,sans-serif;color:#10141c;background:#fffc;border-radius:10px;padding:8px 16px;pointer-events:none';
  const gauge = document.createElement('div');
  gauge.style.cssText = 'position:fixed;left:50%;top:10px;transform:translateX(-50%);width:min(420px,60vw);font:600 15px system-ui,sans-serif;color:#10141c;text-shadow:0 1px 0 #fff8;pointer-events:none;text-align:center';
  gauge.innerHTML = '<div id="gtext">Speed</div><div style="position:relative;height:14px;background:#10141c33;border-radius:7px;margin-top:3px"><div id="gfill" style="height:100%;width:0;background:#0f6b5c;border-radius:7px"></div><div id="gneed" style="position:absolute;top:-4px;width:3px;height:22px;background:#c4572a;display:none"></div></div><div id="gnext" style="margin-top:4px;font-weight:500"></div>';
  const dojoBtn = document.createElement('button');
  dojoBtn.textContent = 'Dojo (T)';
  dojoBtn.style.cssText = 'position:fixed;right:16px;top:12px;font:600 15px system-ui,sans-serif;border:1px solid #0f6b5c;background:#0f6b5c;color:#fff;border-radius:8px;padding:6px 14px;cursor:pointer';
  dojoBtn.onclick = () => openDojo();
  const idealBtn = document.createElement('button');
  idealBtn.textContent = 'Ideal run (I)';
  idealBtn.style.cssText = 'position:fixed;right:120px;top:12px;font:600 15px system-ui,sans-serif;border:1px solid #17201d;background:#fff;color:#17201d;border-radius:8px;padding:6px 14px;cursor:pointer';
  idealBtn.title = 'Watch the ideal run of this obstacle (I)';
  idealBtn.onclick = () => showIdeal(zoneAt(world.runner.x)?.id ?? 'gap');
  const wholeBtn = document.createElement('button');
  wholeBtn.id = 'wholeideal'; wholeBtn.textContent = 'Whole course (Shift+I)';
  wholeBtn.title = 'Watch one ideal run through every obstacle; any key stops it';
  wholeBtn.style.cssText = 'position:fixed;right:158px;top:56px;font:600 13px system-ui,sans-serif;border:1px solid #17201d;background:#fff;color:#17201d;border-radius:8px;padding:4px 10px;cursor:pointer';
  wholeBtn.onclick = () => { wholeBtn.blur(); showWholeIdeal(); };
  // choose your runner: the male or the female Rookie (remembered between visits)
  const pick = document.createElement('div');
  pick.style.cssText = 'position:fixed;right:250px;top:12px;display:flex;gap:6px';
  const icon = (kind: 'a' | 'b') => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${kind === 'a'
    ? '<circle cx="10" cy="14" r="5.5"/><path d="M14 10 L20 4 M15 4 H20 V9"/>'
    : '<circle cx="12" cy="9" r="5.5"/><path d="M12 14.5 V21 M9 18 H15"/>'}</svg>`;
  const pickBtns = (['a', 'b'] as const).map((k) => {
    const b = document.createElement('button');
    b.innerHTML = icon(k);
    b.title = k === 'a' ? 'Run as the male Rookie' : 'Run as the female Rookie';
    b.setAttribute('aria-label', b.title);
    b.onclick = async () => { await loadRookie(k); paintPick(); };
    pick.appendChild(b); return b;
  });
  if (look !== null) {
    const b = document.createElement('button');
    b.id = 'look-custom';
    b.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="2.5"/><path d="M12 8 V16 M5 11 H19 M12 16 L8 21 M12 16 L16 21"/></svg>';
    b.title = 'Run as your own look';
    b.setAttribute('aria-label', b.title);
    b.onclick = async () => { await loadRookie('a', true); paintPick(); };
    pick.appendChild(b); pickBtns.push(b);
  }
  function paintPick() {
    pickBtns.forEach((b, i) => {
      const on = i === 2 ? custom : !custom && (i === 0 ? 'a' : 'b') === choice;
      b.setAttribute('aria-pressed', String(on));
      b.style.cssText = `display:grid;place-items:center;width:38px;height:34px;border-radius:8px;cursor:pointer;border:2px solid ${on ? '#0f6b5c' : '#b9c2bb'};background:${on ? '#0f6b5c' : '#fff'};color:${on ? '#fff' : '#17201d'}`;
    });
  }
  paintPick();
  // the camera switch: a ring with three nodes (side, 45°, first person); the ring turns a third each time
  const camBtn = document.createElement('button');
  camBtn.id = 'cam';
  camBtn.setAttribute('aria-label', 'Change the camera (C)'); camBtn.title = 'Camera: Side view';
  camBtn.style.cssText = 'position:fixed;right:16px;top:56px;display:grid;justify-items:center;gap:0;border:2px solid #17201d;background:#fff;color:#17201d;border-radius:12px;padding:3px 8px 2px;cursor:pointer;font:600 11px system-ui,sans-serif';
  const node = (a: number) => `<circle cx="${(20 + 13 * Math.sin((a * Math.PI) / 180)).toFixed(1)}" cy="${(20 - 13 * Math.cos((a * Math.PI) / 180)).toFixed(1)}" r="4.2" class="n"/>`;
  camBtn.innerHTML = `<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><g id="ring" style="transform-origin:20px 20px;transition:transform .35s ease"><circle cx="20" cy="20" r="13" fill="none" stroke="currentColor" stroke-width="2.4"/>${node(0)}${node(120)}${node(240)}</g><path d="M20 2 L24 7 L16 7 Z" fill="#c4572a"/></svg><span id="camname">Rotate Camera (C)</span>`;
  camBtn.querySelectorAll('.n').forEach((n) => { (n as SVGElement).style.fill = '#17201d'; });
  let camTurn = 0;
  const nextCam = () => {
    const next = CAMS[(CAMS.findIndex((c2) => c2.id === camMode) + 1) % CAMS.length];
    camMode = next.id; camTurn += 120; resetOrbit();
    (camBtn.querySelector('#ring') as SVGElement).style.transform = `rotate(${camTurn}deg)`;
    camBtn.title = `Camera: ${next.name}`;
    toast.textContent = `Camera: ${next.name}`; toast.style.display = 'block'; toastUntil = world.runner.tick + 100;
    camBtn.blur();
  };
  camBtn.onclick = nextCam;
  // the obstacle strip: one icon per obstacle; cleared ones dim, the rest glow gold in a wave that runs along the strip, the next one is biggest
  const strip = document.createElement('div');
  strip.id = 'strip';
  strip.style.cssText = 'position:fixed;left:50%;top:92px;transform:translateX(-50%);display:flex;gap:10px;align-items:flex-end;pointer-events:none';
  const sstyle = document.createElement('style');
  sstyle.textContent = `@keyframes ccwave{0%,100%{filter:drop-shadow(0 0 2px #e8b43a88);opacity:.72}50%{filter:drop-shadow(0 0 9px #ffd24a);opacity:1}}
    #strip .ob{display:grid;justify-items:center;gap:1px;font:600 11px system-ui,sans-serif;color:#7a5a00;transition:transform .3s,opacity .3s}
    #strip .ob svg{width:34px;height:34px;padding:5px;border-radius:12px;background:#fff8dc;border:2px solid #d9a521;color:#b07d00;box-sizing:content-box}
    #strip .ob.todo svg{animation:ccwave 2.2s ease-in-out infinite}
    #strip .ob.next{transform:scale(1.25);color:#5b4200}#strip .ob.next svg{background:#ffe38a;border-color:#f0b400;color:#6b4a00}
    #strip .ob.done{opacity:.35;filter:grayscale(1)}#strip .ob.done svg{animation:none;background:#eef1ec;border-color:#9aa59e;color:#58635d}`;
  const ICONS: Record<string, string> = {
    gap: '<path d="M3 20 H11 V12 M21 20 H29 V12 M11 12 H3 M21 12 H29 M12 8 Q16 2 20 8" />',
    landing: '<rect x="9" y="12" width="14" height="8" rx="1"/><path d="M16 4 V9 M13 7 L16 10 L19 7"/>',
    wall: '<path d="M4 26 Q22 26 26 4 M26 4 H29"/>',
    rope: '<path d="M5 5 H27 M16 5 V19"/><circle cx="16" cy="23" r="3.5"/>',
    trampoline: '<path d="M4 20 H28 M7 20 L9 26 M25 20 L23 26 M13 14 Q16 4 19 14"/>',
  };
  const stripKey = { v: '' };
  function paintStrip(x: number) {
    const zs = course.zones ?? [];
    const firstTodo = zs.findIndex((z) => x < z.x1);
    const key = zs.map((_, i) => (firstTodo === -1 || i < firstTodo ? 'd' : i === firstTodo ? 'n' : 't')).join('');
    if (key === stripKey.v) return;
    stripKey.v = key;
    strip.innerHTML = '';
    zs.forEach((z, i) => {
      const st = key[i];
      const d = document.createElement('div');
      d.className = 'ob ' + (st === 'd' ? 'done' : st === 'n' ? 'todo next' : 'todo');
      d.style.animationDelay = `${i * 0.35}s`;
      d.title = `${z.name}${st === 'd' ? ' (cleared)' : ''}`;
      d.innerHTML = `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="animation-delay:${(i * 0.35).toFixed(2)}s">${ICONS[z.id] ?? '<circle cx="16" cy="16" r="6"/>'}</svg><span>${st === 'n' ? z.name : ''}</span>`;
      strip.appendChild(d);
    });
  }
  const comm = document.createElement('a');
  comm.href = '?mode=gallery'; comm.id = 'community'; comm.textContent = 'Community courses';
  comm.style.cssText = 'position:fixed;right:16px;top:124px;font:600 13px system-ui,sans-serif;border:1px solid #17201d;background:#fff;color:#17201d;border-radius:8px;padding:4px 10px;text-decoration:none';
  document.body.append(comm);
  document.body.append(sstyle, strip);
  // demo courses: every course we have made, one choice away (the stock course, the lache demo, lanes from real objects, places from the map)
  const demos: [string, string][] = [['', 'Stock course'], ['/assets/demo/lache.course.json', 'Lache demo: run, vault, swing'], ['/assets/demo/stack.course.json', 'Stack demo: climb the cup pyramids'], ['/assets/demo/drop.course.json', 'Big drop: run off a ledge and roll'], ['generate', 'Make me a new course (random)'], ['/assets/demo/lane-1.course.json', 'Demo scene, lane 1'], ['/assets/demo/lane-2.course.json', 'Demo scene, lane 2'], ['/assets/experiments/osm/eixample-barcelona.course.json', 'Place: Barcelona block'], ['/assets/experiments/osm/montmartre-paris.course.json', 'Place: Montmartre, Paris'], ['/assets/experiments/osm/circular-quay-sydney.course.json', 'Place: Sydney quay'], ['/assets/experiments/osm/san-francisco-lombard.course.json', 'Place: San Francisco hill (62 m of hill)'], ['editor', 'Build your own (editor)']];
  const pick2 = document.createElement('select');
  pick2.id = 'democourses'; pick2.title = 'Open another course';
  pick2.style.cssText = 'position:fixed;right:16px;top:196px;max-width:210px;font:600 12px system-ui,sans-serif;border:2px solid #17201d;background:#fff;color:#17201d;border-radius:10px;padding:3px 6px;cursor:pointer';
  const now = params.get('course') ?? '';
  const seedNow = params.get('generate');
  if (seedNow !== null) pick2.add(new Option(`Generated course (seed ${seedNow})`, 'generate-same', true, true));
  for (const [v, label] of demos) pick2.add(new Option(label, v, false, v === now && seedNow === null));
  pick2.onchange = () => { pick2.blur(); location.href = pick2.value === 'editor' ? '?mode=editor' : pick2.value === 'generate' ? `?generate=${Math.floor(Math.random() * 1e6)}` : pick2.value === 'generate-same' ? location.href : pick2.value ? `?course=${pick2.value}` : '?'; };
  document.body.append(pick2);
  // the drum lane (taiko style): on by default for a course someone built (editor or shared), off for the stock course until D is pressed
  const drumLane = createDrumLane(document.body, course !== defaultCourse || params.get('drums') === '1');
  setTimeout(() => { try { drumLane.set(drumsFor(course)); } catch { /* no drums if the search fails */ } }, 0);
  const dbgBtn = document.createElement('button');
  dbgBtn.id = 'debugbtn'; dbgBtn.textContent = 'Debug (B)'; dbgBtn.title = 'Show the collision boxes and where a jump right now would go';
  dbgBtn.style.cssText = 'position:fixed;right:16px;top:166px;border:2px solid #17201d;background:#fff;color:#17201d;border-radius:10px;padding:3px 10px;cursor:pointer;font:600 12px system-ui,sans-serif';
  document.body.append(hud, msg, help, panel, hint, gauge, dojoBtn, idealBtn, wholeBtn, pick, camBtn, dbgBtn);
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;left:50%;top:44%;transform:translateX(-50%);font:700 22px system-ui,sans-serif;color:#10141c;background:#fffffff0;border-radius:10px;padding:6px 14px;pointer-events:none;display:none';
  document.body.append(toast);
  let toastUntil = 0, squashUntil = 0, squashDepth = 1;
  const gText = gauge.querySelector('#gtext') as HTMLElement, gFill = gauge.querySelector('#gfill') as HTMLElement;
  const gNeed = gauge.querySelector('#gneed') as HTMLElement, gNext = gauge.querySelector('#gnext') as HTMLElement;
  try { localStorage.setItem('cc.course', JSON.stringify(course)); } catch { /* the Dojo falls back to the default course */ }
  const specs = gapSpecs(course);
  const zoneOf = (x: number) => course.zones?.find((z) => x >= z.x0 && x < z.x1);
  const wallNeed = course.wall ? minSpeedForWall(course.wall) : Infinity;
  const GAUGE_MAX = 10;
  // numbers painted on the course so the player can see how wide a gap is and how high the wall is
  function label(text: string, x: number, y: number) {
    const c = document.createElement('canvas'); c.width = 400; c.height = 96;
    const g = c.getContext('2d')!; g.fillStyle = '#fffffff0'; g.fillRect(0, 0, 400, 96); g.fillStyle = '#10141c'; g.font = '700 50px system-ui'; g.textAlign = 'center'; g.fillText(text, 200, 66);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c) }));
    sp.scale.set(4.6, 1.1, 1); sp.position.set(x, y, 0.5); scene.add(sp);
  }
  for (const g of specs) { const z = zoneOf(g.x); if (z && (z.id === 'gap' || z.id === 'landing')) label(`${g.width.toFixed(1)} m`, g.x + g.width / 2, Math.max(0, g.rise) + 3); }
  if (course.wall) label(`${(course.wall.height ?? DEFAULT_WALL.height).toFixed(1)} m high`, course.wall.x0 + 2, (course.wall.height ?? DEFAULT_WALL.height) + 1.2);
  if (course.rope) label(`rope ${ropeLen.toFixed(0)} m`, course.rope.anchorX, course.rope.anchorY + 1.6);

  // input
  const keys = new Set<string>();
  let jumpQueued = false, vaultQueued = false, rollQueued = false;
  type Cam = 'side' | 'angle' | 'first';
  const CAMS: { id: Cam; name: string }[] = [{ id: 'side', name: 'Side view' }, { id: 'angle', name: '45° view' }, { id: 'first', name: 'First person' }];
  let camMode: Cam = 'side';
  // while the feedback form is open, or a text box has the focus, no game key does anything (typing a T must not open the Dojo)
  const typing = (e: KeyboardEvent): boolean => {
    const t = e.target as HTMLElement | null;
    return document.getElementById('cc-feedback') !== null || (!!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable));
  };
  addEventListener('keydown', (e) => {
    if (typing(e)) { keys.clear(); jumpQueued = false; vaultQueued = false; rollQueued = false; return; }
    if (paused && !e.repeat) { paused = false; last = performance.now(); }
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space') { jumpQueued = true; e.preventDefault(); }
    if (e.code === 'KeyV') vaultQueued = true;
    if (e.code === 'KeyX') rollQueued = true;
    if (e.code === 'KeyR') { if (e.shiftKey) { retryX = course.startX; restart(course.startX); } else restart(); }
    if (idealWhole && !botMode && e.code !== 'KeyI' && !/^(Shift|Control|Alt|Meta)/.test(e.code)) stopWholeIdeal(); // any key takes the run back
    if (e.code === 'KeyI') { if (e.shiftKey) showWholeIdeal(); else showIdeal(zoneAt(world.runner.x)?.id ?? 'gap'); }
    if (e.code === 'KeyT') openDojo();
    if (e.code === 'Escape' && replay) { replay = null; clearGuides(); showAgain(); }
    if (e.code === 'KeyC') nextCam();
    if (e.code === 'KeyG') drumLane.toggle();
    if (e.code === 'KeyF') frontForced = !frontForced;
    if (e.code === 'KeyB') toggleDebug();
    if (e.code === 'KeyH') { keysTouched = true; keysOpen = !keysOpen; paintKeys(keysOpen); }
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
  const startAt = params.get('startx') === null ? undefined : Number(params.get('startx')); // ?startx=45 begins there (for tests and films)
  if (params.get('bot') === 'ideal') plan = startAt === undefined && course.plan ? course.plan : searchIdealRun(startAt === undefined ? course : { ...course, startX: startAt }).plan;

  const botMode = params.get('bot') === 'ideal';
  let retryX = resume ? resume.retryX : course.startX; // "try this obstacle again" starts standing still just before it
  let demo: { x1: number } | null = null;
  const idealCache = new Map<number, Plan>();
  let idealWhole = false, idealToken = 0, idealPending = 0, idealWorker: Worker | null = null, idealNote = ''; // idealNote: the line shown while an ideal run is working or playing
  const cpFor = (zoneId: string) => course.checkpoints?.find((c) => c.id === zoneId)?.x ?? course.startX;
  const guides = new THREE.Group();
  scene.add(guides);
  const diagBox = document.createElement('div');
  diagBox.style.cssText = 'position:fixed;left:16px;top:70px;width:min(460px,90vw);background:#fffffff2;border:1px solid #cfd6d0;border-radius:10px;padding:10px 14px;font:15px/1.4 system-ui,sans-serif;color:#17201d;display:none;box-shadow:0 4px 18px #0002';
  document.body.append(diagBox);
  let wallEntry = 0;
  let prevMode: string = 'run', prevVx = 0;
  let soundCount = 0;
  let soundedEvents: ReturnType<typeof newWorld>['events'] | null = null;
  startAudio(); document.body.append(soundButton());
  let lastZone = 'gap';

  const debug = createDebugView(scene, course, document.body, params.get('debug') === '1');
  const toggleDebug = () => { debug.toggle(); dbgBtn.textContent = debug.shown ? 'Debug: on (B)' : 'Debug (B)'; dbgBtn.blur(); };
  dbgBtn.onclick = toggleDebug;
  let world = resume?.world ?? newWorld(course, resume ? resume.retryX : startAt);
  let paused = !!resume?.world; // a run that was in progress waits for a key, so the player is not dropped into the middle of a jump
  const log: GameEvent[] = [];
  const frames: { x: number; y: number }[] = [];
  let replay: { i: number; from: number; to: number } | null = null; // i is a float: the replay runs at half speed
  let falls = resume ? resume.falls : 0;
  let everCleared = false;
  try { everCleared = localStorage.getItem('cc.course.cleared') === '1'; } catch { /* keep going */ }
  let windows: ReturnType<typeof searchIdealRun>['windows'] | null = null;
  const zoneAt = (x: number) => course.zones?.find((z) => x >= z.x0 && x < z.x1);
  function clearGuides() {
    while (guides.children.length) { const c = guides.children[0] as THREE.Mesh; guides.remove(c); c.geometry?.dispose(); }
    diagBox.style.display = 'none';
  }
  function restart(x: number = retryX) {
    clearGuides();
    if (!botMode) plan = null;
    demo = null; idealWhole = false; idealPending = 0;
    world = newWorld(course, x);
    log.length = 0;
    botState.next = 0; botState.caught = null; botState.bedAt = null;
    idealNote = '';
    msg.textContent = '';
    frames.length = 0; replay = null; panel.style.display = 'none';
    squashUntil = 0; toastUntil = 0; toast.style.display = 'none';
  }

  // The Dojo is reachable any time: it opens on the obstacle nearest the runner (R2-G4).
  function saveResume() {
    try { sessionStorage.setItem('cc.resume', JSON.stringify({ course, world: world.outcome === 'running' ? world : null, retryX, facing, falls } satisfies Resume)); } catch { /* the Course starts again */ }
  }
  function openDojo() {
    track('dojo_opens');
    saveResume();
    const x = world.runner.x;
    const z = zoneAt(x)?.id ?? 'gap';
    location.search = trainLink(z, x);
  }

  // The Dojo opens on the very obstacle the player fell at, with its real numbers (R1-L1, R1-L3).
  function trainLink(zoneId: string, x: number): string {
    const q = new URLSearchParams({ mode: 'dojo', ex: zoneId === 'lache' ? 'bars' : zoneId, from: 'course' }); // the lache pair trains on the bar swing
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

  // The ideal run: the simulator's own best line from standing still at x0. A plan always runs on to the finish, so
  // "this obstacle" only stops it at the end of the zone (demo) and "the whole course" lets it run (Shift+I).
  function findPlan(c: CourseData): Promise<Plan> {
    return new Promise((resolve) => {
      try {
        idealWorker ??= new Worker(new URL('../sim/ideal-worker.ts', import.meta.url), { type: 'module' });
        const w = idealWorker, id = ++idealToken;
        const on = (e: MessageEvent) => { if (e.data.id !== id) return; w.removeEventListener('message', on); resolve(e.data.plan as Plan); };
        w.addEventListener('message', on);
        w.postMessage({ id, course: c });
      } catch { resolve(searchIdealRun(c).plan); } // no worker here: search on the page's thread
    });
  }
  async function startIdeal(x0: number, zoneId: string | null) {
    let p = idealCache.get(x0) ?? (x0 === course.startX ? course.plan : undefined);
    const token = ++idealToken;
    if (!p) {
      idealNote = 'Working out the ideal run… (any key cancels)';
      idealPending = token;
      p = await findPlan({ ...course, startX: x0 });
      if (idealPending !== token) return; // cancelled while the search ran
      idealPending = 0;
      idealCache.set(x0, p);
    }
    clearGuides();
    world = newWorld(course, x0);
    log.length = 0; frames.length = 0; replay = null; panel.style.display = 'none';
    plan = p; botState.next = 0; botState.caught = null; botState.bedAt = null;
    idealWhole = zoneId === null;
    demo = zoneId === null ? null : { x1: (course.zones?.find((z) => z.id === zoneId)?.x1 ?? 1e9) + 3 };
    idealNote = zoneId === null ? 'Ideal run through every obstacle: watch it, press any key to take over.' : 'Ideal run: watch how it is done, then press R to try it yourself.';
  }
  function showIdeal(zoneId: string) { idealWhole = false; void startIdeal(cpFor(zoneId), zoneId); }
  // Shift+I: from the start, or from where retry would start (the checkpoint before the obstacle you fell at), to the finish
  function showWholeIdeal() { void startIdeal(retryX, null); }
  function stopWholeIdeal() {
    idealWhole = false; idealPending = 0; idealToken++;
    if (!botMode) plan = null;
    idealNote = 'Your turn.'; setTimeout(() => { if (idealNote === 'Your turn.') idealNote = ''; }, 2500);
  }
  function demoEnd() {
    const whole = idealWhole; idealNote = '';
    plan = botMode ? plan : null; demo = null; idealWhole = false;
    panel.innerHTML = ''; panel.style.display = 'grid';
    const h = document.createElement('strong'); h.textContent = whole ? 'That was the ideal run through every obstacle. Your turn.' : 'That was the ideal run. Your turn.';
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
    const b = document.createElement('button'); b.textContent = 'Try it myself (R)';
    b.style.cssText = 'font:inherit;border:1px solid #0f6b5c;background:#0f6b5c;color:#fff;border-radius:8px;padding:6px 12px;cursor:pointer;font-weight:700';
    b.onclick = () => restart(); row.appendChild(b); panel.append(h, row); b.focus();
  }

  // Replay numbers and guiding lines, so the player learns something new instead of watching the same thing again.
  function guideBand(x0: number, x1: number, y: number, color: number) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.05, x1 - x0), 0.06, 1.6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 }));
    m.position.set((x0 + x1) / 2, y + 0.04, 0.4); guides.add(m);
  }
  function guideLine(x: number, y: number, h: number, color: number) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, h, 0.07), new THREE.MeshBasicMaterial({ color })); m.position.set(x, y + h / 2, 0.4); guides.add(m);
  }
  function guidePath(pts: { x: number; y: number }[], color: number) {
    const g = new THREE.BufferGeometry().setFromPoints(pts.filter((_, i) => i % 3 === 0).map((q) => new THREE.Vector3(q.x, q.y + 0.9, 0.5)));
    guides.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color })));
  }
  function buildDiag(zoneId: string, what: 'splash' | 'slide'): string[] {
    const L: string[] = [];
    const jump = [...log].reverse().find((e) => e.type === 'jump');
    const push = course.jumpSpeed;
    if (what === 'slide' && course.wall) {
      const wp = { ...DEFAULT_WALL, ...course.wall };
      const need = wp.height - wp.hipHeight - wp.reach;
      const ev = [...log].reverse().find((e) => e.type === 'wall-slide');
      const margin = (ev?.detail?.margin as number) ?? 0;
      L.push(`Speed at the foot of the wall: ${wallEntry.toFixed(1)} m/s. This wall needs at least ${wallNeed.toFixed(1)} m/s.`);
      L.push(`Your feet climbed ${(need + margin).toFixed(1)} m; they had to climb ${need.toFixed(1)} m for your hands to reach the top.`);
      guideBand(course.wall.x0, course.wall.x0 + 3, need, 0x2ca66f); guideBand(course.wall.x0, course.wall.x0 + 3, need + margin, 0xe8622c);
      L.push('Green line: the height you needed. Orange line: the height you reached.');
    } else if ((zoneId === 'gap' || zoneId === 'landing') && jump) {
      const v = jump.detail?.vx as number, px = jump.detail?.x as number;
      const g = specs.find((q2) => px >= q2.x - 6.5 && px <= q2.x + 0.2) ?? specs.find((q2) => q2.x >= px - 1);
      if (g) {
        const y0 = groundAt(course.terrain, g.x - 0.1);
        L.push(`Speed when you jumped: ${v.toFixed(1)} m/s. This ${g.width.toFixed(1)} m gap needs at least ${g.needed.toFixed(1)} m/s.`);
        L.push(`You pressed Space ${Math.max(0, g.x - px).toFixed(1)} m before the edge.`);
        const band = pressBand(course.terrain, g.x, y0, g.width, v, push);
        if (band) { L.push(`At ${v.toFixed(1)} m/s, pressing between ${(g.x - band.hi).toFixed(1)} and ${(g.x - band.lo).toFixed(1)} m before the edge works (green strip).`); guideBand(band.lo, band.hi, y0, 0x2ca66f); }
        else L.push(`At ${v.toFixed(1)} m/s no press works: even at the very edge you fall short. Run longer first.`);
        const mine = flightPath(course.terrain, px, y0, v, push);
        const ideal = flightPath(course.terrain, g.x - 0.2, y0, Math.max(g.needed + 0.4, v), push);
        L.push(`Your jump flew ${(mine.x - px).toFixed(1)} m; the far side is ${(g.x + g.width - px).toFixed(1)} m from where you jumped.`);
        guidePath(mine.pts, 0xe8622c); guidePath(ideal.pts, 0x2ca66f); guideLine(px, y0, 2.5, 0xd33);
        L.push('Orange: your flight. Green: a flight that works. Red post: where you pressed.');
      }
    } else if (zoneId === 'trampoline') {
      const ev = [...log].reverse().find((e) => e.type === 'bounce' && e.detail?.vyOut !== undefined);
      const bedTop = groundAt(course.terrain, course.terrain.platforms.find((q2) => q2.bouncy)?.x0 ?? 0);
      const top = course.terrain.platforms[course.terrain.platforms.length - 1].top;
      const vIn = Math.sqrt(2 * 9.81 * (course.terrain.platforms.find((q2) => q2.bouncy) ? Math.max(0.1, top - bedTop) : 4));
      const base = bounce(vIn, DEFAULT_TRAMPOLINE).vyOut;
      const needV = Math.sqrt(2 * 9.81 * (top - bedTop + 0.3));
      L.push(`Your press added ${((ev?.detail?.gain as number) ?? 0).toFixed(1)} of a possible ${DEFAULT_TRAMPOLINE.pump.toFixed(1)} m/s.`);
      L.push(`Without a press the trampoline throws you ${((base * base) / (2 * 9.81)).toFixed(1)} m high; the far platform is ${(top - bedTop).toFixed(1)} m up, so you need an extra ${Math.max(0, needV - base).toFixed(1)} m/s.`);
      L.push('Press Space while you are pressing into the trampoline (the bottom of the bounce is best).');
    } else if (zoneId === 'rope') {
      const ev = [...log].reverse().find((e) => e.type === 'rope-release');
      if (ev) L.push((ev.detail?.vy as number) > 0 ? 'You let go while rising: good. If you fell short, let go a little later.' : 'You let go while falling back down: let go earlier, while you are still rising.');
      else L.push('You never grabbed the rope. Jump from the end of the deck so your hands meet it.');
    }
    return L;
  }

  // After a fall: retry at once, one tip, a skippable replay, and the offer to train that obstacle.
  let lastFall: 'splash' | 'slide' | 'hurt' = 'splash';
  function onFall(what: 'splash' | 'slide' | 'hurt') {
    falls++; track('falls');
    lastFall = what;
    const r = world.runner;
    const zone = zoneAt(what === 'slide' && course.wall ? course.wall.x0 + 1 : r.x);
    lastZone = zone?.id ?? 'gap';
    retryX = cpFor(lastZone);
    const jump = [...log].reverse().find((e) => e.type === 'jump');
    let tip = 'Try again.';
    if (what === 'slide') tip = 'You ran out of speed on the curve. Start the run-up earlier and keep running.';
    else if (what === 'hurt') tip = 'The ground stopped you too fast. Tap X just before you land to roll: the same fall is spread over more time, and a roll keeps most of your speed.';
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
    h.textContent = what === 'slide' ? 'You slid back down the wall.' : what === 'hurt' ? `Hard landing at the ${zone?.name ?? 'course'}.` : HAZARD_INFO[hazard].headline(zone?.name ?? 'course');
    const t = document.createElement('div'); t.textContent = tip;
    const floorNote = document.createElement('div'); floorNote.style.cssText = 'color:#58635d;font-size:13px'; floorNote.textContent = what === 'slide' || what === 'hurt' ? '' : HAZARD_INFO[hazard].hint;
    const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
    const mk = (label: string, fn: () => void, primary = false) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = `font:inherit;border:1px solid ${primary ? '#0f6b5c' : '#b9c2bb'};background:${primary ? '#0f6b5c' : '#fff'};color:${primary ? '#fff' : '#17201d'};border-radius:8px;padding:6px 12px;cursor:pointer;font-weight:${primary ? 700 : 400}`;
      b.onclick = fn; row.appendChild(b); return b;
    };
    const retry = mk(`Try this ${zone?.name ?? 'obstacle'} again (R)`, () => restart(retryX), true);
    if (retryX !== course.startX) mk('Start from the beginning (Shift+R)', () => { retryX = course.startX; restart(course.startX); });
    mk('Watch what happened, with the numbers', () => {
      panel.style.display = 'none';
      const from = Math.max(0, frames.length - 300);
      replay = { i: from, from, to: frames.length };
      const lines = buildDiag(lastZone, what === 'slide' ? 'slide' : 'splash');
      diagBox.innerHTML = `<strong>Slow-motion replay</strong><ul style="margin:6px 0 0;padding-left:18px">${lines.map((l) => `<li>${l}</li>`).join('')}</ul><div style="color:#58635d;font-size:13px;margin-top:6px">Esc to skip</div>`;
      diagBox.style.display = 'block';
    });
    mk('Show me the ideal run (I)', () => showIdeal(lastZone));
    if (train) mk(`Train the ${zone?.name ?? 'obstacle'}`, () => { saveResume(); location.search = trainLink(zone?.id ?? 'gap', r.x); });
    panel.append(h, t, floorNote, row);
    retry.focus();
  }

  function showAgain() { falls--; onFall(lastFall); }

  // Controls are taught while you play: one short hint at a time, then none.
  // what the Rookie needs to know about the course: where the top edge of the wall is, and the next obstacle ahead
  const wallR = course.wall ? course.wall.radius ?? course.wall.height ?? DEFAULT_WALL.height : 0;
  const ledge = course.wall ? { x: course.wall.x0 + wallR, y: course.wall.height ?? DEFAULT_WALL.height } : undefined;
  const aheadOf: { kind: 'gap' | 'wall' | 'rope' | 'bounce'; x: number }[] = [
    ...specs.map((g) => ({ kind: 'gap' as const, x: g.x })),
    ...(course.wall ? [{ kind: 'wall' as const, x: course.wall.x0 }] : []),
    ...(course.rope ? [{ kind: 'rope' as const, x: course.rope.anchorX - 3 }] : []),
    ...course.terrain.platforms.filter((q) => q.bouncy).map((q) => ({ kind: 'bounce' as const, x: q.x0 })),
  ];
  function nextObstacle(x: number): { kind: 'gap' | 'wall' | 'rope' | 'bounce'; distance: number } | undefined {
    let best: { kind: 'gap' | 'wall' | 'rope' | 'bounce'; distance: number } | undefined;
    for (const o of aheadOf) { const d = o.x - x; if (d > -0.2 && (!best || d < best.distance)) best = { kind: o.kind, distance: Math.max(0, d) }; }
    return best;
  }
  let maxPen = 0, handErr = 9;
  let cueSince: number | null = null, cueDone = false;
  function hintFor(w: WorldState): string {
    const r = w.runner;
    if (w.mode === 'bounce') { cueDone = true; return ''; }
    // the trampoline cue comes early and stays for 4 seconds (or until you land on the bed), so it can be read before the bounce
    const bed = course.terrain.platforms.find((q2) => q2.bouncy && r.x < q2.x1);
    if (!bed || bed.x0 - r.x > 14 || w.outcome !== 'running') { cueSince = null; cueDone = false; } // far from the bed, or restarted: the cue starts over
    if (bed && !cueDone && w.mode === 'run' && w.outcome === 'running' && !(course.rope && r.x < course.rope.anchorX + 1) && // not while the rope is still ahead: it only flashed for a moment there
       (bed.x0 - r.x < 14 || (cueSince !== null && r.tick - cueSince < 480))) {
      cueSince ??= r.tick;
      return 'Trampoline ahead: press Space the moment you land on it for extra height';
    }
    if (w.mode === 'swing') return 'Press Space to let go while you are still rising';
    if (w.mode === 'hang') {
      // a push cue (the way the body is swinging) and a let-go cue from the simulator's own look ahead
      const fwd = (w.hang?.omega ?? 0) >= 0, rel = predictRelease(w, course);
      return `${fwd ? 'Push →' : 'Push ←'} with the swing (hold E)  ·  ${rel.result === 'lands' && /next bar|ground/.test(rel.why) ? 'LET GO NOW: ' + rel.why : 'keep swinging: ' + rel.why}`;
    }
    if (course.holds?.length && w.mode === 'run' && !r.grounded) { const next = course.holds.find((h) => h.x > r.x - 0.5); if (next && Math.abs(next.x - r.x) < 2.5) return 'Hold E to grab the bar'; }
    if (everCleared || falls > 0) return '';
    if (r.tick < 60 || (r.x < 4 && r.tick < 600)) return 'Hold → to run';
    const g = specs.find((q2) => q2.x + 0.2 >= r.x && q2.x - r.x < 9);
    if (g && r.grounded) return 'Press Space just before the edge to jump';
    return '';
  }

  let last = performance.now();
  let acc = 0;
  const camPos = new THREE.Vector3();
  // Mouse: drag turns the view around the runner, the wheel zooms, a double-click (or C) goes back to the preset.
  // The numbers are changes on top of the preset view, so zero means the preset exactly.
  const orbit = { yaw: 0, pitch: 0, zoom: 1 };
  const resetOrbit = () => { orbit.yaw = 0; orbit.pitch = 0; orbit.zoom = 1; };
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const dom = renderer.domElement;
  let dragging: { x: number; y: number } | null = null;
  dom.addEventListener('pointerdown', (e) => { if (e.button === 0) { dragging = { x: e.clientX, y: e.clientY }; dom.setPointerCapture(e.pointerId); dom.style.cursor = 'grabbing'; } });
  dom.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
    dragging = { x: e.clientX, y: e.clientY };
    if (camMode === 'first') { orbit.yaw = clamp(orbit.yaw + dx * 0.006, -1.4, 1.4); orbit.pitch = clamp(orbit.pitch - dy * 0.004, -0.6, 0.6); }
    else { orbit.yaw = clamp(orbit.yaw - dx * 0.006, -1.4, 1.4); orbit.pitch = clamp(orbit.pitch + dy * 0.004, -0.5, 1.0); }
  });
  const stopDrag = () => { dragging = null; dom.style.cursor = 'grab'; };
  dom.addEventListener('pointerup', stopDrag); dom.addEventListener('pointercancel', stopDrag);
  dom.addEventListener('wheel', (e) => { e.preventDefault(); if (camMode !== 'first') orbit.zoom = clamp(orbit.zoom * Math.exp(e.deltaY * 0.001), 0.45, 1.7); }, { passive: false });
  dom.addEventListener('dblclick', resetOrbit);
  dom.addEventListener('contextmenu', (e) => e.preventDefault());
  dom.style.cursor = 'grab';
  const timeScale = Number(params.get('timescale') ?? 1); // ?timescale=0.1 runs the game at a tenth of its speed (for stills)
  function frame(now: number) {
    acc = paused ? 0 : Math.min(acc + ((now - last) / 1000) * timeScale, 0.25);
    last = now;
    while (acc >= DT) {
      acc -= DT;
      let input: RunnerInput = NO_INPUT;
      if (plan) input = inputFor(plan, world, botState, course);
      else {
        input = { run: keys.has('ArrowRight') || keys.has('KeyD'), left: keys.has('ArrowLeft') || keys.has('KeyA'), jump: jumpQueued, jumpSpeed: 0, squat: keys.has('ArrowDown') || keys.has('KeyS'), handL: keys.has('KeyE'), handR: keys.has('KeyE'), vault: vaultQueued, roll: rollQueued };
        jumpQueued = false; vaultQueued = false; rollQueued = false;
      }
      const prev = world.outcome;
      prevMode = world.mode; prevVx = world.runner.vx;
      world = stepWorld(world, input, course);
      if (prevMode === 'run' && world.mode === 'wall') wallEntry = prevVx;
      if (demo && (world.outcome !== 'running' || world.runner.x > demo.x1)) demoEnd();
      else if (idealWhole && world.outcome !== 'running') demoEnd();
      log.push(...world.events);
      if (world.events !== soundedEvents) { soundedEvents = world.events; if (!replay) soundsFor(world.events, hazard); } // after the end the same events array stays: it sounds once
      for (const e of world.events) {
        if (e.type === 'jump' && keysOpen && !keysTouched) { keysOpen = false; paintKeys(false); } // the controls card has done its job once you have jumped
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
      if (prev === 'running' && world.outcome === 'hurt') onFall('hurt');
      if (world.events.some((e) => e.type === 'wall-slide')) onFall('slide');
      if (prev === 'running' && world.outcome === 'cleared') { everCleared = true; track('clears'); try { localStorage.setItem('cc.course.cleared', '1'); } catch { /* ok */ } }
    }
    let r = world.runner;
    if (replay) {
      const f = frames[Math.floor(replay.i)];
      replay.i += 0.5;
      if (replay.i >= replay.to || !f) { replay = null; clearGuides(); if (world.outcome !== 'running') showAgain(); } else r = { ...r, x: f.x, y: f.y };
    }
    const sq = world.runner.tick < squashUntil ? squashDepth : 1;
    body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    body.position.set(r.x, r.y + 0.85 * sq, 0);
    if (Math.abs(world.runner.vx) > 0.3) facing = world.runner.vx < 0 ? -1 : 1;
    if (actor) actor.update({ ...actorStateFor(world, keys.has('ArrowDown') || keys.has('KeyS'), facing), x: r.x, y: r.y, ledge, next: world.mode === 'run' ? nextObstacle(r.x) : undefined });
    if (world.runner.tick > toastUntil) toast.style.display = 'none';
    paintStrip(r.x);
    drumLane.update(r.x);
    debug.update(world);
    if (params.get('check') === '1' && actor && ledge && world.mode === 'wall') {
      // how close the nearest hand gets to the wall's top edge while the climb is on
      const j = actor.joints();
      const hands = j.filter((_, i) => /Hand$/.test(actor!.names()[i]));
      const err = Math.min(...hands.map((h) => Math.hypot(h.x - ledge.x, h.y - ledge.y)));
      handErr = Math.min(handErr, err);
      document.documentElement.dataset.handErr = handErr.toFixed(3);
    }
    if (params.get('check') === '1' && actor) {
      // measurement for the tests: the deepest any joint sits inside a block or the wall, over the whole run (metres)
      const hit = makeObstacle(course);
      actor.joints().forEach((j, i) => { const o = hit(j.x, j.y, 0); if (o && Math.hypot(o.dx, o.dy) > maxPen) { maxPen = Math.hypot(o.dx, o.dy); document.documentElement.dataset.maxPenWhere = `${world.mode} x=${r.x.toFixed(1)} y=${r.y.toFixed(1)} joint=${i} at (${j.x.toFixed(2)}, ${j.y.toFixed(2)})`; } });
      document.documentElement.dataset.maxPen = maxPen.toFixed(3);
    }
    hint.textContent = hintFor(world);
    hint.style.display = hint.textContent ? 'block' : 'none';
    if (ropeMesh && course.rope) {
      // the rope swings about its anchor with the runner: its middle is half a rope length along the swing
      const th = world.swing ? world.swing.theta : 0;
      ropeMesh.rotation.z = th;
      ropeMesh.position.set(course.rope.anchorX + (ropeLen / 2) * Math.sin(th), course.rope.anchorY - (ropeLen / 2) * Math.cos(th), 0);
      ropeMesh.updateMatrix(); ropeMesh.updateMatrixWorld(true);
    }
    msg.textContent = paused ? 'Back from the Dojo. Press any key to carry on.' : world.outcome === 'cleared' ? MESSAGES.cleared : idealNote;
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
    // three views, switched with C: from the side, from behind at 45 degrees, and through the runner's eyes
    const fov = camMode === 'first' ? 75 : 40;
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    if (actor) actor.object.visible = camMode !== 'first';
    body.visible = !actor && camMode !== 'first';
    if (camMode === 'first') {
      camera.position.set(r.x + 0.15 * facing, r.y + 1.62, 0.1);
      const ch = Math.cos(orbit.pitch); // drag turns your head
      camera.lookAt(r.x + 0.15 * facing + 10 * facing * Math.cos(orbit.yaw) * ch, r.y + 1.62 - 0.42 + 10 * Math.sin(orbit.pitch), 0.1 + 10 * facing * Math.sin(orbit.yaw) * ch);
      camPos.copy(camera.position);
    } else {
      // the preset is a target point and an offset from it; the mouse turns and scales the offset around the target
      const tx = camMode === 'side' ? r.x + 5 : r.x + 4, ty = camMode === 'side' ? r.y + 2.5 : r.y + 1.5;
      const off = camMode === 'side' ? new THREE.Vector3(0, 1.5, 25) : new THREE.Vector3(-12, 3, 11);
      const len = off.length() * orbit.zoom;
      const yaw = Math.atan2(off.x, off.z) + orbit.yaw, pitch = clamp(Math.asin(off.y / off.length()) + orbit.pitch, 0.03, 1.35);
      const want = new THREE.Vector3(tx + len * Math.cos(pitch) * Math.sin(yaw), Math.max(0.5, ty + len * Math.sin(pitch)), len * Math.cos(pitch) * Math.cos(yaw));
      camPos.lerp(want, 0.12);
      camera.position.copy(camPos);
      camera.lookAt(tx, ty, 0);
    }
    floor.update(now / 1000);
    renderer.render(scene, camera);
    // the front view: a small second camera in a corner window, shown while hanging from a bar (F shows it any time)
    const showFront = frontForced || world.mode === 'hang';
    pipFrame.style.display = showFront ? 'block' : 'none';
    if (showFront) {
      const hold = world.hang ? course.holds?.[world.hang.hold] : undefined;
      const fx = hold ? hold.x : r.x, fy = hold ? hold.y - 0.9 : r.y + 1.1;
      frontCam.position.set(fx + 2.9, fy + 0.35, 0.8); frontCam.lookAt(fx, fy, 0);
      const W = host.clientWidth, H = host.clientHeight;
      renderer.autoClear = false;
      renderer.setScissorTest(true);
      const py = H - PIP_BOTTOM - PIP_H; // the WebGPU viewport counts from the top
      renderer.setViewport(W - PIP_W - 16, py, PIP_W, PIP_H); renderer.setScissor(W - PIP_W - 16, py, PIP_W, PIP_H);
      renderer.render(scene, frontCam);
      renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); renderer.autoClear = true;
    }
    document.documentElement.dataset.tick = String(r.tick);
    document.documentElement.dataset.x = r.x.toFixed(2); document.documentElement.dataset.omega = (world.hang?.omega ?? 0).toFixed(3); document.documentElement.dataset.grounded = world.runner.grounded ? '1' : '0'; // for the keyboard check
    document.documentElement.dataset.outcome = world.outcome;
    if (playedSounds().length !== soundCount) { soundCount = playedSounds().length; document.documentElement.dataset.sounds = playedSounds().join(','); } // for the bot check: headless cannot be heard
    document.documentElement.dataset.mode = world.mode;
    requestAnimationFrame(frame);
  }
  camPos.set(5, 3.5, 17);
  requestAnimationFrame(frame);

  const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';
  return { backend, world: () => world, restart };
}
