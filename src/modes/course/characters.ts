import * as THREE from 'three/webgpu';
import type { CourseData } from '../../course/course';
import { makeObstacle } from '../../course/collide';
import { createRookieActor } from '../../render/actor';
import { lookSwitchOn, lookUrl } from '../../render/look';
import { softenPlayer } from '../../ui/ghost-look';
import { charactersOn, fetchCharacterUrl, guardOn, saveChoice, savedChoice, tooSlow, watchFrames } from '../../characters/runner';
import { openCharacterPanel } from '../../characters/panel';
import { castOn, loadCast } from '../../characters/cast';
import { pageSearch } from '../../flags';

// Who the player runs as (CC-41, CC-108, CC-133): the male or female Rookie, the player's own look, or a community character.
// It loads the model, keeps the choice, and builds the buttons (the Rookie pair, the look button, Characters); the Course reads the loaded actor and the choice through it.
export type Actor = Awaited<ReturnType<typeof createRookieActor>>;

export interface LookDeps {
  scene: THREE.Scene;
  course: CourseData;
  params: URLSearchParams;
  body: THREE.Mesh; // the capsule that stands in until a model loads
  setActor(a: Actor): void;
  actor(): Actor | null;
}

export interface RunnerLook {
  pick: HTMLElement; // the buttons, top right
  choice(): 'a' | 'b';
  state(): { custom: boolean; characterId: string | null; choice: 'a' | 'b' };
  start(): Promise<void>; // loads the model for the saved choice, then a character by address or from the saved pick
}

export function createRunnerLook(deps: LookDeps): RunnerLook {
  const { scene, course, params, body } = deps;
  const setActor = deps.setActor;
  let actor: Actor | null = null; // kept in step with the Course's copy through setActor
  let choice: 'a' | 'b' = 'a';
  try { const saved = localStorage.getItem('cc.rookie'); if (saved === 'a' || saved === 'b') choice = saved; } catch { /* keep going */ }
  if (params.get('rookie') === 'a' || params.get('rookie') === 'b') choice = params.get('rookie') as 'a' | 'b';
  // CC-41: with ?look=custom a third button wears the MHR body (skinned to the Rookie's bones); nothing changes without the switch
  const look = lookSwitchOn(pageSearch());
  let custom = false;
  let characterId: string | null = null; // CC-108: a community character the player picked (loaded only when picked)
  async function loadRookie(which: 'a' | 'b', wear = false, url?: string) {
    try {
      const next = await createRookieActor(scene, { rookie: which, url: url ?? (wear ? lookUrl(look ?? 'custom') : undefined), fit: !!url });
      actor?.dispose();
      softenPlayer(next.object); // CC-180
      actor = next; setActor(next); body.visible = false; choice = which; custom = wear || !!url;
      if (params.get('nopush') !== '1') actor.setObstacle(makeObstacle(course));
      if (!wear && !url && params.get('nosave') !== '1') try { localStorage.setItem('cc.rookie', which); } catch { /* ok */ }
      return true;
    } catch (e) { console.warn('Rookie not loaded, using the capsule', e); return false; }
  }
  
  // CC-108: wear a community character. Any failure, or a slow machine, goes back to the Rookie with a plain line.
  const charNote = document.createElement('div');
  charNote.id = 'charnote'; charNote.style.cssText = 'position:fixed;right:262px;top:52px;font:600 13px system-ui,sans-serif;background:#fff;border:1px solid #17201d;border-radius:8px;padding:4px 10px;display:none';
  document.body.appendChild(charNote);
  const noteLine = (t: string) => { charNote.textContent = t; charNote.style.display = t ? 'block' : 'none'; if (t) setTimeout(() => { charNote.style.display = 'none'; }, 6000); };
  const keepChoice = params.get('nosave') === '1'; // ?nosave=1: a demo frame (the Parts gallery) wears a character without touching the player's saved choice or the pick count
  const remember = (id: string | null) => { if (!keepChoice) saveChoice(id); };
  async function wearCharacter(id: string | null) {
    if (!id) { characterId = null; remember(null); await loadRookie(choice); return; }
    const got = await fetchCharacterUrl(id, fetch, castOn() ? await loadCast() : []);
    if ('error' in got) { noteLine(got.error); characterId = null; remember(null); return; }
    const ok = await loadRookie('a', false, got.url);
    if (!ok) { noteLine('That character would not load. You are running as the Rookie.'); await loadRookie(choice); characterId = null; remember(null); return; }
    characterId = id; remember(id);
    if (!keepChoice) void fetch('/api/character', { method: 'POST', body: JSON.stringify({ action: 'pick', id }) }).catch(() => undefined);
    if (guardOn()) watchFrames(90, (ms) => { if (characterId === id && tooSlow(ms)) { noteLine('Your computer is slow with this character, so you are back to the Rookie.'); void wearCharacter(null); } });
  }
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
    b.onclick = async () => { characterId = null; saveChoice(null); await loadRookie(k); paintPick(); };
    pick.appendChild(b); return b;
  });
  if (look !== null) {
    const b = document.createElement('button');
    b.id = 'look-custom';
    b.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="2.5"/><path d="M12 8 V16 M5 11 H19 M12 16 L8 21 M12 16 L16 21"/></svg>';
    b.title = 'Run as your own look';
    b.setAttribute('aria-label', b.title);
    b.onclick = async () => { characterId = null; saveChoice(null); await loadRookie('a', true); paintPick(); };
    pick.appendChild(b); pickBtns.push(b);
  }
  function paintPick() {
    pickBtns.forEach((b, i) => {
      const on = i === 2 ? custom && !characterId : !custom && (i === 0 ? 'a' : 'b') === choice;
      b.setAttribute('aria-pressed', String(on));
      b.style.cssText = `display:grid;place-items:center;width:38px;height:34px;border-radius:8px;cursor:pointer;border:2px solid ${on ? '#0f6b5c' : '#b9c2bb'};background:${on ? '#0f6b5c' : '#fff'};color:${on ? '#fff' : '#17201d'}`;
    });
  }
  if (charactersOn()) {
    const cb = document.createElement('button');
    cb.id = 'characters-btn'; cb.textContent = 'Characters'; cb.title = 'Latest creations: pick a runner or make one';
    cb.style.cssText = 'font:600 13px system-ui,sans-serif;border:2px solid #b9c2bb;background:#fff;color:#17201d;border-radius:8px;padding:4px 10px;cursor:pointer';
    cb.onclick = () => { cb.blur(); openCharacterPanel({ current: characterId, onPick: (c) => { void wearCharacter(c?.id ?? null).then(paintPick); } }); };
    pick.appendChild(cb);
  }
  paintPick();
  async function start(): Promise<void> {
    await loadRookie(choice, look !== null);
    paintPick(); // after the model is loaded: custom and the choice may have changed
    if (charactersOn()) { const asked = params.get('char'); const id = asked && /^[0-9a-f]{16}$/.test(asked) ? asked : params.get('nosave') === '1' ? null : savedChoice(); if (id) void wearCharacter(id); } // ?char=<id> wears one by address (the browser checks use it)
  }
  return { pick, choice: () => choice, state: () => ({ characterId, choice, custom }), start };
}
