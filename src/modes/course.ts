import { backgroundOn, openBackgroundMenu, savedBackground } from '../ui/background';
import { mountToasts } from '../ui/toast-stack';
import { createKeydown } from './course/keydown';
import type { CourseCtx } from './course/context';
import { createRunStats } from './course/stats';
import { createHint } from './course/hint';
import { bandTip, buildDiag, cartDiag, cartTip, plankTip, windowTip } from './course/tips';
import { createCourseCamera } from './course/camera';
import { createRunnerLook } from './course/characters';
import { createClipMaker } from './course/clip';
import { createCourseState } from './course/state';
import { createSearch } from './course/search';
import { createShortcutList } from './course/shortcuts';
import { progressZonesOf } from './course/zones';
import { buildCourseScene } from './course/scene';
import { showClearedReport } from './course/report';
import { createViewHooks } from './course/board';
import { mountDrums } from './course/drums';
import { mountCourseGhost } from './course/ghost';
import { HAZARD_INFO } from '../course/hazard';
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
import { DEFAULT_ROPE } from '../sim/rope';
import { inputFor, searchIdealRun, workSeconds, xWindows, type Plan, type SearchResult, type Window } from '../sim/ideal';
import { createGhost } from '../ui/ghost';
import { lookOfParam } from '../ui/ghost-look';
import { challengeWords, courseTooBig, isOldLongLink, makeLinkInfo, OLD_LINK_WORDS, offersIdeal, openChallenge, secondsWords, shareOn } from '../share/challenge';
import { clipFits, clipLayoutFor } from '../share/clip';
import { mountTouch, touchOn } from '../share/touch';
import { createGaugeStack } from '../ui/gauges';
import { HUD, hudOn, keycapCss, panelCss } from '../ui/hud-style';
import { PHONE_WORDS, browserPointing, phoneMode } from '../share/phone';
import { copyLinkButton, showBanner } from '../share/share-ui';
import { reportSectionsOn } from '../ui/report-sections';
import { courseHash, encodeLog, inputOfMask, startOfX, startXOf, type InputLog } from '../sim/replay';
import { findShortcuts, shortcutLine, type Shortcut } from '../sim/shortcuts';
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
import { forkCell, pathsOn } from '../ui/paths';
import { branchesOf } from '../sim/branches';
import { goldOld, hardestBlock, hardestLabel, hardestOf } from '../ui/hardest';
import { buildReport, logTick, renderReport } from '../ui/run-report';
import { ZONE_ICONS } from '../ui/zone-icons';
import { dojoOf, OBSTACLES } from '../course/obstacles';
import { BUTTON_PLACE, buildGallery, currentWorld, DEMOS, GALLERY_EVENT, modalAttrs, mountWorldGallery, worldHref } from '../ui/world-picker';
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
import { EDIT_KEY, handoffCourse, type EditHandoff } from '../slice/roundtrip';
import { startOnboarding, type Onboarding } from '../ui/onboarding';
import { browserStore, rememberCourse, tourDecision } from '../ui/onboarding-flags';
import { pageQuery, pageSearch } from '../flags';

// The Course: the five obstacles in a row. The simulator decides everything; this file only draws it
// and turns keys into inputs. Time comes from the simulator's tick count, never from the browser's clock.
const defaultCourse = courseJson as unknown as CourseData;

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
  const gaugeStack = createGaugeStack(params.get('gauges') === 'old' ? 'old' : 'bottom-left'); // CC-148: one bottom-left stack for everything about the runner
  const speedGauge = gaugeStack.register({ id: 'speed', label: 'Speed', colour: '#0f6b5c', max: 10 });
  const batteryGauge = course.drone && params.get('gauges') !== 'old' ? gaugeStack.register({ id: 'battery', label: 'Drone battery', colour: '#2a6fb0', max: 100 }) : null;
  const hud = document.createElement('div');
  hud.style.cssText = hudOn(params) ? `font:600 18px system-ui,sans-serif;font-variant-numeric:tabular-nums;min-width:31ch;white-space:nowrap;pointer-events:none;${panelCss('5px 12px')}${params.get('hud') === 'restart' ? ';min-width:25ch;font-size:15px' : ''}` : 'position:fixed;left:16px;top:12px;font:600 18px system-ui,sans-serif;color:#10141c;text-shadow:0 1px 0 #fff8;pointer-events:none';
  const msg = document.createElement('div');
  msg.id = 'msg';
  msg.style.cssText = hudOn(params) ? `position:fixed;left:50%;top:38%;transform:translateX(-50%);max-width:90vw;text-align:center;font:700 28px system-ui,sans-serif;pointer-events:none;${panelCss('8px 18px')}` : 'position:fixed;left:0;right:0;top:38%;text-align:center;font:700 28px system-ui,sans-serif;color:#10141c;text-shadow:0 1px 0 #fff;pointer-events:none';
  // the controls, always visible top-left as a card of key caps (collapse with H)
  const help = document.createElement('div');
  help.id = 'keys';
  const KEYS: [string, string][] = [['← →', 'Run (hold)'], ['R', 'Restart (Shift+R: from the very start)'], ['Space / ↑ / W', 'Jump · press on the trampoline'], ['↓ / S', 'Bend your knees (hold, on big drops) · tap while running: slide low under a head-high ball'], ['X', 'Roll: hold it as you land (it counts in the last 0.15 s and about a metre up; a tap earlier does nothing); on the ground it rolls along'], ...(course.recoil ? ([['K', 'Fire the launcher (clip it on at the teal pad): the ball goes back, you go forward'], ...(isAimable(recoilParams(course)) ? [['↑ ↓ (or W)', 'Tilt the cannon barrel while it is loaded (Up does not jump then): it points backward and down, so the push goes forward and up; dots show where you would land']] : [])] as [string, string][]) : []), ...(course.trebuchet ? ([['→ (hold), then Space, ↑ or W', 'Trebuchet: pull the pin, then let the rider go when the hint says LET GO NOW']] as [string, string][]) : []), ...(course !== defaultCourse ? ([['E', 'Hold a bar or the rope in the air (let go to fly on), or at a tall wall: grab its edge and climb'], ['← → on a bar', 'Pump the swing: push the way you swing'], ['V', 'Vault over a step with a hand on top (fast, saves energy)']] as [string, string][]) : []), ['F', 'Toggle the Looking ahead inset'], ['N', 'Ghost: a see-through runner that replays the ideal run, to chase (N switches it)'], ...(course.track ? ([['→, Space, ↑ or W', 'Push off at the top of the first hill; Space, ↑ or W while riding jumps you off the cart'], ['↓ / S (hold)', 'Brake']] as [string, string][]) : []), ['I', 'Ideal run of this obstacle (Shift+I: the whole course, any key stops it)'], ...(course.band ? ([['←, then →', 'Elastic band: hold ← to stretch it, then turn round (hold →) and it throws you']] as [string, string][]) : []), ...(course.drone ? ([['E (on the pad)', 'Board the drone; let go to step off'], ['← → in the drone', 'Lean: the drone flies that way'], ['↑ ↓ in the drone', 'Climb, or come down']] as [string, string][]) : []), ['G', 'Drums: where the ideal run presses Space'], ['Mouse', 'Drag to turn the view, wheel to zoom (all the way in shows the face), double-click to reset']]; // retry, ideal run and Dojo are on the fall panel and the buttons
  const newHud = hudOn(params);
  help.style.cssText = newHud ? `position:fixed;left:16px;top:56px;width:290px;font:500 14px system-ui,sans-serif;pointer-events:none;display:grid;gap:5px;${panelCss('8px 10px')}` : 'position:fixed;left:16px;top:48px;width:290px;background:#fffffff0;border:1px solid #cfd6d0;border-radius:12px;padding:8px 10px;font:500 14px system-ui,sans-serif;color:#17201d;box-shadow:0 2px 10px #0002;pointer-events:none;display:grid;gap:5px';
  const MINOR: Record<string, string> = { F: 'inset', N: 'ghost', I: 'ideal run', G: 'drums', Mouse: 'view' }; // CC-156: the card keeps the keys you need to run; the rest sit in one line below
  const paintKeys = (open: boolean) => {
    gaugeStack.dock(open);
    const row = ([k, d]: [string, string]) => `<div style="display:grid;grid-template-columns:${newHud ? '104px' : '78px'} 1fr;gap:8px;align-items:center"><kbd style="${newHud ? keycapCss.replace('white-space:nowrap', 'white-space:normal') : 'font:700 13px ui-monospace,monospace;background:#eef1ec;border:1px solid #b9c2bb;border-bottom-width:3px;border-radius:6px;padding:1px 6px;text-align:center'}">${k}</kbd><span>${d}</span></div>`;
    const head = `<div style="font-weight:700;display:flex;justify-content:space-between">Controls <span style="font-weight:400;color:${newHud ? HUD.soft : '#58635d'}">H ${open ? 'hides' : 'shows'}</span></div>`;
    if (!open) { help.innerHTML = head; return; }
    const main = newHud ? KEYS.filter(([k]) => !(k in MINOR)) : KEYS, rest = newHud ? KEYS.filter(([k]) => k in MINOR) : [];
    help.innerHTML = head + main.map(row).join('') + (rest.length ? `<div style="color:${HUD.soft};font-size:13px;line-height:1.9;margin-top:2px">Also: ${rest.map(([k]) => `<kbd style="${keycapCss}">${k}</kbd> ${MINOR[k]}`).join(' &nbsp; ')}</div>` : '');
  };
  paintKeys(true);
  let reportWas = false;
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(760px,94vw);max-height:88vh;overflow:auto;z-index:40;box-sizing:border-box;background:#fff;border:1px solid #cfd6d0;border-radius:12px;padding:16px;font:15px/1.4 system-ui,sans-serif;color:#17201d;display:none;gap:10px;box-shadow:0 8px 30px #0003';
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
  idealBtn.onclick = () => showIdeal(zoneAt(st.world.runner.x)?.id ?? 'gap');
  // CC-80: from here back to the editor (the same pieces), at the obstacle the runner is at
  const editBtn = document.createElement('button');
  editBtn.id = 'editcourse'; editBtn.textContent = 'Edit this course';
  editBtn.title = 'Open this course in the World Editor, at this obstacle; "Back to the Course" brings you back here';
  editBtn.style.cssText = 'font:600 13px system-ui,sans-serif;border:1px solid #17201d;background:#fff;color:#17201d;border-radius:8px;padding:4px 10px;cursor:pointer;white-space:nowrap';
  editBtn.onclick = () => { editBtn.blur(); openEditor('edit'); };
  const wholeBtn = document.createElement('button');
  wholeBtn.id = 'wholeideal'; wholeBtn.textContent = 'Whole course (Shift+I)';
  wholeBtn.title = 'Watch one ideal run through every obstacle; a move key stops it (the camera keys do not)';
  wholeBtn.style.cssText = 'font:600 13px system-ui,sans-serif;border:1px solid #17201d;background:#fff;color:#17201d;border-radius:8px;padding:4px 10px;cursor:pointer;white-space:nowrap';
  wholeBtn.onclick = () => { wholeBtn.blur(); showWholeIdeal(); };
  // the two small buttons share one row, so they cannot overlap whatever their text widths are
  const rowBtns = document.createElement('div');
  rowBtns.id = 'coursebtns'; rowBtns.style.cssText = 'position:fixed;right:158px;top:56px;display:flex;gap:8px;align-items:center';
  const bgBtn = document.createElement('button');
  bgBtn.id = 'custombg'; bgBtn.textContent = 'Customize background';
  bgBtn.title = 'Put your own picture behind every course. It stays in this browser only.';
  bgBtn.style.cssText = editBtn.style.cssText;
  bgBtn.onclick = () => { bgBtn.blur(); openBackgroundMenu(bgBtn, paintBackground); };
  rowBtns.append(editBtn, wholeBtn);
  if (backgroundOn(params)) rowBtns.append(bgBtn);
  const nextCam = cam.nextCam;
  // the obstacle strip: one icon per obstacle; cleared ones dim, the next one is biggest; gold marks only the obstacle you fell at most (CC-183; ?gold=old: the rest glow gold)
  const strip = document.createElement('div');
  strip.id = 'strip';
  strip.style.cssText = 'position:fixed;left:50%;top:92px;transform:translateX(-50%);display:flex;gap:10px;align-items:flex-end;pointer-events:none';
  const sstyle = document.createElement('style');
  const oldGold = goldOld(); // ?gold=old: every obstacle still to do glows gold (before CC-183)
  sstyle.textContent = oldGold ? `@keyframes ccwave{0%,100%{filter:drop-shadow(0 0 2px #e8b43a88);opacity:.72}50%{filter:drop-shadow(0 0 9px #ffd24a);opacity:1}}
    #strip .ob{display:grid;justify-items:center;gap:1px;font:600 11px system-ui,sans-serif;color:#7a5a00;transition:transform .3s,opacity .3s}
    #strip .ob svg{width:34px;height:34px;padding:5px;border-radius:12px;background:#fff8dc;border:2px solid #d9a521;color:#b07d00;box-sizing:content-box}
    #strip .ob.todo svg{animation:ccwave 2.2s ease-in-out infinite}
    #strip .ob.next{transform:scale(1.25);color:#5b4200}#strip .ob.next svg{background:#ffe38a;border-color:#f0b400;color:#6b4a00}
    #strip .ob.done{opacity:.35;filter:grayscale(1)}#strip .ob.done svg{animation:none;background:#eef1ec;border-color:#9aa59e;color:#58635d}`
  : `#strip .ob{display:grid;justify-items:center;gap:1px;font:600 11px system-ui,sans-serif;color:#17201d;transition:transform .3s,opacity .3s}
    #strip .ob svg{width:34px;height:34px;padding:5px;border-radius:12px;background:#fff;border:2px solid #9aa59e;color:#58635d;box-sizing:content-box}
    #strip .ob.next{transform:scale(1.25)}#strip .ob.next svg{border-color:#0f6b5c;color:#0f6b5c}
    #strip .ob.done{opacity:.35;filter:grayscale(1)}#strip .ob.done svg{background:#eef1ec}
    #strip .ob.hard{opacity:1;filter:none}#strip .ob.hard svg{background:#ffe38a;border-color:#d9a521;color:#6b4a00}`; // gold only on the obstacle you fell at most
  const ICONS = ZONE_ICONS;
  const progressZones = course.zones?.length ? course.zones : progressZonesOf(course);
  const fallLog: string[] = []; // CC-183: one zone id per failed try this session; gold marks the zone with the most
  const hardestNow = () => { const h = hardestOf(fallLog); const z = h && progressZones.find((q) => q.id === h.id); return h && z ? { ...h, name: z.name } : null; };
  const hardBand = () => { const h = goldOld() ? null : hardestNow(); const z = h && progressZones.find((q) => q.id === h.id); return h && z ? { x0: z.x0, x1: z.x1, name: h.name, falls: h.falls } : null; }; // CC-183: the band on the report map
  const addHardest = (body: HTMLElement) => { const h = goldOld() ? null : hardestNow(); if (h) (body.querySelector('#report-ghost-slot') ?? body.lastElementChild)?.before(hardestBlock(h.name, h.falls)); };
  const VIEW_KEYS = ['KeyC', 'KeyF', 'KeyG'];
  const stripKey = { v: '' };
  function paintStrip(x: number) {
    const zs = progressZones;
    const firstTodo = zs.findIndex((z) => x < z.x1);
    const hard = goldOld() ? null : hardestNow();
    const key = zs.map((_, i) => (firstTodo === -1 || i < firstTodo ? 'd' : i === firstTodo ? 'n' : 't')).join('') + (hard ? `|${hard.id}|${hard.falls}` : '');
    if (key === stripKey.v) return;
    stripKey.v = key;
    strip.innerHTML = '';
    zs.forEach((z, i) => {
      const st = key[i];
      const d = document.createElement('div');
      d.className = 'ob ' + (st === 'd' ? 'done' : st === 'n' ? 'todo next' : 'todo') + (hard?.id === z.id ? ' hard' : '');
      d.style.animationDelay = `${i * 0.35}s`;
      d.title = `${z.name}${st === 'd' ? ' (cleared)' : ''}${hard?.id === z.id ? ` - ${hardestLabel(z.name, hard.falls)}` : ''}`;
      const fork = pathsOn(params) ? branchesOf(course).find((q) => q.id === z.id) : undefined; // CC-225: a fork shows both ways side by side
      if (fork) { d.innerHTML = forkCell(fork); strip.appendChild(d); return; }
      d.innerHTML = `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="animation-delay:${(i * 0.35).toFixed(2)}s">${ICONS[z.id.replace(/-\d+$/, '')] ?? '<circle cx="16" cy="16" r="6"/>'}</svg><span>${st === 'n' ? z.name : ''}</span>`;
      strip.appendChild(d);
    });
  }
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
  const showWorldWelcome = !resume && !worldWelcomeSeen && params.get('welcome') !== '0' && (!mode || mode === 'course') && !params.has('course') && !params.has('challenge') && !params.has('generate') && !params.has('coaster') && tour !== 'tour';
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
    stopWholeIdeal: () => stopWholeIdeal(), showWholeIdeal: () => showWholeIdeal(), showIdeal: (id) => showIdeal(id),
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
  let idealToken = 0, idealPending = 0, idealSignal = { cancelled: false };
  const cpFor = (zoneId: string) => course.checkpoints?.find((c) => c.id === zoneId)?.x ?? course.startX;
  const guides = new THREE.Group();
  scene.add(guides);
  const diagBox = document.createElement('div');
  diagBox.style.cssText = 'position:fixed;left:16px;top:70px;width:min(460px,90vw);background:#fffffff2;border:1px solid #cfd6d0;border-radius:10px;padding:10px 14px;font:15px/1.4 system-ui,sans-serif;color:#17201d;display:none;box-shadow:0 4px 18px #0002';
  document.body.append(diagBox);
  let prevMode: string = 'run', prevVx = 0;
  let soundCount = 0;
  let soundedEvents: ReturnType<typeof newWorld>['events'] | null = null;
  startAudio(); document.body.append(soundButton());
  let lastZone = 'gap';

  const debug = createDebugView(scene, course, document.body, params.get('debug') === '1');
  const grabHint = createGrabHint(scene, course, params.get('grabhint') !== '0');
  const toggleDebug = () => { debug.toggle(); dbgBtn.textContent = debug.shown ? 'Debug: on (B)' : 'Debug (B)'; dbgBtn.blur(); };
  dbgBtn.onclick = toggleDebug;
  const ghostBot = params.get('ghost') === 'bot'; // ?ghost=bot shows the ghost beside the bot too (for the check: the bot on the ideal line stays level with it)
  let ghostCtl: ReturnType<typeof createGhost> | null = null; // the ghost to chase (CC-99), made once the ideal-run search is defined
  const log: GameEvent[] = [];
  const ctx: CourseCtx = { course, st, log, guides, specs, wallNeed, everCleared: false, wallEntry: 0 };
  const stats = createRunStats(ctx, (resume ? resume.retryX : startAt ?? course.startX) > course.startX + 0.01 ? 'practice' : 'attempt');
  const { runLog, summaries, countsFor, enterZone } = stats;
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
  const analyticsCourseKey = courseKey(course.name);
  const analyticsMode = pageQuery().get('mode') ?? 'course';
  let analyticsRunId = crypto.randomUUID();
  let failedThisAttempt = false;
  touchStreak(); // CC-108
  if (!resume) trackCourseEvent('start', analyticsCourseKey, course.name, analyticsRunId, analyticsMode);
  // CC-149: a cleared run on a listed course is offered to the server, which plays the keys again before it counts (a run with anything but plain keys has no log and is not offered)
  let lastClear: BoardHooks['publish'] | null = null;
  function offerClear() {
    lastClear = null;
    const bk = listedKey();
    if (!statsOn(params) || botMode || st.demo || st.idealWhole || !bk) return;
    const mine = ghostCtl?.myRun();
    if (mine) {
      if (boardOn(params)) { rememberBest(bk, courseHash(course), logTicks(mine)); announceBest(); } // every board box redraws Your best now
      const runId = analyticsRunId, ticks = logTicks(mine), keysReady = encodeLog(mine);
      void keysReady.then((keys) => sendClear(bk, runId, courseHash(course), keys, ticks)); // counted only; the board gets it when the player clicks Publish (CC-108)
      lastClear = { ticks, send: (nick) => keysReady.then((keys) => publishClear(bk, runId, courseHash(course), keys, ticks, nick)) };
    }
  }
  try { ctx.everCleared = localStorage.getItem('cc.course.cleared') === '1'; } catch { /* keep going */ }
  let windows: ReturnType<typeof searchIdealRun>['windows'] | null = null;
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
    st.demo = null; st.idealWhole = false; idealPending = 0;
    st.world = newWorld(course, x);
    ghostCtl?.begin(x === course.startX && (!botMode || ghostBot), !botMode || ghostBot ? x : null); // a ghost chases a run from the start only; every try keeps its keys, so every try can be a clip (CC-157)
    stats.resetRunStats(x);
    analyticsRunId = crypto.randomUUID(); failedThisAttempt = false;
    if (!st.clip.on) trackCourseEvent('start', analyticsCourseKey, course.name, analyticsRunId, analyticsMode);
    log.length = 0;
    botState.next = 0; botState.caught = null; botState.bedAt = null;
    st.idealNote = '';
    msg.textContent = '';
    frames.length = 0; st.replay = null; panel.style.display = 'none';
    squashUntil = 0; toastUntil = 0; toast.style.display = 'none'; toasts.clear(); releasedAtX = null; caughtSince.clear();
  }

  // The Dojo is reachable any time: it opens on the obstacle nearest the runner (R2-G4).
  function saveResume() {
    try { sessionStorage.setItem('cc.resume', JSON.stringify({ course, world: st.world.outcome === 'running' ? st.world : null, retryX: st.retryX, facing, falls: st.falls } satisfies Resume)); } catch { /* the Course starts again */ }
  }
  // The editor opens on the course's own pieces (its source, or a copy built from its ground and bars), at the obstacle the runner is at.
  // A coaster opens its track in the coaster builder. "Make it easier" opens the editor already looking for the smallest change.
  function openEditor(intent: 'edit' | 'easier') {
    track('edit_opens');
    if (course.track) { location.href = `?mode=coaster&coaster=${course.track.pts.map(([x, y]) => `${+x.toFixed(2)},${+y.toFixed(2)}`).join(';')}&push=${+(course.track.push ?? 1.5).toFixed(2)}`; return; }
    const zone = st.world.outcome === 'running' ? zoneAt(st.world.runner.x)?.id ?? null : lastZone;
    const h: EditHandoff = { course: handoffCourse(course), retryX: st.retryX, zone, x: st.world.runner.x, facing, falls: st.falls, intent };
    try { sessionStorage.setItem(EDIT_KEY, JSON.stringify(h)); } catch { msg.textContent = 'This course is too big to hand to the World Editor.'; return; }
    location.search = '?mode=editor';
  }
  function openDojo() {
    track('dojo_opens');
    saveResume();
    const x = st.world.runner.x;
    const z = zoneAt(x)?.id ?? 'gap';
    location.search = trainLink(z, x);
  }

  // The Dojo opens on the very obstacle the player fell at, with its real numbers (R1-L1, R1-L3).
  function trainLink(zoneId: string, x: number): string {
    const q = new URLSearchParams({ mode: 'dojo', ex: zoneId === 'recoil' && course.recoil && isAimable(recoilParams(course)) ? 'cannon' : dojoOf(zoneId), from: 'course' }); // the lache pair trains on the bar swing
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
  const shortcutList = createShortcutList(course);
  const ensureShortcuts = shortcutList.ensure;
  function startShortcut(s: Shortcut) {
    clearGuides();
    st.world = newWorld(course, course.startX);
    log.length = 0; frames.length = 0; st.replay = null; panel.style.display = 'none';
    st.plan = s.plan; botState.next = 0; botState.caught = null; botState.bedAt = null;
    st.idealWhole = true; st.demo = null; st.retryX = course.startX;
    st.idealNote = shortcutLine(s) + ' Watch it, press any key to take over.';
  }
  function shortcutRow(): HTMLElement | null {
    const s = shortcutList.list()?.[0];
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
  function findPlan(c: CourseData): Promise<SearchResult> {
    const sig = idealSignal = { cancelled: false };
    return runSearch(c, sig, (label, step, of) => { st.idealNote = `Working out the ideal run… ${label} (${step} of ${of}) · any key cancels`; });
  }
  let windowsAsk: Promise<Window[] | null> | null = null;
  function ensureWindows(): Promise<Window[] | null> {
    windowsAsk ??= runSearch(course, { cancelled: false }, undefined, workSeconds(60)).then((r) => (windows = xWindows(r.windows))).catch(() => null);
    return windowsAsk;
  }
  // CC-241: a standing start has to clear the rest of the course. When the one just before the obstacle cannot (a pair that needs a run-up),
  // the start moves back to the nearest earlier checkpoint that can, and the line says so.
  async function startIdeal(x0: number, zoneId: string | null) {
    const token = ++idealToken;
    const starts = [x0, ...(course.checkpoints ?? []).map((k) => k.x).filter((x) => x < x0).sort((m, n) => n - m), ...(x0 > course.startX ? [course.startX] : [])].filter((x, i, a) => a.indexOf(x) === i);
    let p: Plan | undefined, from = x0, first: Plan | undefined;
    for (const x of starts) {
      let q = idealCache.get(x) ?? (x === course.startX ? course.plan : undefined);
      if (!q) {
        st.idealNote = 'Working out the ideal run… (any key cancels)';
        idealPending = token;
        const r = await findPlan({ ...course, startX: x }).catch(() => undefined);
        if (idealPending !== token || !r) return; // cancelled while the search ran
        idealPending = 0;
        first ??= r.plan;
        if (!r.cleared) continue;
        q = r.plan; idealCache.set(x, q);
      }
      p = q; from = x; break;
    }
    if (!p) { p = first; from = x0; } // nothing clears from a standing start: show the closest line from where it was asked
    if (!p) return;
    clearGuides();
    st.world = newWorld(course, from);
    log.length = 0; frames.length = 0; st.replay = null; panel.style.display = 'none';
    st.plan = p; botState.next = 0; botState.caught = null; botState.bedAt = null;
    st.idealWhole = zoneId === null;
    st.demo = zoneId === null ? null : { x1: (course.zones?.find((z) => z.id === zoneId)?.x1 ?? 1e9) + 3 };
    st.idealNote = zoneId === null ? 'Ideal run through every obstacle: watch it, press any key to take over.' : 'Ideal run: watch how it is done, then press R to try it yourself.';
    if (from < x0) { const back = (course.checkpoints ?? []).filter((k) => k.x >= from && k.x < x0).length; st.idealNote += ` It starts ${back === 1 ? 'one obstacle' : `${back} obstacles`} back, to build up speed.`; }
    if (zoneId === null) void ensureShortcuts().then((list) => { if (list[0] && st.plan === p && st.idealWhole) st.idealNote += ' ' + shortcutLine(list[0]); });
  }
  function showIdeal(zoneId: string) { st.idealWhole = false; void startIdeal(cpFor(zoneId), zoneId); }
  // Shift+I: the whole course, always from the standing start (CC-241), so the first obstacle is in the film too
  function showWholeIdeal() { void startIdeal(course.startX, null); }
  function stopWholeIdeal() {
    st.idealWhole = false; idealPending = 0; idealToken++; idealSignal.cancelled = true;
    if (!botMode) st.plan = null;
    st.idealNote = 'Your turn.'; setTimeout(() => { if (st.idealNote === 'Your turn.') st.idealNote = ''; }, 2500);
  }
  function demoEnd() {
    const whole = st.idealWhole; st.idealNote = '';
    st.plan = botMode ? st.plan : null; st.demo = null; st.idealWhole = false;
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
      if (st.world.outcome !== 'cleared' || !shortcutList.list()?.length) return;
      const sr = shortcutRow(); if (!sr) return;
      if (panel.style.display === 'none' || !panel.firstChild) { panel.innerHTML = ''; panel.style.display = 'grid'; const h = document.createElement('strong'); h.textContent = 'You made it!'; panel.append(h); }
      panel.appendChild(sr);
    });
  }

  // After a fall: retry at once, one tip, a skippable replay, and the offer to train that obstacle.
  let lastFall: 'splash' | 'slide' | 'hurt' | 'stall' = 'splash';
  function onFall(what: 'splash' | 'slide' | 'hurt' | 'stall') {
    st.falls++; track('falls');
    lastFall = what;
    const r = st.world.runner;
    const zone = zoneAt(what === 'slide' && course.wall ? course.wall.x0 + 1 : r.x);
    lastZone = zone?.id ?? 'gap';
    if (!failedThisAttempt) {
      failedThisAttempt = true; trackCourseEvent('fail', analyticsCourseKey, course.name, analyticsRunId, analyticsMode, lastZone);
      const failedZone = zone?.id ?? lastZone;
      if (zone) fallLog.push(zone.id);
      enterZone(failedZone); countsFor(summaries[stats.kind], failedZone).failures++; stats.finishRun(false, analyticsRunId);
    }
    st.retryX = cpFor(lastZone);
    const jump = [...log].reverse().find((e) => e.type === 'jump');
    let tip = 'Try again.', lateTip = false;
    if (what === 'slide') tip = OBSTACLES.wall.tips.slide;
    else if (what === 'hurt' && log.some((e) => e.type === 'ball-hit')) tip = 'The balls come at the same moments every time, for everyone. Wait for a gap between two balls, then go: too fast or too slow both meet the next one.';
    else if (what === 'hurt' && log.some((e) => e.type === 'drone-crash')) tip = OBSTACLES.drone.tips.crash;
    else if (what === 'hurt') tip = OBSTACLES.drop.tips.hurt;
    else if (course.track) tip = cartTip(ctx, what);
    else if (what === 'splash' && course.recoil && isAimable(recoilParams(course)) && zone?.id === 'recoil') tip = OBSTACLES.recoil.tips.aim;
    else if (course.drone && zone?.id === 'drone') tip = log.some((e) => e.type === 'drone-empty') ? OBSTACLES.drone.tips.empty : OBSTACLES.drone.tips.short;
    else if (course.recoil && zone?.id === 'recoil') tip = st.world.recoil && st.world.recoil.fired > 0 ? OBSTACLES.recoil.tips.push : OBSTACLES.recoil.tips.pad;
    else if (log.some((e) => e.type === 'plank-break')) tip = plankTip(ctx);
    else if (course.band) tip = bandTip(ctx);
    else if (zone?.id === 'trampoline') tip = OBSTACLES.trampoline.tips.fall;
    else if (zone?.id === 'rope') tip = OBSTACLES.rope.tips.fall;
    else if (!jump) tip = OBSTACLES.gap.tips.noJump;
    else if (jump && (jump.detail?.vx as number) !== undefined && (zone?.id === 'gap' || zone?.id === 'landing')) {
      const g = specs.find((q2) => r.x >= q2.x - 0.5 && r.x <= q2.x + q2.width + 1) ?? specs.find((q2) => q2.x >= r.x - 12);
      const v = jump.detail!.vx as number;
      tip = g && v < g.needed ? `You left the edge at ${v.toFixed(1)} m/s, but this ${g.width.toFixed(1)} m gap needs at least ${g.needed.toFixed(1)} m/s. Run longer before you jump.` : OBSTACLES.gap.tips.fast;
    } else {
      const ws = course.windows ?? windows; // stored with the plan; otherwise asked of the workers below, never worked out on this thread
      const hit = ws && windowTip(ws, r.x);
      if (hit) tip = hit; else if (!ws) lateTip = true;
    }
    const train = ctx.everCleared || st.falls >= 3;
    panel.innerHTML = '';
    panel.style.display = 'grid';
    const h = document.createElement('strong');
    h.textContent = what === 'slide' ? 'You slid back down the wall.' : what === 'hurt' ? (log.some((e) => e.type === 'ball-hit') ? `A ball hit you at the ${zone?.name ?? 'course'}.` : `Hard landing at the ${zone?.name ?? 'course'}.`) : what === 'stall' ? 'The cart ran out of speed on a hill.' : log.some((e) => e.type === 'plank-break') ? 'The plank broke under you.' : log.some((e) => e.type === 'cart-off') ? 'The cart left the track at a hilltop.' : HAZARD_INFO[hazard].headline(zone?.name ?? 'course');
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
    const retry = mk(`Try this ${zone?.name ?? 'obstacle'} again (R)`, () => restart(st.retryX), true);
    if (st.retryX !== course.startX) mk('Start from the beginning (Shift+R)', () => { st.retryX = course.startX; restart(course.startX); });
    mk('Watch what happened, with the numbers', () => {
      panel.style.display = 'none';
      const from = Math.max(0, frames.length - 300);
      st.replay = { i: from, from, to: frames.length };
      const lines = course.track ? cartDiag(ctx) : buildDiag(ctx, lastZone, what === 'slide' ? 'slide' : 'splash');
      diagBox.innerHTML = `<strong>Slow-motion replay</strong><ul style="margin:6px 0 0;padding-left:18px">${lines.map((l) => `<li>${l}</li>`).join('')}</ul><div style="color:#58635d;font-size:13px;margin-top:6px">Esc to skip</div>`;
      diagBox.style.display = 'block';
    });
    const tryClip = shareOn(params) && !botMode && !st.demo && !st.idealWhole && !params.get('mode') ? ghostCtl?.myClip() ?? null : null, tryTicks = st.world.runner.tick;
    const tryFrom = tryClip ? startOfX(course, tryClip.from) : null; // CC-242: a try from a checkpoint is shared with its start, so the friend begins at the same place
    const tryStart = tryFrom ?? 0;
    const tryRun = shareOn(params) && !botMode && !st.demo && !st.idealWhole && !params.get('mode') ? (ghostCtl?.myRun() ?? (tryFrom ? tryClip?.log ?? null : null)) : null; // CC-181: a try that fell can be sent as a link too; it never counts for a time
    if (tryRun) row.append(...copyLinkButton({ link: (nick) => makeLinkInfo(location.origin, pageSearch(), course, tryRun, nick, wear.choice(), 'fell', undefined, tryStart), courseTooBig: () => courseTooBig(pageSearch(), course), label: 'Copy link to this try', id: 'share-copy-fall' }));
    if (tryClip && clipFits(tryTicks)) mk('Download a video of this try', () => void makeClip(tryClip.log, tryTicks, tryClip.from)).id = 'share-clip-fall'; // CC-157: a try that ended in a fall is worth a clip too
    mk('Show me the ideal run (I)', () => showIdeal(lastZone));
    if (!course.track) mk('Make it easier', () => openEditor('easier')).id = 'makeeasier';
    mk('Edit this course', () => openEditor('edit')).id = 'editfromfall';
    if (train) mk(`Train the ${zone?.name ?? 'obstacle'}`, () => { saveResume(); location.search = trainLink(zone?.id ?? 'gap', r.x); });
    const failBody = renderReport(course, runLog, buildReport(course, runLog, st.world, false, null), {}, true, ghostCtl?.reportPath() ?? null, !reportSectionsOn(params), hardBand());
    addHardest(failBody);
    panel.append(h, t, floorNote, failBody, row);
    if (st.falls === 1 && !st.idealWhole) onboarding.onFall(panel); // CC-100: the first fall gets one calm hint (CC-191: inside the report, not over it)
    retry.focus({ preventScroll: true }); panel.scrollTop = 0;
  }

  function showAgain() { st.falls--; onFall(lastFall); }

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
      if (st.demo && (st.world.outcome !== 'running' || st.world.runner.x > st.demo.x1)) demoEnd();
      else if (st.idealWhole && st.world.outcome !== 'running') demoEnd();
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
        stats.clearFinishZone(st.world.runner.x); ctx.everCleared = true; track('clears'); stats.finishRun(true, analyticsRunId); trackCourseEvent('success', analyticsCourseKey, course.name, analyticsRunId, analyticsMode);
        offerClear();
        try { localStorage.setItem('cc.course.cleared', '1'); } catch { /* ok */ }
        panel.innerHTML = ''; panel.style.display = 'grid';
        showClearedReport({
          course, params, panel, runLog, hardBand, addHardest, listedKey, viewHooks, clearedNote,
          get world() { return st.world; }, get runKind() { return stats.kind; }, get ghostCtl() { return ghostCtl; }, get lastClear() { return lastClear; },
          get demo() { return st.demo; }, botMode, get idealWhole() { return st.idealWhole; }, loadedIsDefault, get analyticsRunId() { return analyticsRunId; },
          get onboarding() { return onboarding; }, get choice() { return wear.choice(); },
          restart: (x) => restart(x), startIdeal: (x0, z) => startIdeal(x0, z), openDojo: () => openDojo(), makeClip: (l, t, f) => makeClip(l, t, f),
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
