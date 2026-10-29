import { filmShotOf } from '../film/camera';
import { hazardOf, HAZARD_INFO } from '../course/hazard';
import { buildFloor } from '../course/floor';
import { setMusicScreen } from '../ui/music';
import { playedSounds, soundButton, soundsFor, startAudio } from '../ui/audio';
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import courseJson from '../course/default-course.json';
import type { CourseData } from '../course/course';
import { NO_INPUT, type RunnerInput } from '../sim/runner';
import { DT } from '../sim/units';
import { droneParams, newWorld, recoilParams, stepWorld, type GameEvent, type WorldState } from '../sim/world';
import { energyWords, isAimable, shotEnergy } from '../sim/recoil';
import { weight } from '../sim/drone';
import { DEFAULT_WALL } from '../sim/wall';
import { DEFAULT_ROPE } from '../sim/rope';
import { inputFor, searchIdealRun, workSeconds, xWindows, type Plan, type SearchResult, type Window } from '../sim/ideal';
import { IdealPool } from '../sim/ideal-pool';
import { createGhost } from '../ui/ghost';
import { lookOfParam } from '../ui/ghost-look';
import { challengeWords, courseTooBig, makeChallengeUrl, offersIdeal, openChallenge, secondsWords, shareOn } from '../share/challenge';
import { MARKER_BELOW, RUNNER_M, TICKS_PER_FRAME, clipCameraDistance, clipCrop, clipFits, clipFrames, clipLayoutFor, createClipEncoder, drawClipFrame, clipViewMetres, type ClipLayout } from '../share/clip';
import { mountTouch, touchOn } from '../share/touch';
import { createGaugeStack } from '../ui/gauges';
import { HUD, hudOn, keycapCss, panelCss } from '../ui/hud-style';
import { PHONE_WORDS, browserPointing, phoneMode } from '../share/phone';
import { clipCard, shareButtons, showBanner } from '../share/share-ui';
import { organiseReport, reportSectionsOn } from '../ui/report-sections';
import { courseHash, encodeLog, inputOfMask, type InputLog } from '../sim/replay';
import { findShortcuts, shortcutLine, type Shortcut } from '../sim/shortcuts';
const findShortcutsNow = (c: CourseData): Shortcut[] => findShortcuts(c, { moveChoices: false }).shortcuts; // ?bot=shortcut only: blocks the page while it searches
import { flightPath, gapSpecs, minSpeedForWall, pressBand } from '../sim/needs';
import { bounce } from '../sim/trampoline';
import { DEFAULT_TRAMPOLINE } from '../sim/trampoline';
import { ouch } from '../sim/landing';
import { logTicks } from '../sim/run-checks';
import { track, trackCourseEvent, courseKey, sendClear } from '../ui/feedback';
import { statsOn, statKey } from '../ui/course-stats';
import { createRookieActor } from '../render/actor';
import { lookSwitchOn, lookUrl } from '../render/look';
import { makeObstacle } from '../course/collide';
import { climbAhead } from '../sim/climb';
import { DEFAULT_HANG, feetOf, handOffset } from '../sim/holds';
import { actorStateFor } from '../motion/actor-state';
import { groundAt } from '../sim/terrain';
import { drumsFor } from '../sim/drums';
import { createDrumLane } from '../ui/drum-lane';
import { bestLine, buildReport, clearLog, logTick, newLog, renderReport } from '../ui/run-report';
import { ZONE_ICONS } from '../ui/zone-icons';
import { BUTTON_PLACE, buildGallery, currentWorld, DEMOS, GALLERY_EVENT, modalAttrs, mountWorldGallery, WORD_VALUES, worldHref } from '../ui/world-picker';
import { createDebugView } from '../ui/debug-view';
import { createGrabHint } from '../ui/grab-hint';
import { slugOfCourse } from '../ui/place-photos';
import { mountLivePhotos } from '../ui/live-photos';
import { barName, predictBand, predictLaunch, predictRelease, predictShot, type Prediction } from '../sim/predict';
import { createTrebuchetView } from '../ui/trebuchet-view';
import { createRecoilView } from '../ui/recoil-view';
import { createBandView } from '../ui/band-view';
import { bandParams, stretchAt } from '../sim/band';
import { createDroneView } from '../ui/drone-view';
import { cupsGroup } from '../slice/cups';
import { buildTrack, type TrackView } from '../render/track';
import { buildPlanks } from '../render/plank';
import { topAt } from '../sim/beam';
import { crestSpeedLimit, railsOf } from '../sim/cart';
import { installGraphStudio } from './graph-studio';
import { createPerf, type PerfSource } from '../ui/perf';
import { chunked, cullFar, mergeStatic, type Part } from '../render/static-merge';
import { EDIT_KEY, handoffCourse, type EditHandoff } from '../slice/roundtrip';
import { startOnboarding, type Onboarding } from '../ui/onboarding';
import { browserStore, rememberCourse, tourDecision } from '../ui/onboarding-flags';

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
  if (course.wall && params.get('warpedE') === '0') course = { ...course, wall: { ...course.wall, needE: false } }; // the old rule: the warped wall is grabbed without E
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
  scene.background = new THREE.Color(/^[0-9a-f]{6}$/i.test(params.get('bg') ?? '') ? parseInt(params.get('bg')!, 16) : 0x9fc5e8); // ?bg=rrggbb only for pictures over other backgrounds (CC-167)
  const camera = new THREE.PerspectiveCamera(40, host.clientWidth / host.clientHeight, 0.1, 400);
  // the front view window (bottom right, above the drum lane's row): its frame is a div, its picture a second camera drawn in the same canvas
  const PIP_W = 260, PIP_H = 195, PIP_BOTTOM = 118;
  const frontCam = new THREE.PerspectiveCamera(75, PIP_W / PIP_H, 0.1, 200); // first person: wide, from the eyes
  let frontOverride: boolean | null = params.has('front') ? params.get('front') === '1' : null;
  let camY = 0, camYSet = false, lastPlankNow = 0; // the camera's height target eases, so a fast dip (as on a plank) does not snap the view
  let pipRoll = 0, pipClock = 0; // the head's turn about the bar (rad) and the clock it settles by
  const pipFrame = document.createElement('div');
  pipFrame.id = 'frontview';
  pipFrame.style.cssText = `position:fixed;right:16px;bottom:${PIP_BOTTOM}px;width:${PIP_W}px;height:${PIP_H}px;box-sizing:border-box;border:3px solid #17201d;border-radius:10px;pointer-events:none;display:none;box-shadow:0 4px 14px #0004`;
  const pipLabel = document.createElement('div');
  pipLabel.textContent = 'Looking ahead (F)';
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
  // a coaster: rails, ties, posts and the cart (src/render/track.ts); the Rookie sits in it
  let trackView: TrackView | null = null, cartFlying = false;
  if (course.track) { trackView = buildTrack(course); scene.add(trackView.group); }
  const plankView = course.planks?.length ? buildPlanks(course) : null; // plank bridges: they bend under the runner (src/sim/beam.ts)
  if (plankView) scene.add(plankView.group);
  const trebView = course.trebuchet ? createTrebuchetView(scene, course) : null;
  const recoilView = course.recoil ? createRecoilView(scene, course) : null;
  let shotCache: { key: string; pr: Prediction } | null = null; // the dotted preview of a loaded cannon: the same prediction the debug view uses, worked out once per tick
  const shotPreview = (w: WorldState): Prediction | null => {
    if (!course.recoil || !isAimable(recoilParams(course)) || w.mode !== 'run' || (w.recoil?.armed ?? 0) <= 0) return null;
    const key = `${w.runner.tick}:${w.recoil!.aim}`;
    if (shotCache?.key !== key) shotCache = { key, pr: predictShot(w, course) };
    return shotCache.pr;
  };
  const bandView = course.band ? createBandView(scene, course) : null;
  const droneView = course.drone ? createDroneView(scene, course) : null;
  // a course from the editor draws its real objects instead of blocks: only the start and finish decks stay as ground
  const realObjects = !!course.scene?.length;
  const lastPlatform = course.terrain.platforms.length - 1;
  // the decks are merged into one mesh per material (grass, stone, bed): a course with a dozen decks is three draws, not twelve
  const deckParts: Part[] = [];
  course.terrain.platforms.forEach((p, pi) => {
    if (p.coasterRail) return; // the rails are already drawn by TrackView; this profile exists only for landing collision
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
    geo.translate(...at);
    deckParts.push({ geo, mat: p.bouncy ? bed : p.top === 0 ? grass : stone });
    if (p.skin) paintSkin(p);
  });
  for (const m of mergeStatic(deckParts)) scene.add(m);
  // the editor's pieces: raw meshes are merged into one mesh (cut into chunks when big, so the renderer skips what it cannot see); cups stay
  // instanced; the same photo object used several times is loaded once and drawn as one instanced mesh per part
  const chunks: THREE.Mesh[] = [];
  if (course.scene) {
    const gl = new GLTFLoader(), loads = new Map<string, Promise<{ scene: THREE.Group }>>();
    const loadOnce = (url: string) => { let p = loads.get(url); if (!p) { p = gl.loadAsync(url); loads.set(url, p); } return p; }; // one download and parse per file, however many pieces use it
    const INSTANCE_CELL = 8; // m along the run
    const matte = new THREE.MeshStandardMaterial({ color: 0xa9a392, roughness: 0.95, flatShading: true });
    const itemMatrix = (it: NonNullable<typeof course.scene>[number]) => new THREE.Matrix4().compose(
      new THREE.Vector3(it.x, it.y, it.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rotY), new THREE.Vector3(it.scale, it.scale, it.scale));
    const meshParts: Part[] = [];
    const byUrl = new Map<string, NonNullable<typeof course.scene>>();
    for (const it of course.scene) {
      if (it.url) { const key = `${it.url}|${Math.floor(it.x / INSTANCE_CELL)}`; const l = byUrl.get(key) ?? []; l.push(it); byUrl.set(key, l); } // the same object, near each other, is one instanced mesh; far apart stays culled apart
      else if (it.stack) {
        const g = new THREE.Group();
        g.position.set(it.x, it.y, it.z); g.rotation.y = it.rotY; g.scale.setScalar(it.scale);
        g.add(cupsGroup(it.stack)); scene.add(g);
      } else if (it.mesh) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(it.mesh.positions, 3));
        geo.setIndex(it.mesh.indices); geo.computeVertexNormals();
        geo.applyMatrix4(itemMatrix(it));
        meshParts.push({ geo, mat: matte });
      }
    }
    for (const m of chunked(mergeStatic(meshParts))) { scene.add(m); chunks.push(m); }
    for (const [key, items] of byUrl) {
      const url = key.slice(0, key.lastIndexOf('|'));
      void loadOnce(url).then((got) => {
        const obj = got.scene.clone(true), box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new THREE.Vector3());
        obj.position.set(-c.x, -box.min.y, -c.z);
        if (items.length < 2) { // one use: as before
          const it = items[0], g = new THREE.Group();
          g.position.set(it.x, it.y, it.z); g.rotation.y = it.rotY; g.scale.setScalar(it.scale);
          g.add(obj); scene.add(g);
          return;
        }
        obj.updateMatrixWorld(true);
        obj.traverse((o) => {
          const part = o as THREE.Mesh;
          if (!part.isMesh) return;
          const inst = new THREE.InstancedMesh(part.geometry, part.material, items.length);
          items.forEach((it, i) => inst.setMatrixAt(i, itemMatrix(it).multiply(part.matrixWorld)));
          inst.instanceMatrix.needsUpdate = true; inst.computeBoundingSphere();
          scene.add(inst);
        });
      }).catch(() => { /* no picture for this one; its collision still works */ });
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
  let facing: 1 | -1 = course.track ? 1 : resume ? resume.facing : 1;

  // HUD
  const gaugeStack = createGaugeStack(params.get('gauges') === 'old' ? 'old' : 'bottom-left'); // CC-148: one bottom-left stack for everything about the runner
  const speedGauge = gaugeStack.register({ id: 'speed', label: 'Speed', colour: '#0f6b5c', max: 10 });
  const batteryGauge = course.drone && params.get('gauges') !== 'old' ? gaugeStack.register({ id: 'battery', label: 'Drone battery', colour: '#2a6fb0', max: 100 }) : null;
  const hud = document.createElement('div');
  hud.style.cssText = hudOn(params) ? `font:600 18px system-ui,sans-serif;font-variant-numeric:tabular-nums;min-width:31ch;white-space:nowrap;pointer-events:none;${panelCss('5px 12px')}` : 'position:fixed;left:16px;top:12px;font:600 18px system-ui,sans-serif;color:#10141c;text-shadow:0 1px 0 #fff8;pointer-events:none';
  const msg = document.createElement('div');
  msg.id = 'msg';
  msg.style.cssText = hudOn(params) ? `position:fixed;left:50%;top:38%;transform:translateX(-50%);max-width:90vw;text-align:center;font:700 28px system-ui,sans-serif;pointer-events:none;${panelCss('8px 18px')}` : 'position:fixed;left:0;right:0;top:38%;text-align:center;font:700 28px system-ui,sans-serif;color:#10141c;text-shadow:0 1px 0 #fff;pointer-events:none';
  // the controls, always visible top-left as a card of key caps (collapse with H)
  const help = document.createElement('div');
  help.id = 'keys';
  const KEYS: [string, string][] = [['← →', 'Run (hold)'], ['R', 'Restart (Shift+R: from the very start)'], ['Space / ↑ / W', 'Jump · let go of the rope · press on the trampoline'], ['↓ / S', 'Bend your knees (hold, on big drops)'], ['X', 'Roll: hold it as you land (it counts in the last 0.15 s and about a metre up; a tap earlier does nothing); on the ground it rolls along'], ...(course.recoil ? ([['K', 'Fire the launcher (clip it on at the teal pad): the ball goes back, you go forward'], ...(isAimable(recoilParams(course)) ? [['↑ ↓ (or W)', 'Tilt the cannon barrel while it is loaded (Up does not jump then): it points backward and down, so the push goes forward and up; dots show where you would land']] : [])] as [string, string][]) : []), ...(course.trebuchet ? ([['→ (hold), then Space, ↑ or W', 'Trebuchet: pull the pin, then let the rider go when the hint says LET GO NOW']] as [string, string][]) : []), ...(course !== defaultCourse ? ([['E', 'Hold a bar in the air (let go to fly on), or at a tall wall: grab its edge and climb'], ['← → on a bar', 'Pump the swing: push the way you swing'], ['V', 'Vault over a step with a hand on top (fast, saves energy)']] as [string, string][]) : []), ['F', 'Toggle the Looking ahead inset'], ['N', 'Ghost: a see-through runner that replays the ideal run, to chase (N switches it)'], ...(course.track ? ([['→, Space, ↑ or W', 'Push off at the top of the first hill'], ['↓ / S (hold)', 'Brake']] as [string, string][]) : []), ['I', 'Ideal run of this obstacle (Shift+I: the whole course, any key stops it)'], ...(course.band ? ([['←, then →', 'Elastic band: hold ← to stretch it, then turn round (hold →) and it throws you']] as [string, string][]) : []), ...(course.drone ? ([['E (on the pad)', 'Board the drone; let go to step off'], ['← → in the drone', 'Lean: the drone flies that way'], ['↑ ↓ in the drone', 'Climb, or come down']] as [string, string][]) : []), ['G', 'Drums: where the ideal run presses Space'], ['B', 'Debug view: see the collision boxes and where a jump goes'], ['Mouse', 'Drag to turn the view, wheel to zoom (all the way in shows the face), double-click to reset']]; // retry, ideal run and Dojo are on the fall panel and the buttons
  const newHud = hudOn(params);
  help.style.cssText = newHud ? `position:fixed;left:16px;top:56px;width:290px;font:500 14px system-ui,sans-serif;pointer-events:none;display:grid;gap:5px;${panelCss('8px 10px')}` : 'position:fixed;left:16px;top:48px;width:290px;background:#fffffff0;border:1px solid #cfd6d0;border-radius:12px;padding:8px 10px;font:500 14px system-ui,sans-serif;color:#17201d;box-shadow:0 2px 10px #0002;pointer-events:none;display:grid;gap:5px';
  const MINOR: Record<string, string> = { F: 'inset', N: 'ghost', I: 'ideal run', G: 'drums', B: 'debug', Mouse: 'view' }; // CC-156: the card keeps the keys you need to run; the rest sit in one line below
  const paintKeys = (open: boolean) => {
    gaugeStack.dock(open);
    const row = ([k, d]: [string, string]) => `<div style="display:grid;grid-template-columns:${newHud ? '104px' : '78px'} 1fr;gap:8px;align-items:center"><kbd style="${newHud ? keycapCss.replace('white-space:nowrap', 'white-space:normal') : 'font:700 13px ui-monospace,monospace;background:#eef1ec;border:1px solid #b9c2bb;border-bottom-width:3px;border-radius:6px;padding:1px 6px;text-align:center'}">${k}</kbd><span>${d}</span></div>`;
    const head = `<div style="font-weight:700;display:flex;justify-content:space-between">Controls <span style="font-weight:400;color:${newHud ? HUD.soft : '#58635d'}">H ${open ? 'hides' : 'shows'}</span></div>`;
    if (!open) { help.innerHTML = head; return; }
    const main = newHud ? KEYS.filter(([k]) => !(k in MINOR)) : KEYS, rest = newHud ? KEYS.filter(([k]) => k in MINOR) : [];
    help.innerHTML = head + main.map(row).join('') + (rest.length ? `<div style="color:${HUD.soft};font-size:13px;line-height:1.9;margin-top:2px">Also: ${rest.map(([k]) => `<kbd style="${keycapCss}">${k}</kbd> ${MINOR[k]}`).join(' &nbsp; ')}</div>` : '');
  };
  let keysOpen = true, keysTouched = false; paintKeys(true);
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(760px,94vw);max-height:88vh;overflow:auto;z-index:40;box-sizing:border-box;background:#fffffff5;border:1px solid #cfd6d0;border-radius:12px;padding:16px;font:15px/1.4 system-ui,sans-serif;color:#17201d;display:none;gap:10px;box-shadow:0 8px 30px #0003';
  const hint = document.createElement('div');
  hint.style.cssText = `position:fixed;left:50%;bottom:${params.get('gauges') === 'old' ? 124 : 190}px;transform:translateX(-50%);font:600 20px system-ui,sans-serif;pointer-events:none;${hudOn(params) ? panelCss('8px 16px') : 'color:#10141c;background:#fffc;border-radius:10px;padding:8px 16px'}`;
  const dojoBtn = document.createElement('button');
  dojoBtn.id = 'dojobtn'; dojoBtn.textContent = 'Dojo (T)';
  dojoBtn.style.cssText = 'position:fixed;right:16px;top:12px;font:600 15px system-ui,sans-serif;border:1px solid #0f6b5c;background:#0f6b5c;color:#fff;border-radius:8px;padding:6px 14px;cursor:pointer';
  dojoBtn.onclick = () => openDojo();
  const idealBtn = document.createElement('button');
  idealBtn.id = 'idealbtn'; idealBtn.textContent = 'Ideal run (I)';
  idealBtn.style.cssText = 'position:fixed;right:120px;top:12px;font:600 15px system-ui,sans-serif;border:1px solid #17201d;background:#fff;color:#17201d;border-radius:8px;padding:6px 14px;cursor:pointer';
  idealBtn.title = 'Watch the ideal run of this obstacle (I)';
  idealBtn.onclick = () => showIdeal(zoneAt(world.runner.x)?.id ?? 'gap');
  // CC-80: from here back to the editor (the same pieces), at the obstacle the runner is at
  const editBtn = document.createElement('button');
  editBtn.id = 'editcourse'; editBtn.textContent = 'Edit this course';
  editBtn.title = 'Open this course in the editor, at this obstacle; "Back to the Course" brings you back here';
  editBtn.style.cssText = 'font:600 13px system-ui,sans-serif;border:1px solid #17201d;background:#fff;color:#17201d;border-radius:8px;padding:4px 10px;cursor:pointer;white-space:nowrap';
  editBtn.onclick = () => { editBtn.blur(); openEditor('edit'); };
  const wholeBtn = document.createElement('button');
  wholeBtn.id = 'wholeideal'; wholeBtn.textContent = 'Whole course (Shift+I)';
  wholeBtn.title = 'Watch one ideal run through every obstacle; any key stops it';
  wholeBtn.style.cssText = 'font:600 13px system-ui,sans-serif;border:1px solid #17201d;background:#fff;color:#17201d;border-radius:8px;padding:4px 10px;cursor:pointer;white-space:nowrap';
  wholeBtn.onclick = () => { wholeBtn.blur(); showWholeIdeal(); };
  // the two small buttons share one row, so they cannot overlap whatever their text widths are
  const rowBtns = document.createElement('div');
  rowBtns.id = 'coursebtns'; rowBtns.style.cssText = 'position:fixed;right:158px;top:56px;display:flex;gap:8px;align-items:center';
  rowBtns.append(editBtn, wholeBtn);
  // choose your runner: the male or the female Rookie (remembered between visits)
  const pick = document.createElement('div');
  pick.id = 'pickrunner'; pick.style.cssText = 'position:fixed;right:262px;top:12px;display:flex;gap:6px';
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
  const ICONS = ZONE_ICONS;
  const progressZones = course.zones?.length ? course.zones : (() => {
    const found: { id: string; name: string; x0: number; x1: number }[] = [];
    const add = (id: string, name: string, x0: number, x1: number) => {
      if (x1 > x0) found.push({ id, name, x0, x1 });
    };
    const platforms = [...course.terrain.platforms].sort((a, b) => a.x0 - b.x0);
    platforms.forEach((p, i) => {
      const next = platforms[i + 1];
      if (!next) return;
      const gap = next.x0 - p.x1, rise = next.top - p.top;
      if (gap > 0.15) add('gap', 'Gap', p.x1, next.x0 + 0.1);
      else if (rise > 0.25) add('step', 'Step up', next.x0 - 1.5, next.x0 + 2);
      else if (rise < -1.2) add('drop', 'Drop landing', p.x1 - 1.5, next.x0 + 2);
    });
    platforms.filter((p) => p.bouncy).forEach((p) => add('trampoline', 'Trampoline', p.x0, p.x1));
    if (course.wall) add('wall', 'Warped wall', course.wall.x0, course.wall.x0 + Math.max(8, (course.wall.height ?? 4.3) * 2));
    if (course.rope) add('rope', 'Rope swing', course.rope.anchorX - Math.max(6, course.rope.length ?? 9), course.rope.anchorX + 3);
    if (course.holds?.length) add('lache', 'Bars', course.holds[0].x - 3, course.holds[course.holds.length - 1].x + 3);
    if (course.trebuchet) add('launch', 'Trebuchet launch', course.trebuchet.x - 12, course.trebuchet.x + 5);
    if (course.recoil) add('recoil', 'Recoil launcher', course.recoil.x0, course.recoil.x1);
    if (course.track) add('coaster', 'Coaster', course.startX, course.finishX);
    const ordered = found
      .map((z) => ({ ...z, center: (z.x0 + z.x1) / 2 }))
      .filter((z) => z.center >= course.startX && z.center <= course.finishX)
      .sort((a, b) => a.center - b.center);
    if (!ordered.length) return [{ id: 'course', name: course.name, x0: course.startX, x1: course.finishX }];
    return ordered.map((z, i) => ({ ...z, x1: i + 1 < ordered.length ? (z.center + ordered[i + 1].center) / 2 : course.finishX }));
  })();
  const stripKey = { v: '' };
  function paintStrip(x: number) {
    const zs = progressZones;
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
      d.innerHTML = `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="animation-delay:${(i * 0.35).toFixed(2)}s">${ICONS[z.id.replace(/-\d+$/, '')] ?? '<circle cx="16" cy="16" r="6"/>'}</svg><span>${st === 'n' ? z.name : ''}</span>`;
      strip.appendChild(d);
    });
  }
  const comm = document.createElement('a');
  comm.href = '?mode=gallery'; comm.id = 'community'; comm.textContent = 'Community courses';
  comm.style.cssText = 'position:fixed;right:16px;top:124px;font:600 13px system-ui,sans-serif;border:1px solid #17201d;background:#fff;color:#17201d;border-radius:8px;padding:4px 10px;text-decoration:none';
  document.body.append(comm);
  document.body.append(sstyle, strip);
  // demo courses: every course we have made, one choice away (the stock course, the lache demo, lanes from real objects, places from the map)
  const demos = DEMOS;
  const here = currentWorld(params, course.name);
  const rememberWorldWelcome = () => { try { localStorage.setItem('cc.worldWelcome.seen', '1'); } catch { /* the chooser can still be used */ } };
  // the first-visit chooser is the course gallery inside a dialog; after it, a "Courses" button in the corner opens the same gallery (CC-89)
  const welcome = document.createElement('section');
  welcome.id = 'choose-world';
  modalAttrs(welcome); welcome.setAttribute('aria-labelledby', 'choose-world-title');
  welcome.style.cssText = 'position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:12px;box-sizing:border-box;background:#10182099;backdrop-filter:blur(4px)';
  const welcomeCard = document.createElement('div');
  welcomeCard.style.cssText = 'width:min(1000px,100%);max-height:100%;overflow:auto;box-sizing:border-box;padding:clamp(14px,3vw,28px);border-radius:20px;background:#fffdf7;color:#17201d;box-shadow:0 24px 80px #0006';
  const welcomeTitle = document.createElement('h1');
  welcomeTitle.id = 'choose-world-title'; welcomeTitle.textContent = 'Choose Your World';
  welcomeTitle.style.cssText = 'margin:0 0 6px;font:800 clamp(26px,5vw,40px)/1.05 system-ui,sans-serif;letter-spacing:-.04em';
  const welcomeCopy = document.createElement('p');
  welcomeCopy.textContent = `Welcome to ConquerCourse. Click a picture: ${demos.length} worlds, from obstacle courses to real places, or make your own.`;
  welcomeCopy.style.cssText = 'margin:0 0 12px;color:#58635d;font:500 16px/1.45 system-ui,sans-serif';
  welcome.append(welcomeCard);
  const courseButton = mountWorldGallery(document.body, { current: here, place: BUTTON_PLACE.course, onPick: (v) => { rememberWorldWelcome(); location.href = worldHref(v); } });
  const closeWelcome = () => { welcome.remove(); courseButton.button.focus({ preventScroll: true }); };
  const welcomeGallery = buildGallery({ current: here, heading: 'Courses', onClose: () => { rememberWorldWelcome(); closeWelcome(); }, onPick: (v) => { rememberWorldWelcome(); if (v === 'stay' || v === here.value) closeWelcome(); else location.href = worldHref(v); } });
  welcomeCard.append(welcomeTitle, welcomeCopy, welcomeGallery.el);
  let worldWelcomeSeen = false;
  try { worldWelcomeSeen = localStorage.getItem('cc.worldWelcome.seen') === '1'; } catch { /* use the one-time URL option when storage is unavailable */ }
  const mode = params.get('mode');
  rememberCourse(browserStore, params); // CC-100: a returning player comes back to their last course
  const tour = tourDecision({ params, store: browserStore, automated: navigator.webdriver, mode, resume: !!resume }); // CC-100: a first visit gets the short tour instead of the big chooser
  let onboarding: Pick<Onboarding, 'onCleared' | 'onFall'> = { onCleared() {}, onFall() {} };
  const showWorldWelcome = !resume && !worldWelcomeSeen && params.get('welcome') !== '0' && (!mode || mode === 'course') && !params.has('course') && !params.has('generate') && !params.has('coaster') && tour !== 'tour';
  if (showWorldWelcome) { document.body.append(welcome); welcomeGallery.focusStart(); }
  if (!showWorldWelcome) rememberWorldWelcome(); // direct course starts (including Community Play) count as the first play
  if (course.track) {
    const edit = document.createElement('a');
    edit.id = 'edit-coaster'; edit.textContent = '← Back to coaster builder'; edit.title = 'Return to the coaster builder with this track and push';
    const encodedTrack = (course.track.segments ?? [course.track.pts]).map((section) => section.map(([x, y]) => `${+x.toFixed(2)},${+y.toFixed(2)}`).join(';')).join('|');
    const values = new URLSearchParams({ coaster: encodedTrack, push: String(course.track.push ?? 1.5) });
    edit.href = `?mode=coaster&${values}`;
    edit.style.cssText = 'position:fixed;right:16px;top:232px;z-index:21;font:700 16px system-ui,sans-serif;border:3px solid #064e3b;background:#0f6b5c;color:#fff;border-radius:12px;padding:12px 16px;text-decoration:none;box-shadow:0 4px 14px #0004';
    document.body.append(edit);
  }
  // The drum lane is on by default wherever the course has a planned player route; a coaster is mostly passive cart motion.
  const forceDrums = params.get('drums') === '1';
  const drumLane = createDrumLane(document.body, !course.track);
  setTimeout(() => {
    try {
      if (course.track) { drumLane.set([]); if (drumLane.shown) drumLane.toggle(); return; }
      const result = course.plan ? { plan: course.plan, cleared: true } : searchIdealRun(course);
      const drums = result.cleared ? drumsFor(course, result.plan) : [];
      drumLane.set(drums);
      const show = forceDrums || drums.length > 0;
      if (drumLane.shown !== show) drumLane.toggle();
    } catch {
      drumLane.set([]);
      if (drumLane.shown !== forceDrums) drumLane.toggle();
    }
  }, 0);
  const dbgBtn = document.createElement('button');
  dbgBtn.id = 'debugbtn'; dbgBtn.textContent = 'Debug (B)'; dbgBtn.title = 'Show the collision boxes and where a jump right now would go';
  dbgBtn.style.cssText = 'position:fixed;right:16px;top:166px;border:2px solid #17201d;background:#fff;color:#17201d;border-radius:10px;padding:3px 10px;cursor:pointer;font:600 12px system-ui,sans-serif';
  // CC-159: how to start again is on the screen all the time, as a key cap you can also press with a finger or the mouse
  const restartChip = document.createElement('button');
  restartChip.type = 'button'; restartChip.id = 'restart-chip';
  restartChip.innerHTML = `<kbd style="${keycapCss}">R</kbd> Restart`;
  restartChip.title = 'R starts again where you last began; Shift+R starts from the very start';
  restartChip.style.cssText = `font:700 15px system-ui,sans-serif;cursor:pointer;white-space:nowrap;display:flex;gap:7px;align-items:center;${panelCss('4px 10px 4px 6px')}`;
  restartChip.onclick = () => { restartChip.blur(); restart(); };
  const hudRow = document.createElement('div');
  hudRow.id = 'hudrow'; hudRow.style.cssText = 'position:fixed;left:16px;top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;max-width:calc(100vw - 32px);pointer-events:none';
  hudRow.append(hud); // CC-165: the time has a fixed width so nothing beside it moves; the R Restart chip is only there with ?hud=restart (a fall already shows R, and phones have the touch Restart button)
  if (params.get('hud') === 'restart') { hudRow.append(restartChip); restartChip.style.pointerEvents = 'auto'; }
  // CC-163: on a phone-width screen the top-right buttons used to sit on the time line and the Restart chip: they move to a second row, and the rarely used ones (runner pick, edit, whole course, debug) step aside (their keys still work; Ideal run is on the fall panel too)
  const narrow = document.createElement('style');
  narrow.textContent = '@media (max-width:700px){#hudrow>div{font-size:14px!important}#pickrunner,#coursebtns,#debugbtn,#idealbtn,#community{display:none!important}#dojobtn{top:52px!important;right:12px!important;font-size:13px!important;padding:5px 10px!important}#ghost-hud{left:12px!important;top:52px!important;transform:none!important}#cam{top:92px!important;right:12px!important}#strip{top:160px!important}#keys{top:225px!important}}';
  document.head.append(narrow);
  const hudBox = hudOn(params) ? hudRow : hud;
  document.body.append(hudBox, msg, help, panel, hint, gaugeStack.el, dojoBtn, idealBtn, rowBtns, pick, camBtn, dbgBtn);
  // CC-85: a real place shows its real photos (credit under each, a large view on click); ?photos=0 or the Hide switch turns them off
  const placeSlug = slugOfCourse(course.name);
  let livePhotos: { update(x: number): void } | null = null; // CC-90: street photos from the allow-list change as the runner moves; the CC-85 strip is the fallback
  if (placeSlug && new URLSearchParams(location.search).get('photos') !== '0') void mountLivePhotos(document.body, course).then((h) => { livePhotos = h; });
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;left:50%;top:44%;transform:translateX(-50%);font:700 22px system-ui,sans-serif;color:#10141c;background:#fffffff0;border-radius:10px;padding:6px 14px;pointer-events:none;display:none';
  document.body.append(toast);
  let toastUntil = 0, squashUntil = 0, squashDepth = 1;
  let releasedAtX: number | null = null; const caughtSince = new Set<number>(); // the bars passed since the last release: a bar flown over without a grab is said to be skipped
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
    sp.scale.set(4.6, 1.1, 1); sp.position.set(x, y, -0.6); // behind the runner and the ghost, never over them scene.add(sp);
  }
  for (const g of specs) { const z = zoneOf(g.x); if (z && (z.id === 'gap' || z.id === 'landing')) label(`${g.width.toFixed(1)} m`, g.x + g.width / 2, Math.max(0, g.rise) + 3); }
  if (course.wall) label(`${(course.wall.height ?? DEFAULT_WALL.height).toFixed(1)} m high`, course.wall.x0 + 2, (course.wall.height ?? DEFAULT_WALL.height) + 1.2);
  if (course.rope) label(`rope ${ropeLen.toFixed(0)} m`, course.rope.anchorX, course.rope.anchorY + 1.6);

  // input
  const keys = new Set<string>();
  let jumpQueued = false, vaultQueued = false, rollQueued = false, fireQueued = false;
  type Cam = 'side' | 'angle' | 'first';
  const CAMS: { id: Cam; name: string }[] = [{ id: 'side', name: 'Side view' }, { id: 'angle', name: '45° view' }, { id: 'first', name: 'First person' }];
  let camMode: Cam = params.get('cam') === 'first' ? 'first' : 'side'; // ?cam=first starts in the runner's eyes (for pictures)
  // while the feedback form is open, or a text box has the focus, no game key does anything (typing a T must not open the Dojo)
  const typing = (e: KeyboardEvent): boolean => {
    const t = e.target as HTMLElement | null;
    return document.getElementById('cc-feedback') !== null || (!!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable));
  };
  addEventListener('keydown', (e) => {
    if (typing(e)) { keys.clear(); jumpQueued = false; vaultQueued = false; rollQueued = false; fireQueued = false; return; }
    if (paused && !e.repeat) { paused = false; last = performance.now(); }
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space' || ((e.code === 'ArrowUp' || e.code === 'KeyW') && !(course.recoil && isAimable(recoilParams(course)) && (world.recoil?.armed ?? 0) > 0))) { jumpQueued = true; e.preventDefault(); } // a loaded cannon takes Up and W to tilt the barrel instead of jumping
    if (e.code === 'KeyV') vaultQueued = true;
    if (e.code === 'KeyX') rollQueued = true;
    if (e.code === 'KeyK') fireQueued = true;
    if (e.code === 'KeyR') { if (e.shiftKey) { retryX = course.startX; restart(course.startX); } else restart(); }
    if (idealWhole && !botMode && e.code !== 'KeyI' && !/^(Shift|Control|Alt|Meta)/.test(e.code)) stopWholeIdeal(); // any key takes the run back
    if (e.code === 'KeyI') { if (e.shiftKey) showWholeIdeal(); else showIdeal(zoneAt(world.runner.x)?.id ?? 'gap'); }
    if (e.code === 'KeyT') openDojo();
    if (e.code === 'Escape' && replay) { replay = null; clearGuides(); showAgain(); }
    if (e.code === 'KeyC') nextCam();
    if (e.code === 'KeyG') drumLane.toggle();
    if (e.code === 'KeyF') {
      frontOverride = !(frontOverride ?? true);
      e.preventDefault();
    }
    if (e.code === 'KeyB') toggleDebug();
    if (e.code === 'KeyN') ghostCtl?.cycle();
    if (e.code === 'KeyH') { keysTouched = true; keysOpen = !keysOpen; paintKeys(keysOpen); }
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  const touchControls = touchOn(params, browserPointing); // CC-139: on a touch device the buttons press the same keys; ?touch=0 turns them off
  if (touchControls) { mountTouch(document.body, { cannon: !!course.recoil }); gaugeStack.lift(150); keysOpen = false; keysTouched = true; paintKeys(false); frontOverride = false; } // the keys card is for keyboards; the small corner view would hide the runner on a narrow screen
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

  if (params.get('bot') === 'shortcut') { const list = course.shortcuts?.length ? course.shortcuts : findShortcutsNow(course); if (list[0]) plan = list[0].plan; else plan = course.plan ?? searchIdealRun(course).plan; }
  const botMode = params.get('bot') === 'ideal' || params.get('bot') === 'shortcut';
  let retryX = resume ? resume.retryX : course.startX; // "try this obstacle again" starts standing still just before it
  let demo: { x1: number } | null = null;
  const idealCache = new Map<number, Plan>();
  let idealWhole = false, idealToken = 0, idealPending = 0, idealPool: IdealPool | null = null, idealSignal = { cancelled: false }, idealNote = ''; // idealNote: the line shown while an ideal run is working or playing
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
  const grabHint = createGrabHint(scene, course, params.get('grabhint') !== '0');
  const toggleDebug = () => { debug.toggle(); dbgBtn.textContent = debug.shown ? 'Debug: on (B)' : 'Debug (B)'; dbgBtn.blur(); };
  dbgBtn.onclick = toggleDebug;
  let world = resume?.world ?? newWorld(course, resume ? resume.retryX : startAt);
  const ghostBot = params.get('ghost') === 'bot'; // ?ghost=bot shows the ghost beside the bot too (for the check: the bot on the ideal line stays level with it)
  let ghostCtl: ReturnType<typeof createGhost> | null = null; // the ghost to chase (CC-99), made once the ideal-run search is defined
  type RunKind = 'attempt' | 'practice';
  type ObstacleCounts = { attempts: number; successes: number; failures: number };
  type RunSummary = { runs: number; failures: number; completions: number; ticks: number; progressSum: number; progressCount: number; landings: number; landingOuch: number; bentLandings: number; obstacles: Record<string, ObstacleCounts> };
  const summary = (): RunSummary => ({ runs: 0, failures: 0, completions: 0, ticks: 0, progressSum: 0, progressCount: 0, landings: 0, landingOuch: 0, bentLandings: 0, obstacles: {} });
  const summaries: Record<RunKind, RunSummary> = { attempt: summary(), practice: summary() };
  let runKind: RunKind = (resume ? resume.retryX : startAt ?? course.startX) > course.startX + 0.01 ? 'practice' : 'attempt';
  const runLog = newLog(); // the path and the moves of this run, for the report (src/ui/run-report.ts)
  let runStartX = world.runner.x, runFurthestX = world.runner.x, runFailures = 0, runLandingOuch = 0, runLandings = 0, runBentLandings = 0;
  let flowSampleTick = world.runner.tick, flowSampleVx = world.runner.vx, flowSampleVy = world.runner.vy;
  let flowAccelX: number | null = null, flowAccelY: number | null = null, runJerkSum = 0, runJerkSamples = 0;
  let attemptEnded = false;
  const enteredZones = new Set<string>(), clearedZones = new Set<string>();
  let previousRunX = world.runner.x;
  const zones = course.zones?.length ? course.zones : [{ id: 'course', name: course.name, x0: course.startX, x1: course.finishX }];
  const countsFor = (bucket: RunSummary, zoneId: string): ObstacleCounts => bucket.obstacles[zoneId] ?? (bucket.obstacles[zoneId] = { attempts: 0, successes: 0, failures: 0 });
  const enterZone = (zoneId: string) => {
    if (enteredZones.has(zoneId)) return;
    enteredZones.add(zoneId); countsFor(summaries[runKind], zoneId).attempts++;
  };
  function updateRunProgress(x: number) {
    runFurthestX = Math.max(runFurthestX, x);
    for (const z of zones) {
      if (x >= z.x0 && x < z.x1) enterZone(z.id);
      if (x >= z.x1 && previousRunX < z.x1 && x >= z.x0 && !clearedZones.has(z.id)) { enterZone(z.id); clearedZones.add(z.id); countsFor(summaries[runKind], z.id).successes++; }
    }
    previousRunX = x;
  }
  function updateFlow(tick: number, vx: number, vy: number) {
    if (tick - flowSampleTick < 12) return; // sample at 10 Hz to measure movement changes, not individual simulator ticks
    const seconds = (tick - flowSampleTick) * DT;
    const ax = (vx - flowSampleVx) / seconds, ay = (vy - flowSampleVy) / seconds;
    if (flowAccelX !== null && flowAccelY !== null) {
      runJerkSum += Math.hypot(ax - flowAccelX, ay - flowAccelY) / seconds;
      runJerkSamples++;
    }
    flowSampleTick = tick; flowSampleVx = vx; flowSampleVy = vy; flowAccelX = ax; flowAccelY = ay;
  }
  function resetFlowSample() {
    flowSampleTick = world.runner.tick; flowSampleVx = world.runner.vx; flowSampleVy = world.runner.vy;
    flowAccelX = null; flowAccelY = null; runJerkSum = 0; runJerkSamples = 0;
  }
  function clearFinishZone(x: number) {
    const z = zones.find((zone) => x >= zone.x0 && x <= zone.x1);
    if (z && !clearedZones.has(z.id)) { enterZone(z.id); clearedZones.add(z.id); countsFor(summaries[runKind], z.id).successes++; }
  }
  function finishRun(success: boolean) {
    if (attemptEnded) return;
    attemptEnded = true;
    const bucket = summaries[runKind];
    bucket.ticks += world.runner.tick;
    bucket.progressSum += Math.max(0, Math.min(100, (runFurthestX - runStartX) / Math.max(1, course.finishX - runStartX) * 100)); bucket.progressCount++;
    if (success) bucket.completions++;
    else { bucket.failures++; runFailures++; }
  }
  const resetRunStats = (x: number) => {
    runKind = x > course.startX + 0.01 ? 'practice' : 'attempt';
    summaries[runKind].runs++;
    runStartX = x; runFurthestX = x; runFailures = 0; runLandingOuch = 0; runLandings = 0; runBentLandings = 0; previousRunX = x; resetFlowSample();
    attemptEnded = false; enteredZones.clear(); clearedZones.clear(); clearLog(runLog);
  };
  summaries[runKind].runs++;
  updateRunProgress(world.runner.x);
  // ?hangtest=1.0 (radians) hangs the runner still on the first bar at that angle, for the pivot screenshots
  const hangTest = params.get('hangtest') !== null && course.holds?.length ? Number(params.get('hangtest')) : null;
  // ?planktest=0.5 stands the runner still on the first plank, that share of the way across, for the sag screenshots
  const plankTest = params.get('planktest') !== null && course.planks?.length ? Number(params.get('planktest')) : null;
  if (plankTest !== null) {
    const pk = course.planks![0], a = plankTest * (pk.x1 - pk.x0);
    world = { ...world, mode: 'plank', plank: { i: 0, v: 0, sagged: true }, runner: { ...world.runner, x: pk.x0 + a, y: topAt(pk, a, pk.x0 + a), vx: 0, vy: 0, grounded: true } };
  }
  if (hangTest !== null) {
    const f = feetOf(course.holds![0], { hold: 0, theta: hangTest, omega: 0 });
    world = { ...world, mode: 'hang', hang: { hold: 0, theta: hangTest, omega: 0 }, runner: { ...world.runner, x: f.x, y: f.y, vx: 0, vy: 0, grounded: false } };
  }
  let paused = !!resume?.world; // a run that was in progress waits for a key, so the player is not dropped into the middle of a jump
  const log: GameEvent[] = [];
  const frames: { x: number; y: number }[] = [];
  let replay: { i: number; from: number; to: number } | null = null; // i is a float: the replay runs at half speed
  let falls = resume ? resume.falls : 0;
  const analyticsCourseKey = courseKey(course.name);
  const analyticsMode = new URLSearchParams(location.search).get('mode') ?? 'course';
  let analyticsRunId = crypto.randomUUID();
  let failedThisAttempt = false;
  if (!resume) trackCourseEvent('start', analyticsCourseKey, course.name, analyticsRunId, analyticsMode);
  // CC-149: a cleared run on a listed course is offered to the server, which plays the keys again before it counts (a run with anything but plain keys has no log and is not offered)
  function offerClear() {
    const path = params.get('course') ?? '';
    if (!statsOn(params) || botMode || demo || idealWhole || params.get('mode') || !/^\/assets\/(demo|experiments\/osm)\//.test(path)) return;
    const mine = ghostCtl?.myRun();
    if (mine) void encodeLog(mine).then((keys) => sendClear(statKey(path), analyticsRunId, courseHash(course), keys, logTicks(mine)));
  }
  let everCleared = false;
  try { everCleared = localStorage.getItem('cc.course.cleared') === '1'; } catch { /* keep going */ }
  let windows: ReturnType<typeof searchIdealRun>['windows'] | null = null;
  const zoneAt = (x: number) => course.zones?.find((z) => x >= z.x0 && x < z.x1);
  function clearGuides() {
    while (guides.children.length) { const c = guides.children[0] as THREE.Mesh; guides.remove(c); c.geometry?.dispose(); }
    diagBox.style.display = 'none';
  }
  // Share (CC-128, CC-129): keys fed from a link play the run again; while a clip is made the game is stepped by hand and nothing is counted or heard.
  let feed: { log: InputLog; i: number; left: number } | null = null;
  let phoneWatch: InputLog | null = null; // the friend's keys, replayed over and over while a phone watches (CC-138)
  let clipping = false;
  let clipHook: (() => void) | null = null;
  const fedInput = (): RunnerInput => {
    while (feed && feed.left === 0 && feed.i < feed.log.length) { feed.left = feed.log[feed.i][1]; feed.i++; }
    if (!feed || feed.left === 0) return NO_INPUT;
    feed.left--;
    return inputOfMask(feed.log[feed.i - 1][0]);
  };
  function restart(x: number = retryX) {
    setMusicScreen('course');
    clearGuides();
    if (!botMode) plan = null;
    demo = null; idealWhole = false; idealPending = 0;
    world = newWorld(course, x);
    ghostCtl?.begin(x === course.startX && (!botMode || ghostBot), !botMode || ghostBot ? x : null); // a ghost chases a run from the start only; every try keeps its keys, so every try can be a clip (CC-157)
    resetRunStats(x);
    analyticsRunId = crypto.randomUUID(); failedThisAttempt = false;
    if (!clipping) trackCourseEvent('start', analyticsCourseKey, course.name, analyticsRunId, analyticsMode);
    cartFlying = false;
    log.length = 0;
    botState.next = 0; botState.caught = null; botState.bedAt = null;
    idealNote = '';
    msg.textContent = '';
    frames.length = 0; replay = null; panel.style.display = 'none';
    squashUntil = 0; toastUntil = 0; toast.style.display = 'none'; releasedAtX = null; caughtSince.clear();
  }

  // The Dojo is reachable any time: it opens on the obstacle nearest the runner (R2-G4).
  function saveResume() {
    try { sessionStorage.setItem('cc.resume', JSON.stringify({ course, world: world.outcome === 'running' ? world : null, retryX, facing, falls } satisfies Resume)); } catch { /* the Course starts again */ }
  }
  // The editor opens on the course's own pieces (its source, or a copy built from its ground and bars), at the obstacle the runner is at.
  // A coaster opens its track in the coaster builder. "Make it easier" opens the editor already looking for the smallest change.
  function openEditor(intent: 'edit' | 'easier') {
    track('edit_opens');
    if (course.track) { location.href = `?mode=coaster&coaster=${course.track.pts.map(([x, y]) => `${+x.toFixed(2)},${+y.toFixed(2)}`).join(';')}&push=${+(course.track.push ?? 1.5).toFixed(2)}`; return; }
    const zone = world.outcome === 'running' ? zoneAt(world.runner.x)?.id ?? null : lastZone;
    const h: EditHandoff = { course: handoffCourse(course), retryX, zone, x: world.runner.x, facing, falls, intent };
    try { sessionStorage.setItem(EDIT_KEY, JSON.stringify(h)); } catch { msg.textContent = 'This course is too big to hand to the editor.'; return; }
    location.search = '?mode=editor';
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
    const q = new URLSearchParams({ mode: 'dojo', ex: zoneId === 'lache' ? 'bars' : zoneId === 'launch' ? 'lever' : zoneId === 'band' ? 'stored' : zoneId === 'plank' ? 'bridge' : zoneId === 'recoil' && course.recoil && isAimable(recoilParams(course)) ? 'cannon' : zoneId, from: 'course' }); // the lache pair trains on the bar swing
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
  // Shortcuts: routes the designer did not plan (src/sim/shortcuts.ts). Stored with a demo course, or worked out on first request in a worker.
  let shortcuts: Shortcut[] | null = course.shortcuts ?? null, shortcutWorker: Worker | null = null, shortcutAsk: Promise<Shortcut[]> | null = null;
  function ensureShortcuts(): Promise<Shortcut[]> {
    if (shortcuts) return Promise.resolve(shortcuts);
    shortcutAsk ??= new Promise<Shortcut[]>((resolve) => {
      try {
        shortcutWorker ??= new Worker(new URL('../sim/shortcuts-worker.ts', import.meta.url), { type: 'module' });
        const w = shortcutWorker;
        w.onmessage = (e: MessageEvent) => { shortcuts = (e.data.shortcuts as Shortcut[]) ?? []; resolve(shortcuts); };
        w.postMessage({ course });
      } catch { shortcuts = []; resolve(shortcuts); } // no worker here: no shortcut list
    });
    return shortcutAsk;
  }
  function startShortcut(s: Shortcut) {
    clearGuides();
    world = newWorld(course, course.startX);
    log.length = 0; frames.length = 0; replay = null; panel.style.display = 'none';
    plan = s.plan; botState.next = 0; botState.caught = null; botState.bedAt = null;
    idealWhole = true; demo = null; retryX = course.startX;
    idealNote = shortcutLine(s) + ' Watch it, press any key to take over.';
  }
  function shortcutRow(): HTMLElement | null {
    const s = shortcuts?.[0];
    if (!s) return null;
    const box = document.createElement('div'); box.style.cssText = 'display:grid;gap:6px;margin-top:6px;padding-top:6px;border-top:1px solid #d6dcd9';
    const t = document.createElement('span'); t.textContent = `${s.designed ? 'The course keeps a shortcut on purpose' : 'A shortcut exists'}: ${s.how}. It saves ${s.secondsSaved.toFixed(1)} s.`; t.id = 'shortcutnote';
    const b = document.createElement('button'); b.textContent = 'Watch the shortcut'; b.id = 'watchshortcut';
    b.style.cssText = 'font:inherit;border:1px solid #17201d;background:#fff;color:#17201d;border-radius:8px;padding:6px 12px;cursor:pointer;font-weight:700;justify-self:start';
    b.onclick = () => startShortcut(s);
    box.append(t, b);
    return box;
  }
  // The search runs in a pool of workers (src/sim/ideal-pool.ts): the page keeps drawing, the line says which obstacle it is on, and any key cancels.
  // One search at a time (the workers hold one course); each waits for the one before. Nothing here runs a search on the page's thread unless there are no workers at all.
  let poolQueue: Promise<unknown> = Promise.resolve();
  function runSearch(c: CourseData, sig: { cancelled: boolean }, onNote?: (label: string, step: number, of: number) => void, budget?: number): Promise<SearchResult> {
    try {
      idealPool ??= new IdealPool(() => {
        const w = new Worker(new URL('../sim/ideal-eval-worker.ts', import.meta.url), { type: 'module' });
        return { post: (m) => w.postMessage(m), listen: (cb) => w.addEventListener('message', (e) => cb((e as MessageEvent).data)), stop: () => w.terminate() };
      }, Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 4) - 1)));
      const pool = idealPool;
      const run = poolQueue.catch(() => undefined).then(() => (sig.cancelled ? Promise.reject(new Error('cancelled')) : pool.search(c, (b) => onNote?.(b.label, Math.min(b.step + 1, b.of), b.of), sig, { budget })));
      poolQueue = run;
      return run;
    } catch { return Promise.resolve(searchIdealRun(c)); } // no worker here: search on the page's thread
  }
  function findPlan(c: CourseData): Promise<Plan> {
    const sig = idealSignal = { cancelled: false };
    return runSearch(c, sig, (label, step, of) => { idealNote = `Working out the ideal run… ${label} (${step} of ${of}) · any key cancels`; }).then((r) => r.plan);
  }
  // The fall tip needs how wide the window of good presses is. A course stores it with its plan; when it does not, the workers work it out within a budget (and the tip
  // says the generic thing until then): a whole-course search on the page's thread froze the page for up to half a minute after a fall.
  const windowTip = (ws: Window[], x: number): string | undefined => {
    const w = ws.find((q) => q.obstacle.startsWith('edge') && Math.abs(q.best - x) < 9);
    return w ? (x < w.best ? 'You jumped a bit late. Try pressing Space a little earlier.' : 'You jumped a bit early. Try pressing Space a little later.') : undefined;
  };
  let windowsAsk: Promise<Window[] | null> | null = null;
  function ensureWindows(): Promise<Window[] | null> {
    windowsAsk ??= runSearch(course, { cancelled: false }, undefined, workSeconds(60)).then((r) => (windows = xWindows(r.windows))).catch(() => null);
    return windowsAsk;
  }
  async function startIdeal(x0: number, zoneId: string | null) {
    let p = idealCache.get(x0) ?? (x0 === course.startX ? course.plan : undefined);
    const token = ++idealToken;
    if (!p) {
      idealNote = 'Working out the ideal run… (any key cancels)';
      idealPending = token;
      p = await findPlan({ ...course, startX: x0 }).catch(() => undefined);
      if (idealPending !== token || !p) return; // cancelled while the search ran
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
    if (zoneId === null) void ensureShortcuts().then((list) => { if (list[0] && plan === p && idealWhole) idealNote += ' ' + shortcutLine(list[0]); });
  }
  function showIdeal(zoneId: string) { idealWhole = false; void startIdeal(cpFor(zoneId), zoneId); }
  // Shift+I: from the start, or from where retry would start (the checkpoint before the obstacle you fell at), to the finish
  function showWholeIdeal() { void startIdeal(retryX, null); }
  function stopWholeIdeal() {
    idealWhole = false; idealPending = 0; idealToken++; idealSignal.cancelled = true;
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
    if (whole) void ensureShortcuts().then(() => { const sr = shortcutRow(); if (sr && panel.contains(h)) panel.appendChild(sr); });
  }

  // after a clear: say a shortcut exists (a fact, never a grade)
  function clearedNote() {
    void ensureShortcuts().then(() => {
      if (world.outcome !== 'cleared' || !shortcuts?.length) return;
      const sr = shortcutRow(); if (!sr) return;
      if (panel.style.display === 'none' || !panel.firstChild) { panel.innerHTML = ''; panel.style.display = 'grid'; const h = document.createElement('strong'); h.textContent = 'You made it!'; panel.append(h); }
      panel.appendChild(sr);
    });
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
  // The numbers behind a coaster fall: where the cart started, how fast it was, and what the hilltop could hold.
  function cartDiag(): string[] {
    const rails = railsOf(course.track!, world.cart?.segment ?? Number(log.find((e) => e.type === 'cart-off')?.detail?.segment ?? 0)), L: string[] = [];
    const start = rails.y(rails.x0);
    L.push(`The cart started ${start.toFixed(1)} m up and was pushed off at ${(course.track!.push ?? 1.5).toFixed(1)} m/s.`);
    const off = log.find((e) => e.type === 'cart-off'), st = log.find((e) => e.type === 'cart-stall');
    if (off) {
      const x = off.detail!.x as number;
      L.push(`It left the rails at ${x.toFixed(0)} m, ${rails.y(x).toFixed(1)} m up, doing ${(off.detail!.v as number).toFixed(1)} m/s.`);
      L.push(`That hilltop lets go above ${crestSpeedLimit(rails, x).toFixed(1)} m/s: the sharper the top, the slower the limit.`);
    }
    if (st) L.push(`It turned round on a hill ${(st.detail!.height as number).toFixed(1)} m up: the highest it could reach was about the height it started from.`);
    return L;
  }
  // The elastic band: what the throw was, and what would have gone farther (never how well you did)
  function bandTip(): string {
    const rel = [...log].reverse().find((e) => e.type === 'band-release');
    const snap = [...log].reverse().find((e) => e.type === 'band-snap');
    const bp = bandParams(course);
    if (snap) return `The band snapped at ${(snap.detail!.stretch as number).toFixed(0)} m: it takes ${bp.snap.toFixed(0)} m at most. Turn round (hold \u2192) a little sooner.`;
    if (!rel) return 'Hold \u2190 to run away from the post and stretch the band first. Then turn round (hold \u2192).';
    return `You left the band at ${(rel.detail!.vx as number).toFixed(1)} m/s after stretching it ${(rel.detail!.stretch as number).toFixed(0)} m. A longer stretch throws faster: hold \u2190 a little longer before you turn round (it snaps at ${bp.snap.toFixed(0)} m).`;
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
      if ([...log].some((e) => e.type === 'wall-no-grip')) L.push('Your feet climbed high enough, but the hands never held on: hold E near the top to grab the edge.');
      else L.push(`Speed at the foot of the wall: ${wallEntry.toFixed(1)} m/s. This wall needs at least ${wallNeed.toFixed(1)} m/s.`);
      if (![...log].some((e) => e.type === 'wall-no-grip')) L.push(`Your feet climbed ${(need + margin).toFixed(1)} m; they had to climb ${need.toFixed(1)} m for your hands to reach the top.`);
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

  // Coaster tips: what the track did, and what would have worked. Nothing about how well the rider played.
  // The plank broke: what bent it too far, in plain words (no formulas on the Course).
  function plankTip(): string {
    const br = log.find((e) => e.type === 'plank-break');
    const pk = course.planks?.[0];
    if (!br || !pk) return 'The plank was too weak for the gap. Try again.';
    const cm = ((br.detail?.sag as number) * 100).toFixed(0);
    return `The plank bent ${cm} cm under you, more than it can take, and snapped ${(br.detail?.at as number).toFixed(1)} m from the edge. A thicker plank, a shorter gap, or a post under the middle each make it bend less. Try the Dojo bridge lesson to find out how much.`;
  }
  function cartTip(what: 'splash' | 'slide' | 'stall'): string {
    if (what === 'stall') {
      const st = log.find((e) => e.type === 'cart-stall');
      return `It turned round on a hill ${st ? (st.detail?.height as number).toFixed(1) + ' m high' : ''}. A cart can only climb as high as it started, plus a little from the push. Make the first hill higher, or the hill it stopped on lower.`;
    }
    const off = log.find((e) => e.type === 'cart-off');
    return off ? `At ${(off.detail?.v as number).toFixed(1)} m/s the top of that hill bends away faster than gravity can hold the cart down, so the rails let go. Hold ↓ to brake before the crest, or make the crest broader.` : 'Try again.';
  }

  // After a fall: retry at once, one tip, a skippable replay, and the offer to train that obstacle.
  let lastFall: 'splash' | 'slide' | 'hurt' | 'stall' = 'splash';
  function onFall(what: 'splash' | 'slide' | 'hurt' | 'stall') {
    falls++; track('falls');
    if (falls === 1 && !idealWhole) onboarding.onFall(); // CC-100: the first fall gets one calm hint
    lastFall = what;
    const r = world.runner;
    const zone = zoneAt(what === 'slide' && course.wall ? course.wall.x0 + 1 : r.x);
    lastZone = zone?.id ?? 'gap';
    if (!failedThisAttempt) {
      failedThisAttempt = true; trackCourseEvent('fail', analyticsCourseKey, course.name, analyticsRunId, analyticsMode);
      const failedZone = zone?.id ?? lastZone;
      enterZone(failedZone); countsFor(summaries[runKind], failedZone).failures++; finishRun(false);
    }
    retryX = cpFor(lastZone);
    const jump = [...log].reverse().find((e) => e.type === 'jump');
    let tip = 'Try again.', lateTip = false;
    if (what === 'slide') tip = 'You ran out of speed on the curve. Start the run-up earlier and keep running.';
    else if (what === 'hurt' && log.some((e) => e.type === 'drone-crash')) tip = 'The drone touched down too fast or leaning, or flew into the side of a deck. Come down slowly with ↓ over the deck, let go of ← → before the ground so it levels out, and keep E held until it sets you down.';
    else if (what === 'hurt') tip = 'The ground stopped you too fast. Hold X as you land to roll (it counts in the last 0.15 s, about a metre up; a tap earlier does nothing): the same fall is spread over more time, and a roll keeps most of your speed.';
    else if (course.track) tip = cartTip(what);
    else if (what === 'splash' && course.recoil && isAimable(recoilParams(course)) && zone?.id === 'recoil') tip = 'Tilt the barrel with the arrow keys until the dotted path ends on the far deck, then press K. A steeper shot flies higher and lands harder: tap X just before the ground.';
    else if (course.drone && zone?.id === 'drone') tip = log.some((e) => e.type === 'drone-empty') ? 'The battery ran out before the far deck. Hovering costs a lot of battery: lean and fly straight across, and start coming down only over the deck. A bigger battery or a lighter rider also helps.' : 'You came down short of the far deck. Keep leaning forward longer before you lean back, and start coming down only when you are over the deck.';
    else if (course.recoil && zone?.id === 'recoil') tip = world.recoil && world.recoil.fired > 0 ? 'The push was not enough. A heavier ball, or a faster one, pushes harder. Fire as you leave the edge so the push carries through the whole flight.' : 'Run onto the teal pad, then press K to fire the launcher as you jump.';
    else if (log.some((e) => e.type === 'plank-break')) tip = plankTip();
    else if (course.band) tip = bandTip();
    else if (zone?.id === 'trampoline') tip = 'Press Space at the bottom of the bounce for extra height.';
    else if (zone?.id === 'rope') tip = 'Grab the rope on the way up, then press Space to let go when you are rising.';
    else if (!jump) tip = 'Press Space just before the edge.';
    else if (jump && (jump.detail?.vx as number) !== undefined && (zone?.id === 'gap' || zone?.id === 'landing')) {
      const g = specs.find((q2) => r.x >= q2.x - 0.5 && r.x <= q2.x + q2.width + 1) ?? specs.find((q2) => q2.x >= r.x - 12);
      const v = jump.detail!.vx as number;
      tip = g && v < g.needed ? `You left the edge at ${v.toFixed(1)} m/s, but this ${g.width.toFixed(1)} m gap needs at least ${g.needed.toFixed(1)} m/s. Run longer before you jump.` : 'Your speed was enough. Try pressing Space a little closer to the edge.';
    } else {
      const ws = course.windows ?? windows; // stored with the plan; otherwise asked of the workers below, never worked out on this thread
      const hit = ws && windowTip(ws, r.x);
      if (hit) tip = hit; else if (!ws) lateTip = true;
    }
    const train = everCleared || falls >= 3;
    panel.innerHTML = '';
    panel.style.display = 'grid';
    const h = document.createElement('strong');
    h.textContent = what === 'slide' ? 'You slid back down the wall.' : what === 'hurt' ? `Hard landing at the ${zone?.name ?? 'course'}.` : what === 'stall' ? 'The cart ran out of speed on a hill.' : log.some((e) => e.type === 'plank-break') ? 'The plank broke under you.' : log.some((e) => e.type === 'cart-off') ? 'The cart left the track at a hilltop.' : HAZARD_INFO[hazard].headline(zone?.name ?? 'course');
    const t = document.createElement('div'); t.textContent = tip;
    if (lateTip) void ensureWindows().then((ws) => { const hit = ws && windowTip(ws, r.x); if (hit && t.isConnected) t.textContent = hit; });
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
      const lines = course.track ? cartDiag() : buildDiag(lastZone, what === 'slide' ? 'slide' : 'splash');
      diagBox.innerHTML = `<strong>Slow-motion replay</strong><ul style="margin:6px 0 0;padding-left:18px">${lines.map((l) => `<li>${l}</li>`).join('')}</ul><div style="color:#58635d;font-size:13px;margin-top:6px">Esc to skip</div>`;
      diagBox.style.display = 'block';
    });
    const tryClip = shareOn(params) && !botMode && !demo && !idealWhole && !params.get('mode') ? ghostCtl?.myClip() ?? null : null, tryTicks = world.runner.tick;
    if (tryClip && clipFits(tryTicks)) mk('Make a clip of this try', () => void makeClip(tryClip.log, tryTicks, tryClip.from)).id = 'share-clip-fall'; // CC-157: a try that ended in a fall is worth a clip too
    mk('Show me the ideal run (I)', () => showIdeal(lastZone));
    if (!course.track) mk('Make it easier', () => openEditor('easier')).id = 'makeeasier';
    mk('Edit this course', () => openEditor('edit')).id = 'editfromfall';
    if (train) mk(`Train the ${zone?.name ?? 'obstacle'}`, () => { saveResume(); location.search = trainLink(zone?.id ?? 'gap', r.x); });
    panel.append(h, t, floorNote, renderReport(course, runLog, buildReport(course, runLog, world, false, null), {}, true, ghostCtl?.reportPath() ?? null, !reportSectionsOn(params)), row);
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
    if (w.mode === 'plank') return 'The plank dips under you: it gives most in the middle. Keep running.';
    if (course.planks?.length && w.mode === 'run' && w.outcome === 'running') { const pk = course.planks.find((q, i) => !w.broken?.includes(i) && q.x0 - w.runner.x > 0 && q.x0 - w.runner.x < 8); if (pk) return 'A plank bridge: run across it. A plank bends under your weight, most in the middle.'; }
    if (w.mode === 'cart') return w.cart?.started ? 'Height is speed. Hold ↓ to brake before a sharp hilltop.' : 'Press → to push off';
    if (w.mode === 'bounce') { cueDone = true; return ''; }
    // the trampoline cue comes early and stays for 4 seconds (or until you land on the bed), so it can be read before the bounce
    const bed = course.terrain.platforms.find((q2) => q2.bouncy && r.x < q2.x1);
    if (!bed || bed.x0 - r.x > 14 || w.outcome !== 'running') { cueSince = null; cueDone = false; } // far from the bed, or restarted: the cue starts over
    if (bed && !cueDone && w.mode === 'run' && w.outcome === 'running' && !(course.rope && r.x < course.rope.anchorX + 1) && // not while the rope is still ahead: it only flashed for a moment there
       (bed.x0 - r.x < 14 || (cueSince !== null && r.tick - cueSince < 480))) {
      cueSince ??= r.tick;
      return 'Trampoline ahead: press Space the moment you land on it for extra height';
    }
    if (w.mode === 'band') { // the elastic band: stretch it by running away from the post, then turn round
      const s = stretchAt(bandParams(course), w.runner.x);
      if (s < 0.5 && w.band!.maxStretch < 0.5) return 'Hold ← to run away from the post and stretch the band. Then turn round (hold →): it throws you forward.';
      const pb = predictBand(w, course);
      return pb.result === 'lands' ? `TURN NOW (hold →): ${pb.why}` : `Stretched ${s.toFixed(0)} m: ${pb.why}`;
    }
    if (course.drone && w.mode === 'run' && !w.runner.grounded) return '';
    if (course.drone && w.mode === 'run' && w.runner.grounded && w.runner.x < course.drone.x0 && w.runner.x > course.startX - 20 && !log.some((e) => e.type === 'drone-board')) return 'Run onto the teal pad, then hold E to board the cargo drone.';
    if (course.drone && w.mode === 'run' && w.runner.grounded && w.runner.x >= course.drone.x0 && w.runner.x <= course.drone.x1 && !log.some((e) => e.type === 'drone-board')) return 'Hold E to board the drone.';
    if (w.mode === 'drone' && w.drone) {
      const dp = droneParams(course), pct = Math.round((100 * w.drone.energy) / (dp.battery * 3600));
      const state = w.drone.empty ? 'Battery empty: the rotors have stopped.' : `Battery ${pct}% · push ${(w.drone.thrust / 1000).toFixed(1)} kN (hover ${(weight(dp) / 1000).toFixed(1)} kN) · speed ${Math.abs(w.drone.vx).toFixed(1)} m/s`;
      return `${state}\n← → lean · ↑ ↓ climb or come down · hold E to stay on`;
    }
    if (course.recoil && w.mode === 'run') { // the launcher: clip it on at the pad, then fire it (on the ground, or in the air to add to a jump)
      if (w.recoil && w.recoil.armed > 0 && isAimable(recoilParams(course))) {
        const rp = recoilParams(course), deg = Math.round(((w.recoil.aim ?? rp.angle) * 180) / Math.PI), pr = shotPreview(w);
        return `Cannon loaded: aim ${deg}° (↑ ↓ tilt the barrel), then press K. The tank holds ${energyWords(shotEnergy(rp))}.${pr ? ' ' + pr.why : ''}`;
      }
      if (w.recoil && w.recoil.armed > 0) return 'Launcher on: press K to fire. The ball flies back and pushes you forward. Fire in the air to add to a jump.';
      if (!w.recoil || w.recoil.fired === 0) return 'Run onto the teal pad to clip the launcher on.';
    }
    if (w.mode === 'launch') {
      if (!w.launch?.fired) return 'Hold → to pull the pin. Then press Space to let the rider go.';
      const pl = predictLaunch(w, course); // the same look ahead as the debug view: where would you come down if you let go this instant?
      return pl.result === 'lands' ? `LET GO NOW (Space): ${pl.why}` : `Wait for it: ${pl.why}`;
    }
    if (w.mode === 'swing') return 'Press Space to let go while you are still rising';
    if (w.mode === 'hang') {
      // a push cue (the way the body is swinging) and a let-go cue from the simulator's own look ahead
      const fwd = (w.hang?.omega ?? 0) >= 0, rel = predictRelease(w, course);
      return `${fwd ? 'Push →' : 'Push ←'} with the swing (hold E)  ·  ${rel.result === 'lands' && /reach the .* bar|ground/.test(rel.why) ? 'LET GO NOW: ' + rel.why : 'keep swinging: ' + rel.why}`;
    }
    if (course.holds?.length && w.mode === 'run' && !r.grounded) { const next = course.holds.find((h) => h.x > r.x - 0.5); if (next && Math.abs(next.x - r.x) < 2.5) return 'Hold E to grab the bar'; }
    if (w.mode === 'climb') return 'Keep holding E: the arms pull you up';
    { const ca = w.mode === 'run' ? climbAhead(course.terrain, r.x, r.y, 2.5, course.jumpSpeed) : null; if (ca) return ca.standing ? 'A tall wall: hold E at the wall to grab the edge and climb' : 'A very tall wall: jump and hold E at the top of the jump'; }
    if (everCleared || falls > 0) return '';
    if (r.tick < 60 || (r.x < 4 && r.tick < 600)) return 'Hold → to run';
    const g = specs.find((q2) => q2.x + 0.2 >= r.x && q2.x - r.x < 6);
    if (g && r.grounded) return 'Press Space just before the edge to jump';
    return '';
  }

  ghostCtl = createGhost({
    scene, parent: document.body, course,
    idealPlan: async () => idealCache.get(course.startX) ?? course.plan ?? (await runSearch(course, { cancelled: false }).then((r) => r.plan).catch(() => null)),
    zoneIndexAt: (x) => progressZones.findIndex((z) => x >= z.x0 && x < z.x1),
    strip: () => strip,
    look: () => choice, oldLook: params.get('ghost') === 'old',
  });
  ghostCtl.begin(!resume && startAt === undefined && (!botMode || ghostBot), (!botMode || ghostBot) && !resume?.world ? (resume ? resume.retryX : startAt ?? course.startX) : null);
  // A run played again to make a clip (CC-129). The pictures come from the real game on a stepped clock: four ticks for each, whatever the speed of this computer.
  let clipCam: { x: number; y: number } | null = null; // where the clip camera is looking, kept between pictures
  let clipLayout: ClipLayout = clipLayoutFor(location.search); // the view of the clip: about 20 m across by default (CC-160), ?clipzoom=close the older close view, ?clipshape=wide a 1280 x 720 picture
  async function makeClip(log: InputLog, ticks: number, from: number = course.startX): Promise<void> {
    const card = clipCard();
    card.say('Making your clip…');
    clipLayout = clipLayoutFor(location.search);
    const L = clipLayout, enc = await createClipEncoder(L);
    if (!enc) { card.fail('This browser cannot make a video clip. Copy the challenge link instead.'); return; }
    const cv = document.createElement('canvas'); cv.width = L.w; cv.height = L.h;
    const ctx = cv.getContext('2d')!, dom = renderer.domElement, total = clipFrames(ticks);
    const text = { course: course.name, time: secondsWords(ticks), address: 'conquercourse.pages.dev' };
    let n = 0, pending: Promise<void> = Promise.resolve();
    try {
      clipping = true; clipCam = null; paused = false; keys.clear();
      restart(from);
      feed = { log, i: 0, left: 0 };
      let smallest = 1;
      clipHook = () => {
        // how tall the standing runner is in this picture, as a share of the picture's height (the camera has settled by the third picture)
        const feet = new THREE.Vector3(world.runner.x, world.runner.y, 0).project(camera), head = new THREE.Vector3(world.runner.x, world.runner.y + RUNNER_M, 0).project(camera);
        const share = (Math.abs(head.y - feet.y) / 2) * dom.height * (L.band.h / clipCrop(dom.width, dom.height, L).h) / L.h;
        const small = L.viewM !== null && share < MARKER_BELOW; // a small runner gets a soft ring
        const mid = new THREE.Vector3(world.runner.x, world.runner.y + RUNNER_M / 2, 0).project(camera);
        drawClipFrame(ctx, dom, dom.width, dom.height, text, L, small ? { x: ((mid.x + 1) / 2) * dom.width, y: ((1 - mid.y) / 2) * dom.height, r: 0.9 * ((Math.abs(head.y - feet.y) / 2) * dom.height) + 10 } : undefined);
        if (n > 2) smallest = Math.min(smallest, share);
        pending = enc.add(cv, n++);
      };
      const step = (TICKS_PER_FRAME * DT * 1000 + 0.001) / timeScale;
      let t = last;
      for (let k = 0; k < total; k++) {
        t += step; await new Promise<void>((done) => requestAnimationFrame(() => { frame(t, true); done(); })); await pending; // drawn inside a real animation frame: the renderer refreshes some camera values only once per frame
        if (k % 8 === 0) { card.say(`Making your clip… ${Math.round((100 * k) / total)}%`); await new Promise((r) => setTimeout(r, 0)); }
      }
      const blob = await enc.finish();
      card.done(blob, 'conquercourse-run.mp4', `Your clip is ready (${(blob.size / 1e6).toFixed(1)} MB).`);
      document.documentElement.dataset.clip = String(blob.size);
      document.documentElement.dataset.clipRunner = smallest.toFixed(3);
      document.documentElement.dataset.clipMetres = clipViewMetres(dom.width, dom.height, clipCameraDistance(dom.width, dom.height, L), L).toFixed(1); // metres of course across the picture
      (window as unknown as { __clip?: Blob }).__clip = blob;
    } catch (e) {
      card.fail('The clip could not be made on this computer. Copy the challenge link instead.');
      console.warn('clip failed', e);
    } finally {
      clipping = false; clipCam = null; clipHook = null; feed = null; acc = 0;
      restart(course.startX); last = performance.now();
      requestAnimationFrame(frame);
    }
  }
  // A challenge link (CC-128): the sender's keys are played in the simulator, and that run becomes the ghost to beat.
  const copyHere = async () => { // the link of this page, so a phone can send it to a computer
    const btn = [...document.querySelectorAll<HTMLButtonElement>('#challenge-banner button')].find((x) => /Copy link|Link copied|Link ready/.test(x.textContent ?? ''));
    try { await navigator.clipboard.writeText(location.href); if (btn) btn.textContent = 'Link copied'; }
    catch { window.prompt('Copy this link', location.href); if (btn) btn.textContent = 'Link ready'; }
  };
  const challengeParam = shareOn(params) && !botMode ? params.get('challenge') : null;
  if (challengeParam) {
    void openChallenge(course, challengeParam).then((c) => {
      if (document.documentElement.dataset.madeRefused) { showBanner(challengeWords('too-big'), [], 20000); return; } // the course in the link could not be opened (CC-136)
      if (!c.ok) {
        const offer = offersIdeal(c.why) && ghostCtl ? [{ label: 'Chase the ideal run instead', go: () => { ghostCtl?.chaseIdeal(); document.getElementById('challenge-banner')?.remove(); } }] : [];
        showBanner(challengeWords(c.why), offer, 20000);
        return;
      }
      ghostCtl?.setFriend(c.track, c.nick, lookOfParam(params.get('rk')));
      if (phoneMode(params, browserPointing) && !touchControls) {
        // A phone has no keys (CC-138): the page plays the friend's run by itself and says how to play it for real.
        keysOpen = false; keysTouched = true; paintKeys(false); frontOverride = false; // the small corner view would hide the runner on a narrow screen
        showBanner(PHONE_WORDS(secondsWords(c.ticks)), [{ label: 'Copy link', go: () => void copyHere() }], 0);
        phoneWatch = c.log; feed = { log: c.log, i: 0, left: 0 };
        return;
      }
      showBanner(c.nick ? `Beat ${c.nick}: ${secondsWords(c.ticks)}` : `Beat this time: ${secondsWords(c.ticks)}`, [{ label: 'Make a clip of this run', go: () => void makeClip(c.log, c.ticks) }]);
      if (params.get('autoplay') === '1') feed = { log: c.log, i: 0, left: 0 }; // for the browser check: play the friend's keys as if by hand
      if (params.get('clip') === 'auto') void makeClip(c.log, c.ticks);
    });
  }
  let last = performance.now();
  let acc = 0;
  let studioHold = false; // the Graph Studio has the clock stopped (not the Dojo's "press any key" pause)
  // Graph Studio (CC-86): Tab pauses the Course and opens the ground as a graph to drag; "Play from here" carries on with the edited course
  if (!botMode) installGraphStudio({ env: () => ({ course, retryX, facing, falls, runnerX: world.runner.x }), pause: () => { studioHold = true; paused = true; }, resume: () => { studioHold = false; paused = false; last = performance.now(); keys.clear(); }, chipWhen: () => falls > 0 || params.get('edit') === '1' });
  { let heldBefore = false; window.addEventListener(GALLERY_EVENT, (ev) => { if ((ev as CustomEvent).detail.open) { heldBefore = paused; paused = true; keys.clear(); } else { paused = heldBefore; last = performance.now(); } }); } // the Courses gallery stops the game while it is open
  if (!botMode || params.get('next') === '1') onboarding = startOnboarding({ params, store: browserStore, course, tour: tour === 'tour', resetRun: () => { if (world.outcome === 'running' && Math.abs(world.runner.x - course.startX) < 0.01) restart(course.startX); }, openCourses: () => courseButton.open(), toggleKeys: () => { keysTouched = true; keysOpen = !keysOpen; paintKeys(keysOpen); } }); // CC-100: the Help chip, and the tour on a first visit
  const camPos = new THREE.Vector3();
  const filmShot = filmShotOf(location.search); // the film camera (CC-130): only with ?film=<shot>
  const film = filmShot ? (await import('../film/overlay')).startFilm(filmShot, params, renderer.domElement as HTMLCanvasElement, course.finishX) : null;
  let filmAir = 0;
  // Mouse: drag turns the view around the runner, the wheel zooms, a double-click (or C) goes back to the preset.
  // The numbers are changes on top of the preset view, so zero means the preset exactly.
  // the wheel zooms in to the normal closest view (0.45), and on: the target glides to the head and the camera swings round to the front of the face (about 0.7 m away)
  const FACE_START = 0.45, FACE_END = 0.05, FACE_DIST = 0.7;
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
  dom.addEventListener('wheel', (e) => { e.preventDefault(); if (camMode !== 'first') orbit.zoom = clamp(orbit.zoom * Math.exp(e.deltaY * 0.001), FACE_END, 1.7); }, { passive: false });
  dom.addEventListener('dblclick', resetOrbit);
  dom.addEventListener('contextmenu', (e) => e.preventDefault());
  dom.style.cursor = 'grab';
  const timeScale = Number(params.get('timescale') ?? 1); // ?timescale=0.1 runs the game at a tenth of its speed (for stills)
  function frame(now: number, stepped = false) {
    if (filmShot) now = performance.now(); // a film runs the game on the stepped film clock; the real animation-frame time would let the run race ahead at the speed the machine draws
    if (clipping && !stepped) return; // the clip drives the game by hand; the loop starts again when it ends
    perf.frame(now);
    acc = paused ? 0 : Math.min(acc + ((now - last) / 1000) * timeScale, 0.25);
    last = now;
    while (acc >= DT) {
      acc -= DT;
      let input: RunnerInput = NO_INPUT;
      if (feed) { input = fedInput(); if (!clipping && world.outcome === 'running') ghostCtl?.input(input); }
      else if (plan) input = inputFor(plan, world, botState, course);
      else {
        input = { run: keys.has('ArrowRight') || keys.has('KeyD'), left: keys.has('ArrowLeft') || keys.has('KeyA'), jump: jumpQueued, jumpSpeed: 0, squat: keys.has('ArrowDown') || keys.has('KeyS'), handL: keys.has('KeyE'), handR: keys.has('KeyE'), vault: vaultQueued, roll: rollQueued || keys.has('KeyX'), fire: fireQueued, aimUp: keys.has('ArrowUp') || keys.has('KeyW'), aimDown: keys.has('ArrowDown'), up: keys.has('ArrowUp') || keys.has('KeyW') };
        if (world.outcome === 'running') ghostCtl?.input(input);
        jumpQueued = false; vaultQueued = false; rollQueued = false; fireQueued = false;
      }
      const prev = world.outcome;
      prevMode = world.mode; prevVx = world.runner.vx;
      perf.simStart();
      if (hangTest === null && plankTest === null) world = stepWorld(world, input, course);
      perf.simEnd();
      updateRunProgress(world.runner.x);
      updateFlow(world.runner.tick, world.runner.vx, world.runner.vy);
      logTick(runLog, world);
      if (prevMode === 'run' && world.mode === 'wall') wallEntry = prevVx;
      if (demo && (world.outcome !== 'running' || world.runner.x > demo.x1)) demoEnd();
      else if (idealWhole && world.outcome !== 'running') demoEnd();
      log.push(...world.events);
      if (world.events !== soundedEvents) { soundedEvents = world.events; if (!replay && !clipping) soundsFor(world.events, hazard); } // after the end the same events array stays: it sounds once
      for (const e of world.events) {
        if (e.type === 'drone-board') { toast.textContent = 'The drone lifts you. Lean with ← →, climb with ↑ and come down with ↓.'; toast.style.display = 'block'; toastUntil = world.runner.tick + 240; }
        if (e.type === 'drone-empty') { toast.textContent = 'The battery ran out: the rotors stopped and the drone is falling.'; toast.style.display = 'block'; toastUntil = world.runner.tick + 240; }
        if (e.type === 'drone-land') { toast.textContent = 'The drone sets you down.'; toast.style.display = 'block'; toastUntil = world.runner.tick + 150; }
        if (e.type === 'recoil') { toast.textContent = `Shot! The ball flies back and you are pushed forward by ${(e.detail?.dvx as number).toFixed(1)} m/s${(e.detail?.dvy as number) > 0.5 ? ` and up by ${(e.detail?.dvy as number).toFixed(1)} m/s` : ''}.`; toast.style.display = 'block'; toastUntil = world.runner.tick + 180; }
        if (e.type === 'recoil') { toast.textContent = `Shot! The ball flies back and you are pushed forward by ${(e.detail?.dvx as number).toFixed(1)} m/s.`; toast.style.display = 'block'; toastUntil = world.runner.tick + 180; }
        if (e.type === 'band-snap') { toast.textContent = `The band snapped at ${(e.detail?.stretch as number).toFixed(0)} m: it can only stretch so far. Press R and turn round sooner.`; toast.style.display = 'block'; toastUntil = world.runner.tick + 360; }
        if (e.type === 'band-release') { toast.textContent = `The band lets go: you leave it at ${(e.detail?.vx as number).toFixed(1)} m/s.`; toast.style.display = 'block'; toastUntil = world.runner.tick + 180; }
        if (e.type === 'launch-dud') { toast.textContent = 'The counterweight is too light: the arm hardly moves. Try a heavier weight.'; toast.style.display = 'block'; toastUntil = world.runner.tick + 240; }
        if (e.type === 'hang-release') { releasedAtX = world.runner.x; caughtSince.clear(); }
        if (e.type === 'hang-catch') caughtSince.add(e.detail?.hold as number);
        if (e.type === 'land' && releasedAtX !== null) { // a bar flown over between the release and the landing, never held: a fact, not a grade
          const skipped = (course.holds ?? []).map((h, k) => ({ h, k })).filter(({ h, k }) => !caughtSince.has(k) && h.x > releasedAtX! + 0.5 && h.x < world.runner.x - 0.3);
          if (skipped.length) { toast.textContent = `You skipped the ${skipped.map(({ k }) => barName(k)).join(' and the ')}.`; toast.style.display = 'block'; toastUntil = world.runner.tick + 150; }
          releasedAtX = null;
        }
        if (e.type === 'jump' && keysOpen && !keysTouched) { keysOpen = false; paintKeys(false); } // the controls card has done its job once you have jumped
        if (e.type === 'hang-release' && e.detail?.slipped) { toast.textContent = 'Your grip gave out: the bar pulled harder than your hands could hold.'; toast.style.display = 'block'; toastUntil = world.runner.tick + 120; }
        if (e.type === 'land' && !e.detail?.bouncy) {
          const o = ouch(e.detail?.peakDecel as number);
          runLandings++; runLandingOuch += o;
          const bucket = summaries[runKind]; bucket.landings++; bucket.landingOuch += o;
          if (e.detail?.squat) { runBentLandings++; bucket.bentLandings++; }
        }
        if (e.type === 'land' && (e.detail?.impact as number) > 2 && !e.detail?.bouncy) {
          const o = ouch(e.detail?.peakDecel as number);
          squashUntil = world.runner.tick + 40; squashDepth = e.detail?.squat ? 0.7 : o >= 6 ? 0.6 : 0.88;
          if (o >= 3 && toastUntil < world.runner.tick + 100) { // (a fresh 'You skipped the bar' stays)
            toast.textContent = o >= 8 ? 'Ouch! Dangerous landing: bend your knees (↓) on big drops.' : o >= 6 ? 'Hard landing: you stumble. Hold ↓ to bend your knees.' : 'Firm landing.';
            toast.style.display = 'block'; toastUntil = world.runner.tick + 90;
          }
        }
      }
      if (replay === null && prev === 'running') frames.push({ x: world.runner.x, y: world.runner.y });
      if (frames.length > 1200) frames.shift();
      if (prev === 'running' && world.outcome === 'splash') onFall('splash');
      if (prev === 'running' && world.outcome === 'hurt') onFall('hurt');
      if (prev === 'running' && world.outcome === 'stalled') onFall('stall');
      if (world.events.some((e) => e.type === 'wall-slide')) onFall('slide');
      if (phoneWatch && prev === 'running' && world.outcome === 'cleared') { // the friend's run, watched on a phone: no report, no What next card; play it again in a moment (CC-138)
        const again = phoneWatch;
        setTimeout(() => { if (again) { restart(course.startX); feed = { log: again, i: 0, left: 0 }; } }, 2500);
      } else if (prev === 'running' && world.outcome === 'cleared' && !clipping) {
        clearFinishZone(world.runner.x); everCleared = true; track('clears'); finishRun(true); trackCourseEvent('success', analyticsCourseKey, course.name, analyticsRunId, analyticsMode);
        offerClear();
        try { localStorage.setItem('cc.course.cleared', '1'); } catch { /* ok */ }
        panel.innerHTML = ''; panel.style.display = 'grid';
        const ghostLine = ghostCtl?.reportLine(world.runner.tick) ?? null;
        const rep = buildReport(course, runLog, world, runKind === 'attempt', bestLine(course));
        const courses = DEMOS.filter((d) => !WORD_VALUES.includes(d[0])), here = courses.findIndex((d) => (d[0] || null) === currentWorld(params, course.name).value), nxt = courses[here + 1];
        const body = renderReport(course, runLog, rep, {
          again: () => restart(course.startX),
          watch: course.plan ? () => { panel.style.display = 'none'; void startIdeal(course.startX, null); } : undefined,
          next: here >= 0 && nxt ? { name: nxt[1].split(':')[0], go: () => { location.href = worldHref(nxt[0]); } } : undefined,
          close: () => { panel.style.display = 'none'; },
        }, false, ghostCtl?.reportPath() ?? null, !reportSectionsOn(params));
        if (ghostLine) body.querySelector('#report-ghost-slot')?.append(ghostLine);
        if (ghostCtl && !botMode && !demo && !idealWhole) body.querySelector('#report-actions')?.prepend(...ghostCtl.reportActions(() => { panel.style.display = 'none'; retryX = course.startX; restart(course.startX); }));
        if (shareOn(params) && !botMode && !demo && !idealWhole && !params.get('mode')) {
          const mine = ghostCtl?.myRun() ?? null, mineClip = ghostCtl?.myClip() ?? null, ticks = world.runner.tick; // a link needs a run from the start; a clip can be made of any try (CC-157)
          if (mine || mineClip) body.querySelector('#report-actions')?.append(...shareButtons({ link: mine ? (nick) => makeChallengeUrl(location.origin, location.search, course, mine, nick, choice) : undefined, courseTooBig: () => courseTooBig(location.search, course), clip: mineClip && clipFits(ticks) ? () => void makeClip(mineClip.log, ticks, mineClip.from) : undefined }));
        }
        if (reportSectionsOn(params)) organiseReport(body, !botMode && !demo && !idealWhole ? { dojo: () => openDojo() } : {}); // CC-158
        setMusicScreen('report');
        panel.append(body); (body.querySelector('#report-again') as HTMLElement | null)?.focus({ preventScroll: true });
        if (!botMode && !demo && !idealWhole || params.get('next') === '1') onboarding.onCleared(panel); // CC-100: the one-time What next card, at the top of the report
        if (!botMode && !demo && !idealWhole && !rep.saving) clearedNote(); // a shortcut, if the simulator knows one (a fact, never a grade)
      }
    }
    let r = world.runner;
    if (replay) {
      const f = frames[Math.floor(replay.i)];
      replay.i += 0.5;
      if (replay.i >= replay.to || !f) { replay = null; clearGuides(); if (world.outcome !== 'running') showAgain(); } else r = { ...r, x: f.x, y: f.y };
    }
    const dtPlank = Math.min(0.05, Math.max(0, now - lastPlankNow) / 1000 * (paused ? 0 : timeScale)); lastPlankNow = now;
    plankView?.place(world, dtPlank);
    const plankY = replay ? null : plankView?.surfaceAt(world) ?? null; // the picture of the bend lags the physics a little: the feet stand on the drawn surface so they agree
    if (plankY !== null) r = { ...r, y: plankY };
    const sq = world.runner.tick < squashUntil ? squashDepth : 1;
    body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    body.position.set(r.x, r.y + 0.85 * sq, 0);
    ghostCtl?.frame({ tick: world.runner.tick, x: world.runner.x, active: (!plan || ghostBot) && !demo && !idealWhole && !replay && !clipping, firstPerson: camMode === 'first' });
    const facingSpeed = world.mode === 'cart' && world.cart ? world.cart.v : world.runner.vx;
    if (Math.abs(facingSpeed) > 0.3 && world.mode !== 'hang') facing = facingSpeed < 0 ? -1 : 1; // on a bar the body keeps facing one way, whichever way it swings
    // on a bar the actor is turned about its hands, so it is placed with the hands on the bar (feet straight below it before the turn), like the rope
    const hangHold = world.mode === 'hang' && world.hang ? course.holds?.[world.hang.hold] : undefined;
    const hOff = hangHold && world.hang ? handOffset(world.hang) : { x: 0, y: 0 }; // the hands ease onto the bar over a few ticks after a catch
    const ax = hangHold ? hangHold.x + hOff.x : r.x, ay = hangHold ? hangHold.y + hOff.y - DEFAULT_HANG.handHeight : r.y;
    if (actor) actor.update({ ...actorStateFor(world, keys.has('ArrowDown') || keys.has('KeyS'), facing), x: ax, y: ay, ledge: world.mode === 'climb' && world.climb ? { x: world.climb.edge, y: world.climb.top } : ledge, next: world.mode === 'run' ? nextObstacle(r.x) : undefined });
    if (world.events.some((e) => e.type === 'cart-off')) cartFlying = true;
    trackView?.place(world, cartFlying);
    if (world.runner.tick > toastUntil) toast.style.display = 'none';
    paintStrip(r.x);
    drumLane.update(r.x);
    debug.update(world);
    grabHint.update(world, keys.has('KeyE'), performance.now());
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
    trebView?.update(world);
    recoilView?.update(world, facing, shotPreview(world)?.path);
    bandView?.update(world);
    droneView?.update(world, facing);
    hint.textContent = hintFor(world);
    hint.style.display = hint.textContent ? 'block' : 'none';
    if (ropeMesh && course.rope) {
      // the rope swings about its anchor with the runner: its middle is half a rope length along the swing
      const th = world.swing ? world.swing.theta : 0;
      ropeMesh.rotation.z = th;
      ropeMesh.position.set(course.rope.anchorX + (ropeLen / 2) * Math.sin(th), course.rope.anchorY - (ropeLen / 2) * Math.cos(th), 0);
      ropeMesh.updateMatrix(); ropeMesh.updateMatrixWorld(true);
    }
    msg.textContent = paused && !studioHold ? 'Back from the Dojo. Press any key to carry on.' : world.outcome === 'cleared' ? MESSAGES.cleared : idealNote;
    msg.style.display = msg.textContent ? 'block' : 'none'; // CC-166: an empty message used to leave its dark panel, a black pill, in the middle of the screen
    const onCoaster = world.mode === 'cart' && world.cart !== null;
    const spd = onCoaster ? Math.abs(world.cart!.v) : Math.abs(r.vx);
    const gaugeMax = onCoaster ? 40 : GAUGE_MAX;
    const nextGap = specs.find((g) => g.x + 0.2 >= r.x && g.x - r.x < 40 && ['gap', 'landing'].includes(zoneOf(g.x)?.id ?? ''));
    let need = 0, msgNext = '';
    if (nextGap && world.mode === 'run') { need = nextGap.needed; msgNext = `Next gap: ${nextGap.width.toFixed(1)} m wide. You need at least ${need.toFixed(1)} m/s at the edge.`; }
    else if (course.wall && world.mode === 'run' && r.x < course.wall.x0 && course.wall.x0 - r.x < 45) { need = wallNeed; msgNext = `Warped wall: ${(course.wall.height ?? DEFAULT_WALL.height).toFixed(1)} m high. You need at least ${need.toFixed(1)} m/s at its foot.`; }
    speedGauge.set({ text: `${onCoaster ? 'Speed along track' : 'Speed'} ${spd.toFixed(1)} m/s`, max: gaugeMax, value: spd, mark: need, colour: need && spd < need ? '#c4572a' : '#0f6b5c', note: msgNext });
    if (batteryGauge) { // before boarding there is no drone state yet: the battery is full
      const full = droneParams(course).battery * 3600;
      const left = world.drone ? (world.drone.empty ? 0 : Math.max(0, Math.min(1, world.drone.energy / full))) : 1;
      const pct = Math.round(100 * left);
      batteryGauge.set({ text: world.drone?.empty ? 'Drone battery empty' : `Drone battery ${pct}%`, max: 1, value: left, colour: pct <= 20 ? '#c4572a' : '#2a6fb0' });
    }
    hud.textContent = `Time ${(r.tick / 120).toFixed(1)} s   ·   ${Math.max(0, Math.round(r.x))} m of ${course.finishX} m`;
    livePhotos?.update(r.x);
    // the head: the body's turn about the bar (swing angle theta, a rotation so it passes the top smoothly) and where the eyes are; the first-person camera and the corner window both use it.
    // After a release the head settles level over about 0.3 s (the body has no spin in flight); on the ground it is level.
    const nowS = performance.now() / 1000, dtHead = Math.min(0.05, Math.max(0, nowS - pipClock)); pipClock = nowS;
    if (world.mode === 'hang' && world.hang) pipRoll = world.hang.theta;
    else if (!r.grounded) pipRoll *= Math.exp(-dtHead / 0.1);
    else pipRoll = 0;
    const qRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), pipRoll);
    const nose = new THREE.Vector3(0.15 * facing, 0, 0).applyQuaternion(qRoll);
    const headHold = world.hang ? course.holds?.[world.hang.hold] : undefined;
    const eye = headHold && world.hang
      ? { x: headHold.x + 0.4 * Math.sin(world.hang.theta) + nose.x, y: headHold.y - 0.4 * Math.cos(world.hang.theta) + nose.y } // just under the hands, along the arms
      : { x: r.x + nose.x, y: r.y + 1.62 + nose.y };
    // three views, switched with C: from the side, from behind at 45 degrees, and through the runner's eyes
    const fov = camMode === 'first' ? 75 : 40;
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    if (actor) actor.object.visible = camMode !== 'first';
    body.visible = !actor && camMode !== 'first';
    if (camMode === 'first') {
      camera.position.set(eye.x, eye.y, 0.1);
      const ch = Math.cos(orbit.pitch); // drag turns your head
      const dir = new THREE.Vector3(facing * Math.cos(orbit.yaw) * ch, Math.sin(orbit.pitch) - 0.042, facing * Math.sin(orbit.yaw) * ch).applyQuaternion(qRoll);
      camera.up.set(0, 1, 0).applyQuaternion(qRoll); // the whole view tilts with the body, through the top of a full circle
      camera.lookAt(eye.x + 10 * dir.x, eye.y + 10 * dir.y, 0.1 + 10 * dir.z);
      camPos.copy(camera.position);
    } else if (clipping) {
      // The clip's own camera (CC-137): side-on and close, glued to the runner. It moves once for each picture, so it is the same on every computer.
      const dom = renderer.domElement, L = clipLayout, dist = clipCameraDistance(dom.width, dom.height, L);
      const bandM = (L.viewM ?? 0) * L.band.h / L.w, ahead = L.viewM !== null ? 0.2 * L.viewM : 0.45, lift = L.viewM !== null ? 0.17 * bandM : 1.05, slack = L.viewM !== null ? 0.1 * bandM : 0.8;
      // the wide view looks a fifth of the picture ahead of the runner, so the next obstacle is in frame, and keeps the runner low so there is sky for a swing or a jump
      const wantX = r.x + ahead * facing, wantY = r.y + lift;
      if (!clipCam) clipCam = { x: wantX, y: wantY };
      else { // follow quickly, and never let the runner drift more than a metre from the middle (a long fall must not leave the picture)
        clipCam.x = wantX; clipCam.y += (wantY - clipCam.y) * 0.25; // x is locked to the runner so the body does not slide about the picture; y is eased so a bob or a hop is not copied
        clipCam.x = clamp(clipCam.x, wantX - 0.6, wantX + 0.6); clipCam.y = clamp(clipCam.y, wantY - slack, wantY + slack);
      }
      camera.up.set(0, 1, 0);
      camera.position.set(clipCam.x, clipCam.y, dist);
      camera.lookAt(clipCam.x, clipCam.y, 0);
      camPos.copy(camera.position);
    } else {
      camera.up.set(0, 1, 0);
      // the preset is a target point and an offset from it; the mouse turns and scales the offset around the target
      const off = camMode === 'side' ? new THREE.Vector3(0, 1.5, 25) : new THREE.Vector3(-12, 3, 11);
      const ft0 = clamp((FACE_START - orbit.zoom) / (FACE_START - FACE_END), 0, 1), ft = ft0 * ft0 * (3 - 2 * ft0); // 0 normal view, 1 face close-up
      const headX = eye.x - nose.x, headY = eye.y - nose.y; // the middle of the head (under the hands while hanging)
      const tx = (camMode === 'side' ? r.x + (phoneWatch ? 0.5 : 5) : r.x + 4) * (1 - ft) + headX * ft, wantY = camMode === 'side' ? r.y + 2.5 : r.y + 1.5;
      camY = !camYSet || Math.abs(wantY - camY) > 4 ? wantY : camY + (wantY - camY) * (1 - Math.exp(-dtHead / 0.15)); camYSet = true; // a retry or a big drop snaps; a dip eases
      const ty = camY * (1 - ft) + headY * ft;
      const len = off.length() * Math.max(orbit.zoom, FACE_START) * (1 - ft) + FACE_DIST * ft;
      const yaw = Math.atan2(off.x, off.z) + orbit.yaw + facing * 1.05 * ft; // swing round to the front of the face
      const pitch = clamp(Math.asin(off.y / off.length()) + orbit.pitch, 0.03, 1.35) * (1 - ft) + 0.08 * ft;
      const want = new THREE.Vector3(tx + len * Math.cos(pitch) * Math.sin(yaw), Math.max(0.5, ty + len * Math.sin(pitch)), len * Math.cos(pitch) * Math.cos(yaw));
      camPos.lerp(want, 0.12);
      camera.position.copy(camPos);
      camera.lookAt(tx, ty, 0);
      document.documentElement.dataset.camdist = camPos.distanceTo(new THREE.Vector3(tx, ty, 0)).toFixed(2); // for the face-zoom check
    }
    if (film) { // ?film=<shot> (CC-130): the film camera takes over the view; play is unchanged without it
      filmAir += ((r.grounded ? 0 : 1) - filmAir) * (1 - Math.exp(-dtHead / 0.25));
      const p = film.pose({ runnerX: r.x, runnerY: r.y, airborne: filmAir });
      if (camera.fov !== p.fov) { camera.fov = p.fov; camera.updateProjectionMatrix(); }
      camera.up.set(0, 1, 0); camera.position.set(...p.pos); camera.lookAt(...p.look); camPos.copy(camera.position);
      film.tick(camera);
    }
    floor.update(now / 1000);
    if (chunks.length > 8) cullFar(chunks, camera.position, 260); // far chunks of a big place are not drawn
    perf.renderStart();
    renderer.render(scene, camera);
    clipHook?.(); // the clip takes this picture before the front inset is drawn over it
    perf.renderEnd();
    // The front inset accompanies the default side view; F toggles it in every camera mode.
    const showFront = frontOverride ?? true;
    pipFrame.style.display = showFront ? 'block' : 'none';
    if (showFront) {
      // On a coaster the inset rides with the cart and looks forward along its rails; elsewhere it shows the runner's eyes.
      if (course.track && world.mode === 'cart' && world.cart) {
        const direction = world.cart.v < -0.3 ? -1 : 1;
        const rails = railsOf(course.track, world.cart?.segment ?? 0), aheadX = r.x + direction * 12;
        frontCam.up.set(0, 1, 0);
        frontCam.position.set(r.x, r.y + 1.4, 0);
        frontCam.lookAt(aheadX, rails.y(aheadX) + 1.4, 0);
      } else {
        // First person: the eyes, looking the way the body faces and a little down, turned with the body about the bar.
        const fwd = new THREE.Vector3(facing * Math.cos(0.1), -Math.sin(0.1), 0).applyQuaternion(qRoll);
        frontCam.up.set(0, 1, 0).applyQuaternion(qRoll);
        frontCam.position.set(eye.x, eye.y, 0.1); frontCam.lookAt(eye.x + 10 * fwd.x, eye.y + 10 * fwd.y, 0.1);
      }
      const actorWasVisible = actor?.object.visible ?? false;
      if (actor) actor.object.visible = false; // no body in front of the eyes
      const W = host.clientWidth, H = host.clientHeight;
      renderer.autoClear = false;
      renderer.setScissorTest(true);
      const py = H - PIP_BOTTOM - PIP_H; // the WebGPU viewport counts from the top
      renderer.setViewport(W - PIP_W - 16, py, PIP_W, PIP_H); renderer.setScissor(W - PIP_W - 16, py, PIP_W, PIP_H);
      renderer.render(scene, frontCam);
      if (actor) actor.object.visible = actorWasVisible;
      renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); renderer.autoClear = true;
    }
    document.documentElement.dataset.tick = String(r.tick);
    document.documentElement.dataset.vault = world.mode === 'vault' && world.vault ? (world.vault.i / world.vault.n).toFixed(3) : ''; document.documentElement.dataset.climb = world.mode === 'climb' && world.climb ? (world.climb.i / world.climb.n).toFixed(3) : ''; document.documentElement.dataset.x = r.x.toFixed(2); document.documentElement.dataset.omega = (world.hang?.omega ?? 0).toFixed(3); document.documentElement.dataset.grounded = world.runner.grounded ? '1' : '0'; // for the keyboard check
    document.documentElement.dataset.outcome = world.outcome;
    if (playedSounds().length !== soundCount) { soundCount = playedSounds().length; document.documentElement.dataset.sounds = playedSounds().join(','); } // for the bot check: headless cannot be heard
    document.documentElement.dataset.mode = world.mode;
    if (!clipping) requestAnimationFrame(frame);
  }
  const perf = createPerf({ label: 'Course', backend: (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2', renderer: renderer as unknown as PerfSource['renderer'], scene });
  camPos.set(5, 3.5, 17);
  requestAnimationFrame(frame);

  const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';
  return { backend, world: () => world, restart };
}
