import { backgroundOn, savedBackground } from '../ui/background';
import { mountToasts } from '../ui/toast-stack';
import { createKeydown } from './course/keydown';
import type { CourseCtx } from './course/context';
import { createRunStats } from './course/stats';
import { createHint } from './course/hint';
import { createCourseCamera } from './course/camera';
import { createRunnerLook } from './course/characters';
import { createClipMaker } from './course/clip';
import { createCourseState } from './course/state';
import { createSearch } from './course/search';
import { createIdealRun } from './course/ideal';
import { createNav, type Resume } from './course/nav';
import { createFall, type Analytics } from './course/fall';
import { createHud } from './course/hud';
import { createWelcome } from './course/welcome';
import { createShortcutList } from './course/shortcuts';
import { buildCourseScene } from './course/scene';
import { showClearedReport } from './course/report';
import { createViewHooks } from './course/board';
import { mountDrums } from './course/drums';
import { mountCourseGhost } from './course/ghost';
import { setMusicScreen } from '../ui/music';
import { playedSounds, soundButton, soundsFor, startAudio } from '../ui/audio';
import * as THREE from 'three/webgpu';
import courseJson from '../course/default-course.json';
import type { CourseData } from '../course/course';
import { NO_INPUT, type RunnerInput } from '../sim/runner';
import { DT } from '../sim/units';
import { droneParams, newWorld, recoilParams, stepWorld, type GameEvent, type WorldState } from '../sim/world';
import { isAimable } from '../sim/recoil';
import { DEFAULT_WALL } from '../sim/wall';
import { inputFor, searchIdealRun, type Plan } from '../sim/ideal';
import { createGhost } from '../ui/ghost';
import { lookOfParam } from '../ui/ghost-look';
import { challengeWords, isOldLongLink, OLD_LINK_WORDS, offersIdeal, openChallenge, secondsWords, shareOn } from '../share/challenge';
import { clipLayoutFor } from '../share/clip';
import { mountTouch, touchOn } from '../share/touch';
import { hudOn, keycapCss, panelCss } from '../ui/hud-style';
import { PHONE_WORDS, browserPointing, phoneMode } from '../share/phone';
import { showBanner } from '../share/share-ui';
import { courseHash, encodeLog, inputOfMask, startXOf, type InputLog } from '../sim/replay';
import { findShortcuts, type Shortcut } from '../sim/shortcuts';
const findShortcutsNow = (c: CourseData): Shortcut[] => findShortcuts(c, { moveChoices: false }).shortcuts; // ?bot=shortcut only: blocks the page while it searches
import { gapSpecs, minSpeedForWall } from '../sim/needs';
import { ouch } from '../sim/landing';
import { logTicks } from '../sim/run-checks';
import { noteRunning } from '../ui/feedback-model';
import { track, trackCourseEvent, courseKey, publishClear, sendClear, session } from '../ui/feedback';
import { statsOn } from '../ui/course-stats';
import { boardKeyOfPage, FIRST_COURSE_KEY } from '../share/board-courses';
import { challengeKey, challengeOn, cidOf } from '../share/challenge-course';
import { touchStreak } from '../ui/streak';
import { announceBest, boardCorner, boardOn, newsStrip, rememberBest, type BoardHooks } from '../ui/leaderboard';
import { createRookieActor } from '../render/actor';
import { measureFacing } from '../characters/facing';
import { makeObstacle } from '../course/collide';
import { DEFAULT_HANG, feetOf, handOffset } from '../sim/holds';
import { actorStateFor } from '../motion/actor-state';
import { logTick } from '../ui/run-report';
import { GALLERY_EVENT } from '../ui/world-picker';
import { createDebugView } from '../ui/debug-view';
import { createGrabHint } from '../ui/grab-hint';
import { slugOfCourse } from '../ui/place-photos';
import { mountLivePhotos } from '../ui/live-photos';
import { mountFurniture } from '../render/furniture-view';
import { mountBackdrop } from '../render/backdrop-view';
import { FURNITURE_ON } from '../world/furniture';
import { barName, predictShot, type Prediction } from '../sim/predict';
import { ballsOn, BALL_LAUNCHERS } from '../sim/shots';
import { topAt } from '../sim/beam';
import { installGraphStudio } from './graph-studio';
import { createPerf, type PerfSource } from '../ui/perf';
import { cullFar } from '../render/static-merge';
import { startOnboarding, type Onboarding } from '../ui/onboarding';
import { browserStore } from '../ui/onboarding-flags';
import { pageQuery, pageSearch } from '../flags';

// The Course: the five obstacles in a row. The simulator decides everything; this file only draws it
// and turns keys into inputs. Time comes from the simulator's tick count, never from the browser's clock.
const defaultCourse = courseJson as unknown as CourseData;

export interface CourseGame {
  backend: 'webgpu' | 'webgl2';
  world: () => WorldState;
  restart: () => void;
}

const MESSAGES: Record<string, string> = {
  cleared: 'You made it! Press R to run it again.',
};

export async function startCourse(host: HTMLElement, course: CourseData = defaultCourse): Promise<CourseGame> {
  const params = pageQuery();
  const loadedIsDefault = course === defaultCourse, loadedHash = courseHash(course); // CC-108: the course as the page opened it; a ground edit or any other change makes the hash differ, and then the run is no longer on a ranked board
  // Coming back from the Dojo: the Course is put back exactly as it was (same course, same place), not started again.
  let resume: Resume | null = null;
  try {
    const raw = sessionStorage.getItem('cc.resume');
    sessionStorage.removeItem('cc.resume');
    if (raw && !params.get('mode')) resume = JSON.parse(raw) as Resume;
  } catch { /* start fresh */ }
  if (resume) course = resume.course;
  if (ballsOn(params) && !course.shots && course === defaultCourse) course = { ...course, shots: BALL_LAUNCHERS }; // CC-240: ?balls=1 plays the First Course with the timed balls
  if (course.wall && params.get('warpedE') === '0') course = { ...course, wall: { ...course.wall, needE: false } }; // the old rule: the warped wall is grabbed without E
  // ?wallh=5 makes the wall that high (for tests): the curve stays the same and the deck on top rises with it
  const wallH = Number(params.get('wallh'));
  if (course.wall && wallH >= 3 && wallH <= 6) {
    const R0 = course.wall.radius ?? course.wall.height ?? 4.3;
    course = { ...course, wall: { ...course.wall, height: wallH, radius: R0 }, terrain: { ...course.terrain, platforms: course.terrain.platforms.map((q) => (Math.abs(q.x0 - (course.wall!.x0 + R0)) < 0.5 ? { ...q, top: wallH } : q)) } };
  }
  const startAt = params.get('startx') === null ? undefined : Number(params.get('startx')); // ?startx=45 begins there (for tests and films)
  const st = createCourseState({ world: resume?.world ?? newWorld(course, resume ? resume.retryX : startAt), paused: !!resume?.world, retryX: resume ? resume.retryX : course.startX, falls: resume ? resume.falls : 0, frontOverride: params.has('front') ? params.get('front') === '1' : null, clipLayout: clipLayoutFor(pageSearch()) });
  const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL: params.get('backend') === 'webgl2' });
  await renderer.init();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(/^[0-9a-f]{6}$/i.test(params.get('bg') ?? '') ? parseInt(params.get('bg')!, 16) : 0x9fc5e8); // ?bg=rrggbb only for pictures over other backgrounds (CC-167)
  // CC-249: the player's own picture behind every course, kept in this browser only; ?bg= (pictures over other backgrounds) wins
  const skyColor = scene.background;
  const paintBackground = () => {
    const url = backgroundOn(params) && !params.get('bg') ? savedBackground() : null;
    if (!url) { scene.background = skyColor; return; }
    new THREE.TextureLoader().load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; scene.background = t; });
  };
  paintBackground();
  let actor: Awaited<ReturnType<typeof createRookieActor>> | null = null;
  let facing: 1 | -1 = course.track ? 1 : resume ? resume.facing : 1;
  let bodyMesh: THREE.Mesh | null = null; // the capsule, made below
  let sayNow: (text: string, ticks: number) => void = () => undefined; // the toast line, made below
  const cam = await createCourseCamera({ host, renderer, scene, course, params, st, body: () => bodyMesh!, facing: () => facing, actor: () => actor, say: (t, n) => sayNow(t, n) });
  const { camera, frontCam } = cam;
  const { trackView, plankView, trebView, shotsView, poleView, recoilView, bandView, droneView, hazard, floor, chunks, ropeMesh, ropeLen } = buildCourseScene(scene, course, params);
  let shotCache: { key: string; pr: Prediction } | null = null; // the dotted preview of a loaded cannon: the same prediction the debug view uses, worked out once per tick
  const shotPreview = (w: WorldState): Prediction | null => {
    if (!course.recoil || !isAimable(recoilParams(course)) || w.mode !== 'run' || (w.recoil?.armed ?? 0) <= 0) return null;
    const key = `${w.runner.tick}:${w.recoil!.aim}`;
    if (shotCache?.key !== key) shotCache = { key, pr: predictShot(w, course) };
    return shotCache.pr;
  };

  // the runner (a capsule until the Rookie is wired in)
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.1, 6, 12), new THREE.MeshStandardMaterial({ color: 0xf07b1d }));
  scene.add(body);
  bodyMesh = body;
  // the real Rookie replaces the capsule when its model loads; the capsule stays as the fallback
  const wear = createRunnerLook({ scene, course, params, body, setActor: (a) => { actor = a; }, actor: () => actor });
  await wear.start();
  // ?probe=1: what the player sees. For the facing check (docs/character-facing-bug.md): where the runner moved, where its toe bone points, and which way its SKIN faces, all on screen.
  if (params.get('probe') === '1') (window as unknown as { __heading: () => unknown }).__heading = () => {
    if (!actor) return null;
    const names = actor.names(), J = actor.joints(), at = (n: string) => J[names.indexOf(n)];
    const toe = at('LeftToeBase'), foot = at('LeftFoot');
    const skinned: any[] = []; actor.object.traverse((o: any) => { if (o.isSkinnedMesh) skinned.push(o); }); // eslint-disable-line @typescript-eslint/no-explicit-any
    const m = skinned.sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count)[0];
    if (!m) return { x: actor.object.position.x, boneToeDx: toe.x - foot.x, skin: null };
    m.updateMatrixWorld(true); m.skeleton.update();
    const n = m.geometry.attributes.position.count, P = new Float32Array(n * 3), v = new (actor.joints()[0].constructor as new () => { x: number; y: number; z: number })();
    for (let i = 0; i < n; i++) { m.getVertexPosition(i, v); (v as any).applyMatrix4(m.matrixWorld); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z; } // eslint-disable-line @typescript-eslint/no-explicit-any
    const bn: string[] = m.skeleton.bones.map((b: any) => b.name), rest = bn.map((nm) => { const j = at(nm); return j ? [j.x, j.y, j.z] as [number, number, number] : [0, 0, 0] as [number, number, number]; }); // eslint-disable-line @typescript-eslint/no-explicit-any
    const toward = (dir: 1 | -1) => measureFacing(P, bn, rest, [dir, 0]);
    const f = toward(1);
    const hips = at('Hips'), sp = (new (hips.constructor as new () => { x: number; y: number; z: number; set(x: number, y: number, z: number): unknown; project(c: unknown): unknown })()); sp.set(hips.x, hips.y, hips.z); sp.project(camera);
    return { screen: { x: (sp.x * 0.5 + 0.5) * renderer.domElement.clientWidth, y: (-sp.y * 0.5 + 0.5) * renderer.domElement.clientHeight }, heading: Math.cos(actor.object.rotation.y), hipsX: hips.x, x: actor.object.position.x, rotY: actor.object.rotation.y, boneToeDx: toe.x - foot.x, skinScoreRight: f.score, skinConfidenceRight: f.confidence, votes: f.votes.map((q) => [q.name, +q.score.toFixed(3)]) };
  };

  // HUD
  const { VIEW_KEYS, paintStrip, gaugeStack, speedGauge, batteryGauge, hud, msg, help, panel, hint, dojoBtn, idealBtn, rowBtns, paintKeys, strip, progressZones, fallLog, hardBand, addHardest } = createHud({ course, defaultCourse, params, st, paintBackground, openDojo: () => openDojo(), openEditor: (i) => openEditor(i), showIdeal: (z) => ideal.showIdeal(z), showWholeIdeal: () => ideal.showWholeIdeal(), zoneAt: (x) => zoneAt(x) });
  let reportWas = false;
  const nextCam = cam.nextCam;
  const { courseButton, tour } = createWelcome({ course, params, resume: !!resume });
  let onboarding: Pick<Onboarding, 'onCleared' | 'onFall'> = { onCleared() {}, onFall() {} };
  // The drum lane is on by default wherever the course has a planned player route; a coaster is mostly passive cart motion.
  const forceDrums = params.get('drums') === '1';
  const runSearch = createSearch();
  const { drumLane, toastDrums: toastDrumsNow } = mountDrums({ course, params, forceDrums, runSearch });
  const dbgBtn = document.createElement('button');
  dbgBtn.id = 'debugbtn'; dbgBtn.textContent = 'Debug (B)'; dbgBtn.title = 'Show the collision boxes and where a jump right now would go';
  dbgBtn.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none'; dbgBtn.tabIndex = -1; dbgBtn.setAttribute('aria-hidden', 'true'); // CC-246: no label on the screen; B still toggles it, and the tests use this node as the "course is ready" mark
  // CC-159: how to start again is on the screen all the time, as a key cap you can also press with a finger or the mouse
  const restartChip = document.createElement('button');
  restartChip.type = 'button'; restartChip.id = 'restart-chip';
  restartChip.innerHTML = `<kbd style="${keycapCss}">R</kbd> Restart`;
  restartChip.title = 'R starts again where you last began; Shift+R starts from the very start';
  restartChip.style.cssText = `font:700 13px system-ui,sans-serif;cursor:pointer;white-space:nowrap;display:flex;gap:7px;align-items:center;${panelCss('4px 10px 4px 6px')}`;
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
  document.body.append(hudBox, msg, help, panel, hint, gaugeStack.el, dojoBtn, idealBtn, rowBtns, wear.pick, cam.button, dbgBtn);
  // CC-85: a real place shows its real photos (credit under each, a large view on click); ?photos=0 or the Hide switch turns them off
  const placeSlug = slugOfCourse(course.name);
  let livePhotos: { update(x: number): void } | null = null; // CC-90: street photos from the allow-list change as the runner moves; the CC-85 strip is the fallback
  if (placeSlug && pageQuery().get('photos') !== '0') void mountLivePhotos(document.body, course).then((h) => { livePhotos = h; });
  if (placeSlug && FURNITURE_ON(pageQuery())) void mountFurniture(scene, course); // CC-187: real street furniture, looks only, off by default
  { const bd = params.get('backdrop'); if (bd) void mountBackdrop(scene, course, bd); } // CC-234: the place's buildings and street furniture behind the hero lane, looks only, off by default
  // CC-197: every short message goes through one stack (new ones below, old ones leave upward); ?toasts=old keeps the single centred toast
  const toastsOld = params.get('toasts') === 'old';
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;left:50%;top:44%;transform:translateX(-50%);font:700 22px system-ui,sans-serif;color:#10141c;background:#fffffff0;border-radius:10px;padding:6px 14px;pointer-events:none;display:none';
  document.body.append(toast);
  const toasts = mountToasts();
  let toastUntil = 0, squashUntil = 0, squashDepth = 1;
  const say = (text: string, ticks: number) => { if (toastsOld) { toast.textContent = text; toast.style.display = 'block'; toastUntil = st.world.runner.tick + ticks; } else toasts.show(text, ticks, st.world.runner.tick); };
  sayNow = say;
  if (params.get('check') === '1') (window as unknown as { __say?: typeof say }).__say = say; // for scripts/toast-shot.mjs: three toasts at once
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
  // while the feedback form is open, or a text box has the focus, no game key does anything (typing a T must not open the Dojo)
  const typing = (e: KeyboardEvent): boolean => {
    const t = e.target as HTMLElement | null;
    return document.getElementById('cc-feedback') !== null || (!!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable));
  };
  addEventListener('keydown', createKeydown({
    st, typing, course, VIEW_KEYS,
    get botMode() { return botMode; },
    restart: (x) => restart(x),
    stopWholeIdeal: () => ideal.stopWholeIdeal(), showWholeIdeal: () => ideal.showWholeIdeal(), showIdeal: (id) => ideal.showIdeal(id),
    zoneAt: (x) => zoneAt(x), openDojo: () => openDojo(),
    clearGuides: () => clearGuides(), showAgain: () => showAgain(), nextCam: () => nextCam(),
    get drumLane() { return drumLane; },
    toggleDebug: () => toggleDebug(),
    get ghostCtl() { return ghostCtl; },
    paintKeys: (o) => paintKeys(o),
  }));
  addEventListener('keyup', (e) => st.keys.delete(e.code));
  const touchControls = touchOn(params, browserPointing); // CC-139: on a touch device the buttons press the same keys; ?touch=0 turns them off
  if (touchControls) { mountTouch(document.body, { cannon: !!course.recoil }); gaugeStack.lift(150); st.keysOpen = false; st.keysTouched = true; paintKeys(false); st.frontOverride = false; } // the keys card is for keyboards; the small corner view would hide the runner on a narrow screen
  addEventListener('resize', () => {
    renderer.setSize(host.clientWidth, host.clientHeight);
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
  });

  // bot: ?bot=ideal runs the ideal line the simulator found, so the whole course can be filmed hands-free
  const botState = { next: 0, caught: null as number | null, bedAt: null as number | null };
  if (params.get('bot') === 'ideal') st.plan = startAt === undefined && course.plan ? course.plan : searchIdealRun(startAt === undefined ? course : { ...course, startX: startAt }).plan;

  if (params.get('bot') === 'shortcut') { const list = course.shortcuts?.length ? course.shortcuts : findShortcutsNow(course); if (list[0]) st.plan = list[0].plan; else st.plan = course.plan ?? searchIdealRun(course).plan; }
  const botMode = params.get('bot') === 'ideal' || params.get('bot') === 'shortcut';
  const viewHooks = (): BoardHooks => createViewHooks(course, () => ghostCtl);
  // CC-108: the courses a run can be published on are the listed ones (src/share/board-courses.ts); the First Course with the timed balls is another course, so it is not one of them
  const rankedKey = (): string | null => { const k = boardKeyOfPage(params); return (k === FIRST_COURSE_KEY && course !== defaultCourse) || courseHash(course) !== loadedHash ? null : k; }; // CC-108: only the official course, exactly, is on a ranked board
  const challengeId = challengeOn(params) ? cidOf(params) : null; // CC-108: a challenge course opened by its id
  const listedKey = (): string | null => rankedKey() ?? (challengeId && courseHash(course) === loadedHash ? challengeKey(challengeId) : null);
  { const bk = listedKey(); if (boardOn(params) && !botMode && bk) { document.body.append(boardCorner(bk, courseHash(course), session(), viewHooks()), newsStrip()); } } // CC-108: the board is on the Course, not only in the end report
  const idealCache = new Map<number, Plan>();
  const guides = new THREE.Group();
  scene.add(guides);
  const diagBox = document.createElement('div');
  diagBox.style.cssText = 'position:fixed;left:16px;top:70px;width:min(460px,90vw);background:#fffffff2;border:1px solid #cfd6d0;border-radius:10px;padding:10px 14px;font:15px/1.4 system-ui,sans-serif;color:#17201d;display:none;box-shadow:0 4px 18px #0002';
  document.body.append(diagBox);
  let prevMode: string = 'run', prevVx = 0;
  let soundCount = 0;
  let soundedEvents: ReturnType<typeof newWorld>['events'] | null = null;
  startAudio(); document.body.append(soundButton());

  const debug = createDebugView(scene, course, document.body, params.get('debug') === '1');
  const grabHint = createGrabHint(scene, course, params.get('grabhint') !== '0');
  const toggleDebug = () => { debug.toggle(); dbgBtn.textContent = debug.shown ? 'Debug: on (B)' : 'Debug (B)'; dbgBtn.blur(); };
  dbgBtn.onclick = toggleDebug;
  const ghostBot = params.get('ghost') === 'bot'; // ?ghost=bot shows the ghost beside the bot too (for the check: the bot on the ideal line stays level with it)
  let ghostCtl: ReturnType<typeof createGhost> | null = null; // the ghost to chase (CC-99), made once the ideal-run search is defined
  const log: GameEvent[] = [];
  const ctx: CourseCtx = { course, st, log, guides, specs, wallNeed, everCleared: false, wallEntry: 0 };
  const stats = createRunStats(ctx, (resume ? resume.retryX : startAt ?? course.startX) > course.startX + 0.01 ? 'practice' : 'attempt');
  const { runLog } = stats;
  // ?hangtest=1.0 (radians) hangs the runner still on the first bar at that angle, for the pivot screenshots
  const hangTest = params.get('hangtest') !== null && course.holds?.length ? Number(params.get('hangtest')) : null;
  // ?planktest=0.5 stands the runner still on the first plank, that share of the way across, for the sag screenshots
  const plankTest = params.get('planktest') !== null && course.planks?.length ? Number(params.get('planktest')) : null;
  if (plankTest !== null) {
    const pk = course.planks![0], a = plankTest * (pk.x1 - pk.x0);
    st.world = { ...st.world, mode: 'plank', plank: { i: 0, v: 0, sagged: true }, runner: { ...st.world.runner, x: pk.x0 + a, y: topAt(pk, a, pk.x0 + a), vx: 0, vy: 0, grounded: true } };
  }
  if (hangTest !== null) {
    const f = feetOf(course.holds![0], { hold: 0, theta: hangTest, omega: 0 });
    st.world = { ...st.world, mode: 'hang', hang: { hold: 0, theta: hangTest, omega: 0 }, runner: { ...st.world.runner, x: f.x, y: f.y, vx: 0, vy: 0, grounded: false } };
  }
  const frames: { x: number; y: number }[] = [];
  const analytics: Analytics = { courseKey: courseKey(course.name), mode: pageQuery().get('mode') ?? 'course', runId: crypto.randomUUID(), failed: false };
  touchStreak(); // CC-108
  if (!resume) trackCourseEvent('start', analytics.courseKey, course.name, analytics.runId, analytics.mode);
  // CC-149: a cleared run on a listed course is offered to the server, which plays the keys again before it counts (a run with anything but plain keys has no log and is not offered)
  let lastClear: BoardHooks['publish'] | null = null;
  function offerClear() {
    lastClear = null;
    const bk = listedKey();
    if (!statsOn(params) || botMode || st.demo || st.idealWhole || !bk) return;
    const mine = ghostCtl?.myRun();
    if (mine) {
      if (boardOn(params)) { rememberBest(bk, courseHash(course), logTicks(mine)); announceBest(); } // every board box redraws Your best now
      const runId = analytics.runId, ticks = logTicks(mine), keysReady = encodeLog(mine);
      void keysReady.then((keys) => sendClear(bk, runId, courseHash(course), keys, ticks)); // counted only; the board gets it when the player clicks Publish (CC-108)
      lastClear = { ticks, send: (nick) => keysReady.then((keys) => publishClear(bk, runId, courseHash(course), keys, ticks, nick)) };
    }
  }
  try { ctx.everCleared = localStorage.getItem('cc.course.cleared') === '1'; } catch { /* keep going */ }
  const zoneAt = (x: number) => course.zones?.find((z) => x >= z.x0 && x < z.x1);
  function clearGuides() {
    while (guides.children.length) { const c = guides.children[0] as THREE.Mesh; guides.remove(c); c.geometry?.dispose(); }
    diagBox.style.display = 'none';
  }
  // Share (CC-128, CC-129): keys fed from a link play the run again; while a clip is made the game is stepped by hand and nothing is counted or heard.
  let feed: { log: InputLog; i: number; left: number } | null = null;
  const fedInput = (): RunnerInput => {
    while (feed && feed.left === 0 && feed.i < feed.log.length) { feed.left = feed.log[feed.i][1]; feed.i++; }
    if (!feed || feed.left === 0) return NO_INPUT;
    feed.left--;
    return inputOfMask(feed.log[feed.i - 1][0]);
  };
  // CC-158: a click outside the end report does what R does (a try again, with the ghost); there is no Close button
  document.addEventListener('pointerdown', (e) => {
    if (panel.style.display === 'none' || !panel.querySelector('#report-actions') || panel.contains(e.target as Node)) return;
    if ((e.target as HTMLElement).closest?.('#sitenav, #courses-btn, #feedback-btn, .gallery')) return; // the top bar and open pop-ups keep their own clicks
    restart();
  });
  function restart(x: number = st.retryX) {
    setMusicScreen('course');
    clearGuides();
    if (!botMode) st.plan = null;
    st.demo = null; st.idealWhole = false; ideal.cancelPending();
    st.world = newWorld(course, x);
    ghostCtl?.begin(x === course.startX && (!botMode || ghostBot), !botMode || ghostBot ? x : null); // a ghost chases a run from the start only; every try keeps its keys, so every try can be a clip (CC-157)
    stats.resetRunStats(x);
    analytics.runId = crypto.randomUUID(); analytics.failed = false;
    if (!st.clip.on) trackCourseEvent('start', analytics.courseKey, course.name, analytics.runId, analytics.mode);
    log.length = 0;
    botState.next = 0; botState.caught = null; botState.bedAt = null;
    st.idealNote = '';
    msg.textContent = '';
    frames.length = 0; st.replay = null; panel.style.display = 'none';
    squashUntil = 0; toastUntil = 0; toast.style.display = 'none'; toasts.clear(); releasedAtX = null; caughtSince.clear();
  }

  const nav = createNav({ course, st, log, specs, msg, facing: () => facing, zoneAt: (x) => zoneAt(x) });
  const { openEditor, openDojo } = nav;
  // The ideal run: the simulator's own best line from standing still at x0. A plan always runs on to the finish, so
  // "this obstacle" only stops it at the end of the zone (demo) and "the whole course" lets it run (Shift+I).
  // Shortcuts: routes the designer did not plan (src/sim/shortcuts.ts). Stored with a demo course, or worked out on first request in a worker.
  const shortcutList = createShortcutList(course);
  const ideal = createIdealRun({ course, st, log, frames, botState, panel, runSearch, shortcutList, idealCache, botMode: () => botMode, clearGuides: () => clearGuides(), restart: () => restart() });
  const fall = createFall({ ctx, params, panel, diagBox, frames, hazard, analytics, stats, runLog, fallLog, ideal, nav, botMode, zoneAt: (x) => zoneAt(x), hardBand, addHardest, choice: () => wear.choice(), ghostCtl: () => ghostCtl, makeClip: (l, t, f) => makeClip(l, t, f), restart: (x) => restart(x), onboarding: () => onboarding });
  const { onFall, showAgain } = fall;

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
  const hintFor = createHint(ctx, { toastDrums: toastDrumsNow, shotPreview });

  ghostCtl = mountCourseGhost({ scene, course, params, idealCache, runSearch, progressZones, strip, look: () => wear.choice() });
  ghostCtl.begin(!resume && startAt === undefined && (!botMode || ghostBot), (!botMode || ghostBot) && !resume?.world ? (resume ? resume.retryX : startAt ?? course.startX) : null);
  // A run played again to make a clip (CC-129): see course/clip.ts
  const makeClip = createClipMaker({ renderer, camera, course, st, restart: (x) => restart(x), frame, timeScale: Number(params.get('timescale') ?? 1), setFeed: (f) => { feed = f; } });
  // A challenge link (CC-128): the sender's keys are played in the simulator, and that run becomes the ghost to beat.
  const copyHere = async () => { // the link of this page, so a phone can send it to a computer
    const btn = [...document.querySelectorAll<HTMLButtonElement>('#challenge-banner button')].find((x) => /Copy link|Link copied|Link ready/.test(x.textContent ?? ''));
    try { await navigator.clipboard.writeText(location.href); if (btn) btn.textContent = 'Link copied'; }
    catch { window.prompt('Copy this link', location.href); if (btn) btn.textContent = 'Link ready'; }
  };
  const challengeParam = shareOn(params) && !botMode && params.get('challenge') !== '0' ? params.get('challenge') : null; // ?challenge=0 is the switch for challenge courses, not a link (CC-108)
  if (challengeParam && isOldLongLink(params)) showBanner(OLD_LINK_WORDS, [], 20000); // CC-219: only short links are made and opened; an old long address says so in one line
  else if (challengeParam) {
    void openChallenge(course, challengeParam).then((c) => {
      if (document.documentElement.dataset.madeRefused) { showBanner(challengeWords('too-big'), [], 20000); return; } // the course in the link could not be opened (CC-136)
      if (!c.ok) {
        const offer = offersIdeal(c.why) && ghostCtl ? [{ label: 'Chase the ideal run instead', go: () => { ghostCtl?.chaseIdeal(); document.getElementById('challenge-banner')?.remove(); } }] : [];
        showBanner(challengeWords(c.why), offer, 20000);
        return;
      }
      ghostCtl?.setFriend(c.track, c.nick, lookOfParam(params.get('rk')), c.start > 0 ? startXOf(course, c.start) : null);
      if (c.start > 0 && !resume) { st.retryX = startXOf(course, c.start); restart(st.retryX); } // CC-242: begin where the friend began, standing still, so both bodies start together
      if (phoneMode(params, browserPointing) && !touchControls) {
        // A phone has no keys (CC-138): the page plays the friend's run by itself and says how to play it for real.
        st.keysOpen = false; st.keysTouched = true; paintKeys(false); st.frontOverride = false; // the small corner view would hide the runner on a narrow screen
        showBanner(PHONE_WORDS(secondsWords(c.ticks)), [{ label: 'Copy link', go: () => void copyHere() }], 0);
        st.phoneWatch = c.log; feed = { log: c.log, i: 0, left: 0 };
        return;
      }
      if (c.kind === 'fell') { // CC-181: a try that did not finish: a ghost that falls where the player fell; nothing is sent anywhere
        const at = c.track.xs[c.track.ticks].toFixed(0);
        showBanner(`${c.nick ? `${c.nick} fell` : 'A friend fell'} ${at} m along the course. Can you get further?`, [{ label: 'Download video of this try', go: () => void makeClip(c.log, c.ticks) }]);
        if (params.get('autoplay') === '1') feed = { log: c.log, i: 0, left: 0 };
        return;
      }
      showBanner(c.nick ? `Beat ${c.nick}: ${secondsWords(c.ticks)}` : `Beat this time: ${secondsWords(c.ticks)}`, [{ label: 'Download video of this run', go: () => void makeClip(c.log, c.ticks) }]);
      if (params.get('autoplay') === '1') feed = { log: c.log, i: 0, left: 0 }; // for the browser check: play the friend's keys as if by hand
      if (params.get('clip') === 'auto') void makeClip(c.log, c.ticks);
    });
  }
  st.last = performance.now();
  let studioHold = false; // the Graph Studio has the clock stopped (not the Dojo's "press any key" pause)
  // Graph Studio (CC-86): Tab pauses the Course and opens the ground as a graph to drag; "Play from here" carries on with the edited course
  if (!botMode) installGraphStudio({ env: () => ({ course, retryX: st.retryX, facing, falls: st.falls, runnerX: st.world.runner.x }), pause: () => { studioHold = true; st.paused = true; }, resume: () => { studioHold = false; st.paused = false; st.last = performance.now(); st.keys.clear(); }, chipWhen: () => st.falls > 0 || params.get('edit') === '1' });
  { let heldBefore = false; window.addEventListener(GALLERY_EVENT, (ev) => { if ((ev as CustomEvent).detail.open) { heldBefore = st.paused; st.paused = true; st.keys.clear(); } else { st.paused = heldBefore; st.last = performance.now(); } }); } // the Courses gallery stops the game while it is open
  if (!botMode || params.get('next') === '1') onboarding = startOnboarding({ params, store: browserStore, course, tour: tour === 'tour', resetRun: () => { if (st.world.outcome === 'running' && Math.abs(st.world.runner.x - course.startX) < 0.01) restart(course.startX); }, openCourses: () => courseButton.open(), toggleKeys: () => { st.keysTouched = true; st.keysOpen = !st.keysOpen; paintKeys(st.keysOpen); } }); // CC-100: the Help chip, and the tour on a first visit
    // ?camprobe=1: what the camera and the runner's look are doing now, for scripts/course-camera-characterize.mjs (CC-133); nothing else changes
  if (params.get('camprobe') === '1') (window as unknown as { __probe: () => unknown }).__probe = () => {
    const d = camera.getWorldDirection(new THREE.Vector3());
    return { pos: camera.position.toArray(), dir: d.toArray(), up: camera.up.toArray(), fov: camera.fov, aspect: camera.aspect, camMode: cam.mode(), orbit: { ...cam.orbit }, actor: actor ? actor.object.visible : null, body: body.visible, ...wear.state(), clipping: st.clip.on, pip: cam.pipFrame.style.display, frontCam: frontCam.position.toArray(), frontDir: frontCam.getWorldDirection(new THREE.Vector3()).toArray() };
  };
  // ?fx=bloom,vignette,dof (or all): picture polish for stills (CC-188); off unless asked, loaded only then
  let fxPipe: { render(): void } | null = null;
  if (pageQuery().get('fx')) void import('../render/fx').then((m) => { const on = m.fxOf(pageSearch()); if (on.size) fxPipe = m.createFx(renderer as any, scene, camera, on, () => camera.position.distanceTo(body.position)); });
  // ?trail=1: a light trail behind the runner for film shots (CC-209); loaded only then
  let trailPush: ((x: number, y: number) => void) | null = null;
  if (pageQuery().get('trail') === '1') void import('../render/trail').then((m) => { trailPush = m.createTrail(scene).push; });
  let lastPlankNow = 0; // the clock of the last plank step
  const timeScale = Number(params.get('timescale') ?? 1); // ?timescale=0.1 runs the game at a tenth of its speed (for stills)
  function frame(now: number, stepped = false) {
    if (cam.filmShot) now = performance.now(); // a film runs the game on the stepped film clock; the real animation-frame time would let the run race ahead at the speed the machine draws
    if (st.clip.on && !stepped) return; // the clip drives the game by hand; the loop starts again when it ends
    perf.frame(now);
    st.acc = st.paused ? 0 : Math.min(st.acc + ((now - st.last) / 1000) * timeScale, 0.25);
    st.last = now;
    while (st.acc >= DT) {
      st.acc -= DT;
      let input: RunnerInput = NO_INPUT;
      if (feed) { input = fedInput(); if (!st.clip.on && st.world.outcome === 'running') ghostCtl?.input(input); }
      else if (st.plan) input = inputFor(st.plan, st.world, botState, course);
      else {
        input = { run: st.keys.has('ArrowRight') || st.keys.has('KeyD'), left: st.keys.has('ArrowLeft') || st.keys.has('KeyA'), jump: st.jumpQueued, jumpSpeed: 0, squat: st.keys.has('ArrowDown') || st.keys.has('KeyS'), handL: st.keys.has('KeyE'), handR: st.keys.has('KeyE'), vault: st.vaultQueued, roll: st.rollQueued || st.keys.has('KeyX'), slide: st.slideQueued, fire: st.fireQueued, aimUp: st.keys.has('ArrowUp') || st.keys.has('KeyW'), aimDown: st.keys.has('ArrowDown') || st.keys.has('KeyS'), up: st.keys.has('ArrowUp') || st.keys.has('KeyW') };
        if (st.world.outcome === 'running') ghostCtl?.input(input);
        st.jumpQueued = false; st.vaultQueued = false; st.rollQueued = false; st.slideQueued = false; st.fireQueued = false;
      }
      const prev = st.world.outcome;
      noteRunning(prev === 'running' && (Math.abs(st.world.runner.vx) > 0.3 || st.world.mode !== 'run')); // CC-feedback: the Feedback button hides during a run
      prevMode = st.world.mode; prevVx = st.world.runner.vx;
      perf.simStart();
      if (hangTest === null && plankTest === null) st.world = stepWorld(st.world, input, course);
      perf.simEnd();
      stats.updateRunProgress(st.world.runner.x);
      stats.updateFlow(st.world.runner.tick, st.world.runner.vx, st.world.runner.vy);
      logTick(runLog, st.world);
      if (prevMode === 'run' && st.world.mode === 'wall') ctx.wallEntry = prevVx;
      if (st.demo && (st.world.outcome !== 'running' || st.world.runner.x > st.demo.x1)) ideal.demoEnd();
      else if (st.idealWhole && st.world.outcome !== 'running') ideal.demoEnd();
      log.push(...st.world.events);
      if (st.world.events !== soundedEvents) { soundedEvents = st.world.events; if (!st.replay && !st.clip.on) soundsFor(st.world.events, hazard); } // after the end the same events array stays: it sounds once
      for (const e of st.world.events) {
        if (e.type === 'drone-board') { say('The drone lifts you. Lean with ← →, climb with ↑ and come down with ↓.', 240); }
        if (e.type === 'drone-empty') { say('The battery ran out: the rotors stopped and the drone is falling.', 240); }
        if (e.type === 'drone-land') { say('The drone sets you down.', 150); }
        if (e.type === 'recoil') { say(`Shot! The ball flies back and you are pushed forward by ${(e.detail?.dvx as number).toFixed(1)} m/s${(e.detail?.dvy as number) > 0.5 ? ` and up by ${(e.detail?.dvy as number).toFixed(1)} m/s` : ''}.`, 180); }
        if (e.type === 'band-snap') { say(`The band snapped at ${(e.detail?.stretch as number).toFixed(0)} m: it can only stretch so far. Press R and turn round sooner.`, 360); }
        if (e.type === 'band-release') { say(`The band lets go: you leave it at ${(e.detail?.vx as number).toFixed(1)} m/s.`, 180); }
        if (e.type === 'launch-dud') { say('The counterweight is too light: the arm hardly moves. Try a heavier weight.', 240); }
        if (e.type === 'hang-release') { releasedAtX = st.world.runner.x; caughtSince.clear(); }
        if (e.type === 'hang-catch') caughtSince.add(e.detail?.hold as number);
        if (e.type === 'land' && releasedAtX !== null) { // a bar flown over between the release and the landing, never held: a fact, not a grade
          const skipped = (course.holds ?? []).map((h, k) => ({ h, k })).filter(({ h, k }) => !caughtSince.has(k) && h.x > releasedAtX! + 0.5 && h.x < st.world.runner.x - 0.3);
          if (skipped.length) { say(`You skipped the ${skipped.map(({ k }) => barName(k)).join(' and the ')}.`, 150); }
          releasedAtX = null;
        }
        if (e.type === 'jump' && st.keysOpen && !st.keysTouched) { st.keysOpen = false; paintKeys(false); } // the controls card has done its job once you have jumped
        if (e.type === 'hang-release' && e.detail?.slipped) { say('Your grip gave out: the bar pulled harder than your hands could hold.', 120); }
        if (e.type === 'land' && !e.detail?.bouncy) {
          const o = ouch(e.detail?.peakDecel as number);
          stats.noteLanding(o, !!e.detail?.squat);
        }
        if (e.type === 'land' && (e.detail?.impact as number) > 2 && !e.detail?.bouncy) {
          const o = ouch(e.detail?.peakDecel as number);
          squashUntil = st.world.runner.tick + 40; squashDepth = e.detail?.squat ? 0.7 : o >= 6 ? 0.6 : 0.88;
          if (o >= 3 && (toastsOld ? toastUntil - st.world.runner.tick : toasts.remaining(st.world.runner.tick)) < 100) { // (a fresh 'You skipped the bar' stays)
            say(o >= 8 ? 'Ouch! Dangerous landing: bend your knees (↓) on big drops.' : o >= 6 ? 'Hard landing: you stumble. Hold ↓ to bend your knees.' : 'Firm landing.', 90);
          }
        }
      }
      if (st.replay === null && prev === 'running') frames.push({ x: st.world.runner.x, y: st.world.runner.y });
      if (frames.length > 1200) frames.shift();
      if (prev === 'running' && st.world.outcome === 'splash') onFall('splash');
      if (prev === 'running' && st.world.outcome === 'hurt') onFall('hurt');
      if (prev === 'running' && st.world.outcome === 'stalled') onFall('stall');
      if (st.world.events.some((e) => e.type === 'wall-slide')) { // CC-182: missing the top is not a fall: the body slides to the foot and the run goes on, run up again as often as you like
        say([...log].some((e) => e.type === 'wall-no-grip') ? 'Your hands missed the edge. Run up again and hold E near the top.' : 'Not high enough. Run up again with more speed.', 240);
      }
      if (st.phoneWatch && prev === 'running' && st.world.outcome === 'cleared') { // the friend's run, watched on a phone: no report, no What next card; play it again in a moment (CC-138)
        const again = st.phoneWatch;
        setTimeout(() => { if (again) { restart(course.startX); feed = { log: again, i: 0, left: 0 }; } }, 2500);
      } else if (prev === 'running' && st.world.outcome === 'cleared' && !st.clip.on) {
        stats.clearFinishZone(st.world.runner.x); ctx.everCleared = true; track('clears'); stats.finishRun(true, analytics.runId); trackCourseEvent('success', analytics.courseKey, course.name, analytics.runId, analytics.mode);
        offerClear();
        try { localStorage.setItem('cc.course.cleared', '1'); } catch { /* ok */ }
        panel.innerHTML = ''; panel.style.display = 'grid';
        showClearedReport({
          course, params, panel, runLog, hardBand, addHardest, listedKey, viewHooks, clearedNote: ideal.clearedNote,
          get world() { return st.world; }, get runKind() { return stats.kind; }, get ghostCtl() { return ghostCtl; }, get lastClear() { return lastClear; },
          get demo() { return st.demo; }, botMode, get idealWhole() { return st.idealWhole; }, loadedIsDefault, get analyticsRunId() { return analytics.runId; },
          get onboarding() { return onboarding; }, get choice() { return wear.choice(); },
          restart: (x) => restart(x), startIdeal: (x0, z) => ideal.startIdeal(x0, z), openDojo: () => openDojo(), makeClip: (l, t, f) => makeClip(l, t, f),
        });
      }
    }
    let r = st.world.runner;
    if (st.replay) {
      const f = frames[Math.floor(st.replay.i)];
      st.replay.i += 0.5;
      if (st.replay.i >= st.replay.to || !f) { st.replay = null; clearGuides(); if (st.world.outcome !== 'running') showAgain(); } else r = { ...r, x: f.x, y: f.y };
    }
    const dtPlank = Math.min(0.05, Math.max(0, now - lastPlankNow) / 1000 * (st.paused ? 0 : timeScale)); lastPlankNow = now;
    plankView?.place(st.world, dtPlank);
    const plankY = st.replay ? null : plankView?.surfaceAt(st.world) ?? null; // the picture of the bend lags the physics a little: the feet stand on the drawn surface so they agree
    if (plankY !== null) r = { ...r, y: plankY };
    const sq = st.world.runner.tick < squashUntil ? squashDepth : 1;
    body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    body.position.set(r.x, r.y + 0.85 * sq, 0);
    trailPush?.(r.x, r.y + 0.95 * sq);
    ghostCtl?.frame({ tick: st.world.runner.tick, x: st.world.runner.x, active: (!st.plan || ghostBot) && !st.demo && !st.idealWhole && !st.replay && !st.clip.on, firstPerson: cam.mode() === 'first' });
    const facingSpeed = st.world.mode === 'cart' && st.world.cart ? st.world.cart.v : st.world.runner.vx;
    if (Math.abs(facingSpeed) > 0.3 && st.world.mode !== 'hang') facing = facingSpeed < 0 ? -1 : 1; // on a bar the body keeps facing one way, whichever way it swings
    // on a bar the actor is turned about its hands, so it is placed with the hands on the bar (feet straight below it before the turn), like the rope
    const hangHold = st.world.mode === 'hang' && st.world.hang ? course.holds?.[st.world.hang.hold] : undefined;
    const hOff = hangHold && st.world.hang ? handOffset(st.world.hang) : { x: 0, y: 0 }; // the hands ease onto the bar over a few ticks after a catch
    const ax = hangHold ? hangHold.x + hOff.x : r.x, ay = hangHold ? hangHold.y + hOff.y - DEFAULT_HANG.handHeight : r.y;
    if (actor) actor.update({ ...actorStateFor(st.world, st.keys.has('ArrowDown') || st.keys.has('KeyS'), facing), x: ax, y: ay, ledge: st.world.mode === 'climb' && st.world.climb ? { x: st.world.climb.edge, y: st.world.climb.top } : ledge, next: st.world.mode === 'run' ? nextObstacle(r.x) : undefined });
    trackView?.place(st.world);
    if (st.world.runner.tick > toastUntil) toast.style.display = 'none';
    toasts.update(st.world.runner.tick);
    paintStrip(r.x);
    drumLane.update(r.x);
    debug.update(st.world);
    grabHint.update(st.world, st.keys.has('KeyE'), performance.now());
    if (params.get('check') === '1' && actor && ledge && st.world.mode === 'wall') {
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
      actor.joints().forEach((j, i) => { const o = hit(j.x, j.y, 0); if (o && Math.hypot(o.dx, o.dy) > maxPen) { maxPen = Math.hypot(o.dx, o.dy); document.documentElement.dataset.maxPenWhere = `${st.world.mode} x=${r.x.toFixed(1)} y=${r.y.toFixed(1)} joint=${i} at (${j.x.toFixed(2)}, ${j.y.toFixed(2)})`; } });
      document.documentElement.dataset.maxPen = maxPen.toFixed(3);
    }
    trebView?.update(st.world);
    shotsView?.update(st.world);
    poleView?.update(st.world);
    recoilView?.update(st.world, facing, shotPreview(st.world)?.path);
    bandView?.update(st.world);
    droneView?.update(st.world, facing);
    const reportOpen = panel.style.display !== 'none'; // CC-191: while a report is open the hint, the controls card, the ghost chip and the second Edit button step aside
    hint.textContent = reportOpen ? '' : hintFor(st.world);
    hint.style.display = hint.textContent ? 'block' : 'none';
    if (reportOpen !== reportWas) { reportWas = reportOpen; if (reportOpen) help.style.visibility = 'hidden'; else if (!document.getElementById('helpmenu')) help.style.visibility = ''; rowBtns.style.visibility = reportOpen ? 'hidden' : ''; const gh = document.getElementById('ghost-hud'); if (gh) gh.style.visibility = reportOpen ? 'hidden' : ''; }
    if (ropeMesh && course.rope) {
      // the rope swings about its anchor with the runner: its middle is half a rope length along the swing
      const th = st.world.swing ? st.world.swing.theta : 0;
      ropeMesh.rotation.z = th;
      ropeMesh.position.set(course.rope.anchorX + (ropeLen / 2) * Math.sin(th), course.rope.anchorY - (ropeLen / 2) * Math.cos(th), 0);
      ropeMesh.updateMatrix(); ropeMesh.updateMatrixWorld(true);
    }
    msg.textContent = st.paused && !studioHold ? 'Back from the Dojo. Press any key to carry on.' : st.world.outcome === 'cleared' ? MESSAGES.cleared : st.idealNote;
    msg.style.display = msg.textContent ? 'block' : 'none'; // CC-166: an empty message used to leave its dark panel, a black pill, in the middle of the screen
    const onCoaster = st.world.mode === 'cart' && st.world.cart !== null;
    const spd = onCoaster ? Math.abs(st.world.cart!.v) : Math.abs(r.vx);
    const gaugeMax = onCoaster ? 40 : GAUGE_MAX;
    const nextGap = specs.find((g) => g.x + 0.2 >= r.x && g.x - r.x < 40 && ['gap', 'landing'].includes(zoneOf(g.x)?.id ?? ''));
    let need = 0, msgNext = '';
    if (nextGap && st.world.mode === 'run') { need = nextGap.needed; msgNext = `Next gap: ${nextGap.width.toFixed(1)} m wide. You need at least ${need.toFixed(1)} m/s at the edge.`; }
    else if (course.wall && st.world.mode === 'run' && r.x < course.wall.x0 && course.wall.x0 - r.x < 45) { need = wallNeed; msgNext = `Warped wall: ${(course.wall.height ?? DEFAULT_WALL.height).toFixed(1)} m high. You need at least ${need.toFixed(1)} m/s at its foot.`; }
    speedGauge.set({ text: `${onCoaster ? 'Speed along track' : 'Speed'} ${spd.toFixed(1)} m/s`, max: gaugeMax, value: spd, mark: need, colour: need && spd < need ? '#c4572a' : '#0f6b5c', note: msgNext });
    if (batteryGauge) { // before boarding there is no drone state yet: the battery is full
      const full = droneParams(course).battery * 3600;
      const left = st.world.drone ? (st.world.drone.empty ? 0 : Math.max(0, Math.min(1, st.world.drone.energy / full))) : 1;
      const pct = Math.round(100 * left);
      batteryGauge.set({ text: st.world.drone?.empty ? 'Drone battery empty' : `Drone battery ${pct}%`, max: 1, value: left, colour: pct <= 20 ? '#c4572a' : '#2a6fb0' });
    }
    hud.textContent = `Time ${(r.tick / 120).toFixed(1)} s   ·   ${Math.max(0, Math.round(r.x))} m of ${course.finishX} m`;
    livePhotos?.update(r.x);
    cam.update(); // the camera (and the film camera) for this picture
    floor.update(now / 1000);
    if (chunks.length > 8) cullFar(chunks, camera.position, 260); // far chunks of a big place are not drawn
    perf.renderStart();
    if (fxPipe) fxPipe.render(); else renderer.render(scene, camera);
    st.clip.hook?.(); // the clip takes this picture before the front inset is drawn over it
    perf.renderEnd();
    cam.drawFront();
    document.documentElement.dataset.tick = String(r.tick);
    document.documentElement.dataset.vault = st.world.mode === 'vault' && st.world.vault ? (st.world.vault.i / st.world.vault.n).toFixed(3) : ''; document.documentElement.dataset.climb = st.world.mode === 'climb' && st.world.climb ? (st.world.climb.i / st.world.climb.n).toFixed(3) : ''; document.documentElement.dataset.x = r.x.toFixed(2); document.documentElement.dataset.omega = (st.world.hang?.omega ?? 0).toFixed(3); document.documentElement.dataset.grounded = st.world.runner.grounded ? '1' : '0'; // for the keyboard check
    document.documentElement.dataset.outcome = st.world.outcome;
    if (playedSounds().length !== soundCount) { soundCount = playedSounds().length; document.documentElement.dataset.sounds = playedSounds().join(','); } // for the bot check: headless cannot be heard
    document.documentElement.dataset.mode = st.world.mode;
    if (!st.clip.on) requestAnimationFrame(frame);
  }
  const perf = createPerf({ label: 'Course', backend: (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2', renderer: renderer as unknown as PerfSource['renderer'], scene });
  requestAnimationFrame(frame);

  const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';
  return { backend, world: () => st.world, restart };
}
