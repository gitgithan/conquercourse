// ?demo=roll-ab (CC-64): a blind A/B of the roll. The same fall is played twice, once with the roll clip and once with the plain tuck,
// behind the labels A and B (which is which is drawn by chance and shown only after the answer).
// The simulator runs the drop course (a 5 m ledge) with a roll tap just before touchdown; the actor draws it; game time is the tick count.
import * as THREE from 'three/webgpu';
import type { CourseData } from '../course/course';
import { NO_INPUT } from '../sim/runner';
import { newWorld, stepWorld, type WorldState } from '../sim/world';
import { TICKS_PER_SECOND } from '../sim/units';
import { createStage } from '../render/scene';
import { createRookieActor } from '../render/actor';
import { actorStateFor } from '../motion/actor-state';
import { ROLL_TICKS, type RollLook } from '../motion/motion-table';

const STORE = 'cc.rollab';

export async function startRollAB(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const course = (await (await fetch('/assets/demo/drop.course.json')).json()) as CourseData;
  const stage = await createStage(document.body, false);
  const { scene, camera } = stage;
  scene.children.filter((o) => (o as THREE.Mesh).geometry instanceof THREE.PlaneGeometry).forEach((o) => (o.visible = false));
  scene.background = new THREE.Color(0xbfdcf2);
  for (const p of course.terrain.platforms) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(p.x1 - p.x0, p.top + 4, 4), new THREE.MeshStandardMaterial({ color: 0x8a9a5b }));
    box.position.set((p.x0 + p.x1) / 2, (p.top - 4) / 2, -2.1);
    scene.add(box);
  }
  const actor = await createRookieActor(scene, { rookie: 'a' });
  const hasClip = actor.hasRollClip();

  // the whole fall up front: run off the ledge, tap roll in the last stretch before the ground, carry on for a second
  let w: WorldState = newWorld(course, course.startX);
  const worlds: WorldState[] = [w];
  let landedFor = 0;
  for (let i = 0; i < TICKS_PER_SECOND * 30; i++) {
    const g = w.runner.y - (course.terrain.platforms.find((p) => p.x0 <= w.runner.x && w.runner.x <= p.x1)?.top ?? 0);
    const near = !w.runner.grounded && g < 1.2;
    w = stepWorld(w, { ...NO_INPUT, run: true, roll: near }, course);
    worlds.push(w);
    if (w.runner.landing && w.runner.grounded) landedFor++;
    if (w.outcome !== 'running' || landedFor > ROLL_TICKS + 90) break;
  }
  const rolledAt = worlds.find((x) => x.rolledAt > 0)?.rolledAt ?? 0;
  const first = Math.max(0, rolledAt - 150); // a second and a bit before the landing

  // which label is the clip: drawn once per session, shown only after the answer
  let clipIsA: boolean;
  const saved = sessionStorage.getItem(STORE + '.map');
  if (saved === null) { clipIsA = Math.random() < 0.5; sessionStorage.setItem(STORE + '.map', clipIsA ? 'A' : 'B'); } else clipIsA = saved === 'A';
  const lookOf = (label: 'A' | 'B'): RollLook => ((label === 'A') === clipIsA ? 'clip' : 'crouch');

  const show = (label: 'A' | 'B', tick: number) => {
    actor.setRollLook(lookOf(label));
    const i = Math.min(Math.max(tick, 0), worlds.length - 1);
    const s = actorStateFor(worlds[i], false);
    actor.update(s);
    camera.position.set(s.x + 0.5, s.y + 1.6, 8);
    camera.lookAt(s.x + 0.5, s.y + 1.1, 0);
    document.documentElement.dataset.tick = String(i);
  };

  const ui = document.createElement('div');
  ui.style.cssText = 'position:fixed;left:12px;top:12px;font:15px system-ui,sans-serif;background:#fffd;border:1px solid #17201d;border-radius:8px;padding:10px 12px;max-width:340px;display:grid;gap:8px';
  const note = document.createElement('div');
  note.textContent = hasClip
    ? 'Same fall, twice. Watch A, watch B, then say which roll looked more natural. You can replay either.'
    : 'No roll clip is installed yet, so A and B both show the tuck. Run npm run motion -- roll --ship first.';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
  const seen = new Set<string>();
  const result = document.createElement('div');
  const answer = document.createElement('div');
  answer.style.cssText = 'display:none;gap:8px;flex-wrap:wrap';
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
    const picked = choice === 'same' ? 'same' : lookOf(choice) === 'clip' ? 'clip' : 'crouch';
    result.textContent = `You picked: ${picked === 'same' ? 'no difference' : picked === 'clip' ? 'the roll clip' : 'the plain tuck'}. A was the ${lookOf('A') === 'clip' ? 'clip' : 'tuck'}, B was the ${lookOf('B') === 'clip' ? 'clip' : 'tuck'}.`;
    try { localStorage.setItem(STORE, JSON.stringify([...JSON.parse(localStorage.getItem(STORE) ?? '[]'), { picked, hasClip, at: new Date().toISOString() }])); } catch { /* no storage */ }
    document.documentElement.dataset.rollAnswer = picked;
  };
  row.append(mkBtn('Play A', () => play('A')), mkBtn('Play B', () => play('B')));
  answer.append(mkBtn('A looked better', () => reply('A')), mkBtn('B looked better', () => reply('B')), mkBtn('No difference', () => reply('same')));
  ui.append(note, row, answer, result);
  document.body.appendChild(ui);

  Object.assign(window, { __rollAB: { play, show, reply, map: () => ({ A: lookOf('A'), B: lookOf('B') }), first: () => first, rolledAt: () => rolledAt, ticks: () => worlds.length } });
  show('A', first);
  const t0 = params.has('freeze') ? Infinity : 0;
  stage.renderer.setAnimationLoop(() => {
    if (playing && t0 === 0) {
      const tick = first + Math.floor(((performance.now() - playing.start) / 1000) * TICKS_PER_SECOND);
      show(playing.label, tick);
      if (tick >= Math.min(worlds.length - 1, rolledAt + ROLL_TICKS + 60)) playing = null;
    }
    stage.renderer.render(scene, camera);
  });
  document.documentElement.dataset.backend = stage.backend;
  document.documentElement.dataset.ready = 'true';
}
