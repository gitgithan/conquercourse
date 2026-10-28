// ?demo=poses (CC-77): the Rookie in each pose the clips do not cover, for a contact sheet and a by-eye check:
// the coaster rider on the grab bar, the trebuchet rider in the sling, the giant swing at any angle, and the hurt landing at any second.
// ?demo=hurt-ab: a blind A/B of the hurt landing, the shipped clip against the built crumple (same pattern as ?demo=roll-ab).
import * as THREE from 'three/webgpu';
import type { CourseData } from '../course/course';
import { NO_INPUT } from '../sim/runner';
import { newWorld, stepWorld, type WorldState } from '../sim/world';
import { createStage } from '../render/scene';
import { createRookieActor } from '../render/actor';
import { buildTrack } from '../render/track';
import { actorStateFor } from '../motion/actor-state';
import { DEFAULT_HANG, feetOf } from '../sim/holds';
import type { ActorState } from '../motion/actor-pose';
import { HURT_TICKS, hurtTotalTicks } from '../motion/poses';

const base: ActorState = { tick: 1000, x: 0, y: 0, vx: 0, vy: 0, grounded: true, mode: 'run', squat: false, landedTicksAgo: null, facing: 1 };
const fetchCourse = async (name: string) => (await (await fetch(`/assets/demo/${name}.course.json`)).json()) as CourseData;

async function stageWithActor() {
  const stage = await createStage(document.body, false);
  const { scene, camera } = stage;
  scene.children.filter((o) => (o as THREE.Mesh).geometry instanceof THREE.PlaneGeometry).forEach((o) => (o.visible = false));
  scene.background = new THREE.Color(0xbfdcf2);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(40, 0.2, 4), new THREE.MeshStandardMaterial({ color: 0x8a9a5b }));
  floor.position.set(0, -0.1, -0.2);
  scene.add(floor);
  const actor = await createRookieActor(scene, { rookie: 'a' });
  const aim = (x: number, y: number, dist = 6) => { camera.position.set(x + 0.3, y + 1.4, dist); camera.lookAt(x + 0.3, y + 1.0, 0); };
  return { stage, scene, camera, actor, aim };
}

export async function startPoses(): Promise<void> {
  const { stage, scene, camera, actor, aim } = await stageWithActor();
  const coaster = await fetchCourse('coaster');
  const launch = await fetchCourse('launch');
  const lache = await fetchCourse('lache');
  const hold = lache.holds![0];
  const track = buildTrack(coaster);
  scene.add(track.group);
  const cartWorld = newWorld(coaster, coaster.startX);
  const launchWorld = newWorld(launch, launch.startX);
  let bar: THREE.Mesh | null = null;

  const api = {
    // seated in the coaster cart, with the grab bar
    seated() {
      track.group.visible = true;
      if (bar) bar.visible = false;
      track.place(cartWorld, false);
      const s = actorStateFor(cartWorld, false);
      actor.update({ ...s, tick: s.tick + 1 });
      aim(s.x, s.y, 5);
    },
    // in the trebuchet's sling
    sling() {
      track.group.visible = false;
      const s = actorStateFor(launchWorld, false);
      actor.update({ ...s, tick: s.tick + 1 });
      aim(s.x, s.y, 6);
    },
    // hanging from the lache's first bar at angle theta (rad from straight down) swinging at omega (rad/s), placed the way the Course places it
    swing(theta: number, omega: number) {
      track.group.visible = false;
      const hang = { hold: 0, theta, omega };
      const f = feetOf(hold, hang);
      const w: WorldState = { ...newWorld(lache, lache.startX), mode: 'hang', hang, runner: { ...newWorld(lache, lache.startX).runner, x: f.x, y: f.y, tick: 5000 + Math.round(theta * 100), grounded: false } };
      actor.update({ ...actorStateFor(w, false), x: hold.x, y: hold.y - DEFAULT_HANG.handHeight }); // the Course puts the feet straight below the bar and turns the body about the hands
      if (!bar) { bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 10), new THREE.MeshStandardMaterial({ color: 0xc9ced4 })); bar.rotation.x = Math.PI / 2; scene.add(bar); }
      bar.visible = true;
      bar.position.set(hold.x, hold.y, 0);
      camera.position.set(hold.x + 0.2, hold.y - 0.6, 7.5);
      camera.lookAt(hold.x + 0.2, hold.y - 0.6, 0);
    },
    // the hurt landing `seconds` after the landing
    hurt(seconds: number) {
      track.group.visible = false;
      if (bar) bar.visible = false;
      actor.update({ ...base, hurt: true, tick: 8000 });
      actor.update({ ...base, hurt: true, tick: 8000 + Math.round(seconds * 120) });
      aim(0, 0, 5);
    },
    hurtTicks: HURT_TICKS,
    aim,
  };
  Object.assign(window, { __poses: api });
  api.seated();
  stage.renderer.setAnimationLoop(() => stage.renderer.render(scene, camera));
  document.documentElement.dataset.backend = stage.backend;
  document.documentElement.dataset.ready = 'true';
}

const STORE = 'cc.hurtab';

export async function startHurtAB(): Promise<void> {
  const { stage, scene, camera, actor, aim } = await stageWithActor();
  void aim;
  const hasClip = actor.hasHurtClip();
  let clipIsA: boolean;
  const saved = sessionStorage.getItem(STORE + '.map');
  if (saved === null) { clipIsA = Math.random() < 0.5; sessionStorage.setItem(STORE + '.map', clipIsA ? 'A' : 'B'); } else clipIsA = saved === 'A';
  const lookOf = (label: 'A' | 'B'): 'auto' | 'bones' => ((label === 'A') === clipIsA ? 'auto' : 'bones');
  const kindOf = (label: 'A' | 'B') => (lookOf(label) === 'auto' && hasClip ? 'clip' : 'built');

  const show = (label: 'A' | 'B', tick: number) => {
    actor.setHurtLook(lookOf(label));
    actor.update({ ...base, hurt: true, tick: 9000 });
    actor.update({ ...base, hurt: true, tick: 9000 + Math.min(Math.max(tick, 0), hurtTotalTicks(actor.hurtSeconds())) });
    camera.position.set(0.3, 1.5, 5.5);
    camera.lookAt(0.3, 0.9, 0);
  };

  const ui = document.createElement('div');
  ui.style.cssText = 'position:fixed;left:12px;top:12px;font:15px system-ui,sans-serif;background:#fffd;border:1px solid #17201d;border-radius:8px;padding:10px 12px;max-width:340px;display:grid;gap:8px';
  const note = document.createElement('div');
  note.textContent = hasClip
    ? 'Same hard landing, twice. Watch A, watch B, then say which looked more natural. You can replay either.'
    : 'No hurt clip is installed, so A and B both show the built fall.';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
  const answer = document.createElement('div');
  answer.style.cssText = 'display:none;gap:8px;flex-wrap:wrap';
  const result = document.createElement('div');
  const seen = new Set<string>();
  const mkBtn = (text: string, onclick: () => void) => {
    const b = document.createElement('button');
    b.textContent = text;
    b.style.cssText = 'font:600 15px system-ui,sans-serif;border:1px solid #17201d;background:#fff;color:#17201d;border-radius:8px;padding:6px 14px;cursor:pointer';
    b.onclick = onclick;
    return b;
  };
  let playing: { label: 'A' | 'B'; start: number } | null = null;
  const play = (label: 'A' | 'B') => { playing = { label, start: performance.now() }; seen.add(label); if (seen.size === 2) answer.style.display = 'flex'; };
  const reply = (choice: 'A' | 'B' | 'same') => {
    const picked = choice === 'same' ? 'same' : kindOf(choice);
    result.textContent = `You picked: ${picked === 'same' ? 'no difference' : picked === 'clip' ? 'the clip' : 'the built fall'}. A was the ${kindOf('A')}, B was the ${kindOf('B')}.`;
    try { localStorage.setItem(STORE, JSON.stringify([...JSON.parse(localStorage.getItem(STORE) ?? '[]'), { picked, hasClip, at: new Date().toISOString() }])); } catch { /* no storage */ }
    document.documentElement.dataset.hurtAnswer = picked;
  };
  row.append(mkBtn('Play A', () => play('A')), mkBtn('Play B', () => play('B')));
  answer.append(mkBtn('A looked better', () => reply('A')), mkBtn('B looked better', () => reply('B')), mkBtn('No difference', () => reply('same')));
  ui.append(note, row, answer, result);
  document.body.appendChild(ui);

  Object.assign(window, { __hurtAB: { play, show, reply, map: () => ({ A: kindOf('A'), B: kindOf('B') }), ticks: () => hurtTotalTicks(actor.hurtSeconds()) } });
  show('A', 0);
  stage.renderer.setAnimationLoop(() => {
    if (playing && !new URLSearchParams(location.search).has('freeze')) {
      const tick = Math.floor(((performance.now() - playing.start) / 1000) * 120);
      show(playing.label, tick);
      if (tick >= hurtTotalTicks(actor.hurtSeconds())) playing = null;
    }
    stage.renderer.render(scene, camera);
  });
  document.documentElement.dataset.backend = stage.backend;
  document.documentElement.dataset.ready = 'true';
  void NO_INPUT; void stepWorld; void (0 as unknown as WorldState);
}
