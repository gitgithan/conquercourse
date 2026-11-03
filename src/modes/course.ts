import { backgroundOn, savedBackground } from '../ui/background';
import { createKeydown, isTyping } from './course/keydown';
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
import { createFeed } from './course/feed';
import { createSay } from './course/say';
import { createStepEvents } from './course/events';
import { createOutcome } from './course/outcome';
import { createGaugeUpdate } from './course/gauges';
import { createViews } from './course/views';
import { mountProbes, poseForShots } from './course/probes';
import { mountChrome } from './course/chrome';
import { openChallengeLink } from './course/challenge';
import { createShortcutList } from './course/shortcuts';
import { addLabels, buildCourseScene } from './course/scene';
import { createViewHooks } from './course/board';
import { mountDrums } from './course/drums';
import { mountCourseGhost } from './course/ghost';
import { setMusicScreen } from '../ui/music';
import { playedSounds, soundButton, startAudio } from '../ui/audio';
import * as THREE from 'three/webgpu';
import courseJson from '../course/default-course.json';
import type { CourseData } from '../course/course';
import { NO_INPUT, type RunnerInput } from '../sim/runner';
import { DT } from '../sim/units';
import { newWorld, stepWorld, type GameEvent, type WorldState } from '../sim/world';
import { DEFAULT_WALL } from '../sim/wall';
import { inputFor, searchIdealRun, type Plan } from '../sim/ideal';
import { createGhost } from '../ui/ghost';
import { clipLayoutFor } from '../share/clip';
import { mountTouch, touchOn } from '../share/touch';
import { browserPointing } from '../share/phone';
import { courseHash } from '../sim/replay';
import { findShortcuts, type Shortcut } from '../sim/shortcuts';
const findShortcutsNow = (c: CourseData): Shortcut[] => findShortcuts(c, { moveChoices: false }).shortcuts; // ?bot=shortcut only: blocks the page while it searches
import { gapSpecs, minSpeedForWall } from '../sim/needs';
import { noteRunning } from '../ui/feedback-model';
import { trackCourseEvent, courseKey, session } from '../ui/feedback';
import { boardKeyOfPage, FIRST_COURSE_KEY } from '../share/board-courses';
import { challengeKey, challengeOn, cidOf } from '../share/challenge-course';
import { touchStreak } from '../ui/streak';
import { boardCorner, boardOn, newsStrip, type BoardHooks } from '../ui/leaderboard';
import { createRookieActor } from '../render/actor';
import { DEFAULT_HANG, handOffset } from '../sim/holds';
import { pivotOf } from '../sim/bars';
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
import { ballsOn, BALL_LAUNCHERS } from '../sim/shots';
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
  const built = buildCourseScene(scene, course, params);
  const { trackView, plankView, hazard, floor, chunks, ropeLen } = built;
  const views = createViews(course, built);
  const shotPreview = views.shotPreview;

  // the runner (a capsule until the Rookie is wired in)
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.1, 6, 12), new THREE.MeshStandardMaterial({ color: 0xf07b1d }));
  scene.add(body);
  bodyMesh = body;
  // the real Rookie replaces the capsule when its model loads; the capsule stays as the fallback
  const wear = createRunnerLook({ scene, course, params, body, setActor: (a) => { actor = a; }, actor: () => actor });
  await wear.start();

  // HUD
  const hudParts = createHud({ course, defaultCourse, params, st, paintBackground, openDojo: () => openDojo(), openEditor: (i) => openEditor(i), showIdeal: (z) => ideal.showIdeal(z), showWholeIdeal: () => ideal.showWholeIdeal(), zoneAt: (x) => zoneAt(x) });
  const { VIEW_KEYS, paintStrip, gaugeStack, msg, help, panel, hint, rowBtns, paintKeys, strip, progressZones, fallLog, hardBand, addHardest } = hudParts;
  let reportWas = false;
  const nextCam = cam.nextCam;
  const { courseButton, tour } = createWelcome({ course, params, resume: !!resume });
  let onboarding: Pick<Onboarding, 'onCleared' | 'onFall'> = { onCleared() {}, onFall() {} };
  // The drum lane is on by default wherever the course has a planned player route; a coaster is mostly passive cart motion.
  const forceDrums = params.get('drums') === '1';
  const runSearch = createSearch(params);
  const { drumLane, toastDrums: toastDrumsNow } = mountDrums({ course, params, forceDrums, runSearch });
  const { dbgBtn } = mountChrome({ params, hud: hudParts, pick: wear.pick, camButton: cam.button, restart: () => restart() });
  // CC-85: a real place shows its real photos (credit under each, a large view on click); ?photos=0 or the Hide switch turns them off
  const placeSlug = slugOfCourse(course.name);
  let livePhotos: { update(x: number): void } | null = null; // CC-90: street photos from the allow-list change as the runner moves; the CC-85 strip is the fallback
  if (placeSlug && pageQuery().get('photos') !== '0') void mountLivePhotos(document.body, course).then((h) => { livePhotos = h; });
  if (placeSlug && FURNITURE_ON(pageQuery())) void mountFurniture(scene, course); // CC-187: real street furniture, looks only, off by default
  { const bd = params.get('backdrop'); if (bd) void mountBackdrop(scene, course, bd); } // CC-234: the place's buildings and street furniture behind the hero lane, looks only, off by default
  const sayer = createSay(params, st);
  const say = sayer.say;
  sayNow = say;
  try { localStorage.setItem('cc.course', JSON.stringify(course)); } catch { /* the Dojo falls back to the default course */ }
  const specs = gapSpecs(course);
  const zoneOf = (x: number) => course.zones?.find((z) => x >= z.x0 && x < z.x1);
  const wallNeed = course.wall ? minSpeedForWall(course.wall) : Infinity;
  addLabels(course, specs, zoneOf, ropeLen);

  // input
  addEventListener('keydown', createKeydown({
    st, typing: isTyping, course, VIEW_KEYS,
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
  const events = createStepEvents(ctx, { say: sayer, stats, hazard, paintKeys });
  const posed = poseForShots(course, params, st); // ?hangtest and ?planktest hold the runner still for the pivot and sag screenshots
  const frames: { x: number; y: number }[] = [];
  const analytics: Analytics = { courseKey: courseKey(course.name), mode: pageQuery().get('mode') ?? 'course', runId: crypto.randomUUID(), failed: false };
  touchStreak(); // CC-108
  if (!resume) trackCourseEvent('start', analytics.courseKey, course.name, analytics.runId, analytics.mode);
  try { ctx.everCleared = localStorage.getItem('cc.course.cleared') === '1'; } catch { /* keep going */ }
  const zoneAt = zoneOf;
  function clearGuides() {
    while (guides.children.length) { const c = guides.children[0] as THREE.Mesh; guides.remove(c); c.geometry?.dispose(); }
    diagBox.style.display = 'none';
  }
  const feed = createFeed();
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
    events.reset(); sayer.clear();
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
  const outcome = createOutcome(ctx, { params, panel, say: sayer, stats, analytics, runLog, hardBand, addHardest, listedKey, viewHooks, ideal, feed, loadedIsDefault, botMode, onFall, ghostCtl: () => ghostCtl, onboarding: () => onboarding, choice: () => wear.choice(), restart: (x) => restart(x), openDojo: () => openDojo(), makeClip: (l, t, f) => makeClip(l, t, f) });
  const updateGauges = createGaugeUpdate(ctx, hudParts, zoneOf);

  // Controls are taught while you play: one short hint at a time, then none.
  // what the Rookie needs to know about the course: where the top edge of the wall is, and the next obstacle ahead
  const wallR = course.wall ? course.wall.radius ?? course.wall.height ?? DEFAULT_WALL.height : 0;
  const ledge = course.wall ? { x: course.wall.x0 + wallR, y: course.wall.height ?? DEFAULT_WALL.height } : undefined;
  const measure = mountProbes({ course, params, st, camera, frontCam, renderer, cam, body, wear, actor: () => actor, ledge });
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
  const hintFor = createHint(ctx, { toastDrums: toastDrumsNow, shotPreview });

  ghostCtl = mountCourseGhost({ scene, course, params, idealCache, runSearch, progressZones, strip, look: () => wear.choice() });
  ghostCtl.begin(!resume && startAt === undefined && (!botMode || ghostBot), (!botMode || ghostBot) && !resume?.world ? (resume ? resume.retryX : startAt ?? course.startX) : null);
  // A run played again to make a clip (CC-129): see course/clip.ts
  const makeClip = createClipMaker({ renderer, camera, course, st, restart: (x) => restart(x), frame, timeScale: Number(params.get('timescale') ?? 1), setFeed: feed.set });
  openChallengeLink({ course, params, st, resume: !!resume, touchControls, botMode, feed, ghostCtl: () => ghostCtl, restart: (x) => restart(x), paintKeys, makeClip: (l, t, f) => makeClip(l, t, f) });
  st.last = performance.now();
  let studioHold = false; // the Graph Studio has the clock stopped (not the Dojo's "press any key" pause)
  // Graph Studio (CC-86): Tab pauses the Course and opens the ground as a graph to drag; "Play from here" carries on with the edited course
  if (!botMode) installGraphStudio({ env: () => ({ course, retryX: st.retryX, facing, falls: st.falls, runnerX: st.world.runner.x }), pause: () => { studioHold = true; st.paused = true; }, resume: () => { studioHold = false; st.paused = false; st.last = performance.now(); st.keys.clear(); }, chipWhen: () => st.falls > 0 || params.get('edit') === '1' });
  { let heldBefore = false; window.addEventListener(GALLERY_EVENT, (ev) => { if ((ev as CustomEvent).detail.open) { heldBefore = st.paused; st.paused = true; st.keys.clear(); } else { st.paused = heldBefore; st.last = performance.now(); } }); } // the Courses gallery stops the game while it is open
  if (!botMode || params.get('next') === '1') onboarding = startOnboarding({ params, store: browserStore, course, tour: tour === 'tour', resetRun: () => { if (st.world.outcome === 'running' && Math.abs(st.world.runner.x - course.startX) < 0.01) restart(course.startX); }, openCourses: () => courseButton.open(), toggleKeys: () => { st.keysTouched = true; st.keysOpen = !st.keysOpen; paintKeys(st.keysOpen); } }); // CC-100: the Help chip, and the tour on a first visit
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
      if (feed.active()) { input = feed.input(); if (!st.clip.on && st.world.outcome === 'running') ghostCtl?.input(input); }
      else if (st.plan) input = inputFor(st.plan, st.world, botState, course);
      else {
        input = { run: st.keys.has('ArrowRight') || st.keys.has('KeyD'), left: st.keys.has('ArrowLeft') || st.keys.has('KeyA'), jump: st.jumpQueued, jumpSpeed: 0, squat: st.keys.has('ArrowDown') || st.keys.has('KeyS'), handL: st.keys.has('KeyE'), handR: st.keys.has('KeyE'), reachL: st.keys.has('KeyQ'), reachR: st.keys.has('KeyT'), vault: st.vaultQueued, roll: st.rollQueued || st.keys.has('KeyX'), slide: st.slideQueued, fire: st.fireQueued, aimUp: st.keys.has('ArrowUp') || st.keys.has('KeyW'), aimDown: st.keys.has('ArrowDown') || st.keys.has('KeyS'), up: st.keys.has('ArrowUp') || st.keys.has('KeyW') };
        if (st.world.outcome === 'running') ghostCtl?.input(input);
        st.jumpQueued = false; st.vaultQueued = false; st.rollQueued = false; st.slideQueued = false; st.fireQueued = false;
      }
      const prev = st.world.outcome;
      noteRunning(prev === 'running' && (Math.abs(st.world.runner.vx) > 0.3 || st.world.mode !== 'run')); // CC-feedback: the Feedback button hides during a run
      prevMode = st.world.mode; prevVx = st.world.runner.vx;
      perf.simStart();
      if (!posed) st.world = stepWorld(st.world, input, course);
      perf.simEnd();
      stats.updateRunProgress(st.world.runner.x);
      stats.updateFlow(st.world.runner.tick, st.world.runner.vx, st.world.runner.vy);
      logTick(runLog, st.world);
      if (prevMode === 'run' && st.world.mode === 'wall') ctx.wallEntry = prevVx;
      if (st.demo && (st.world.outcome !== 'running' || st.world.runner.x > st.demo.x1)) ideal.demoEnd();
      else if (st.idealWhole && st.world.outcome !== 'running') ideal.demoEnd();
      log.push(...st.world.events);
      events.handle();
      if (st.replay === null && prev === 'running') frames.push({ x: st.world.runner.x, y: st.world.runner.y });
      if (frames.length > 1200) frames.shift();
      outcome(prev);
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
    const sq = events.squash();
    body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    body.position.set(r.x, r.y + 0.85 * sq, 0);
    trailPush?.(r.x, r.y + 0.95 * sq);
    ghostCtl?.frame({ tick: st.world.runner.tick, x: st.world.runner.x, active: (!st.plan || ghostBot) && !st.demo && !st.idealWhole && !st.replay && !st.clip.on, firstPerson: cam.mode() === 'first' });
    const facingSpeed = st.world.mode === 'cart' && st.world.cart ? st.world.cart.v : st.world.runner.vx;
    if (Math.abs(facingSpeed) > 0.3 && st.world.mode !== 'hang' && st.world.mode !== 'bars') facing = facingSpeed < 0 ? -1 : 1; // on a bar the body keeps facing one way, whichever way it swings
    // on a bar the actor is turned about its hands, so it is placed with the hands on the bar (feet straight below it before the turn), like the rope
    const barsRow = st.world.mode === 'bars' && st.world.bars ? course.bars?.[st.world.bars.run] : undefined; // monkey bars: the hands are at the point between the two rungs
    const hangHold = st.world.mode === 'hang' && st.world.hang ? course.holds?.[st.world.hang.hold] : barsRow && st.world.bars ? pivotOf(barsRow, st.world.bars) : undefined;
    const hangState = st.world.mode === 'bars' ? st.world.bars : st.world.hang;
    const hOff = hangHold && hangState ? handOffset({ hold: 0, theta: 0, omega: 0, ox: hangState.ox, oy: hangState.oy, et: hangState.et }) : { x: 0, y: 0 }; // the hands ease onto the bar over a few ticks after a catch
    const ax = hangHold ? hangHold.x + hOff.x : r.x, ay = hangHold ? hangHold.y + hOff.y - DEFAULT_HANG.handHeight : r.y;
    if (actor) actor.update({ ...actorStateFor(st.world, st.keys.has('ArrowDown') || st.keys.has('KeyS'), facing, barsRow), x: ax, y: ay, ledge: st.world.mode === 'climb' && st.world.climb ? { x: st.world.climb.edge, y: st.world.climb.top } : ledge, next: st.world.mode === 'run' ? nextObstacle(r.x) : undefined });
    trackView?.place(st.world);
    sayer.update(st.world.runner.tick);
    paintStrip(r.x);
    drumLane.update(r.x);
    debug.update(st.world);
    grabHint.update(st.world, st.keys.has('KeyE'), performance.now());
    measure(r);
    views.update(st.world, facing);
    const reportOpen = panel.style.display !== 'none'; // CC-191: while a report is open the hint, the controls card, the ghost chip and the second Edit button step aside
    hint.textContent = reportOpen ? '' : hintFor(st.world);
    hint.style.display = hint.textContent ? 'block' : 'none';
    if (reportOpen !== reportWas) { reportWas = reportOpen; if (reportOpen) help.style.visibility = 'hidden'; else if (!document.getElementById('helpmenu')) help.style.visibility = ''; rowBtns.style.visibility = reportOpen ? 'hidden' : ''; const gh = document.getElementById('ghost-hud'); if (gh) gh.style.visibility = reportOpen ? 'hidden' : ''; }
    msg.textContent = st.paused && !studioHold ? 'Back from the Dojo. Press any key to carry on.' : st.world.outcome === 'cleared' ? 'You made it! Press R to run it again.' : st.idealNote;
    msg.style.display = msg.textContent ? 'block' : 'none'; // CC-166: an empty message used to leave its dark panel, a black pill, in the middle of the screen
    updateGauges(r);
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
