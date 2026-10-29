// The ghost (CC-99): a see-through runner that replays another run on the same clock, so you can chase it.
// It is only a drawing: it never blocks a key and nothing can touch it. The gap is a fact in plain words, never a grade.
import * as THREE from 'three';
import type { CourseData } from '../course/course';
import type { Plan } from '../sim/ideal';
import type { RunnerInput } from '../sim/runner';
import { InputRecorder, gapSeconds, gapWords, trackFromPlan, type GhostTrack } from '../sim/replay';

export type GhostMode = 'off' | 'ideal';
const MODE_KEY = 'cc.ghost.mode';
const COLOR = '#2a8fbd';

export interface GhostOpts {
  scene: THREE.Scene;
  parent: HTMLElement;
  course: CourseData;
  idealPlan: () => Promise<Plan | null>; // the plan stored with the course, or the workers' search
  zoneIndexAt: (x: number) => number; // which obstacle on the strip a place belongs to (-1 for none)
  strip: () => HTMLElement | null;
}
export interface GhostFrame { tick: number; x: number; active: boolean; firstPerson: boolean }

export interface Ghost {
  begin(fullAttempt: boolean): void; // a new run starts: a ghost chases only a run from the start of the course
  input(i: RunnerInput): void; // the keys of this tick (kept for the next parts)
  frame(f: GhostFrame): void;
  cycle(): void;
  readonly mode: GhostMode;
  reportLine(ticks: number): HTMLElement | null; // one plain line for the end report
  reportActions(chase: () => void): HTMLElement[]; // buttons for the end report
}

const ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21 V11 a7 7 0 0 1 14 0 V21 l-3.5 -2.5 L12 21 l-3.5 -2.5 Z"/><circle cx="9.5" cy="11" r="1" fill="currentColor"/><circle cx="14.5" cy="11" r="1" fill="currentColor"/></svg>`;

export function createGhost(o: GhostOpts): Ghost {
  let mode: GhostMode = 'off';
  try { if (localStorage.getItem(MODE_KEY) === 'ideal') mode = 'ideal'; } catch { /* the chip still works for this visit */ }
  const recorder = new InputRecorder();
  let full = true; // this run began at the start of the course
  let ideal: GhostTrack | null = null, idealState: 'idle' | 'working' | 'none' | 'ready' = 'idle';

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.1, 6, 12), new THREE.MeshBasicMaterial({ color: 0x5ec8ff, transparent: true, opacity: 0.4, depthWrite: false }));
  body.raycast = () => undefined; // nothing can pick it
  body.renderOrder = 5; body.visible = false;
  o.scene.add(body);

  const style = document.createElement('style');
  style.textContent = `
    #ghost-hud{position:fixed;left:50%;top:46px;transform:translateX(-50%);z-index:12;display:flex;align-items:center;gap:8px;font:600 13px system-ui,sans-serif;color:#17201d;white-space:nowrap}
    #ghost-chip{display:inline-flex;align-items:center;gap:6px;border:2px solid #17201d;background:#fff;color:#17201d;border-radius:10px;padding:3px 10px;cursor:pointer;font:inherit}
    #ghost-chip[aria-pressed=true]{border-color:${COLOR};color:${COLOR};background:#eaf6fc}
    #ghost-gap{background:#fffffff0;border-radius:8px;padding:3px 9px;display:none}
    #strip .ob.ghosthere{position:relative}
    #strip .ob.ghosthere::after{content:'';position:absolute;top:-7px;left:50%;width:10px;height:10px;margin-left:-5px;border-radius:50% 50% 2px 2px;background:#5ec8ff;border:2px solid ${COLOR}}`;
  document.head.append(style);
  const hud = document.createElement('div'); hud.id = 'ghost-hud';
  const chip = document.createElement('button'); chip.id = 'ghost-chip'; chip.type = 'button';
  const gap = document.createElement('span'); gap.id = 'ghost-gap'; gap.setAttribute('aria-live', 'polite');
  hud.append(chip, gap); o.parent.append(hud);

  const paintChip = () => {
    const word = mode === 'off' ? 'Off' : idealState === 'working' ? 'working out the ideal run…' : idealState === 'none' ? 'no ideal run here' : 'Ideal run';
    chip.innerHTML = `${ICON}<span>Ghost: ${word}</span><span style="font-weight:500;color:#58635d">N</span>`;
    chip.setAttribute('aria-pressed', String(mode !== 'off'));
    chip.title = 'A see-through runner that replays the ideal run. Chase it. Press N to switch it on or off.';
  };
  const loadIdeal = () => {
    if (idealState !== 'idle') return;
    idealState = 'working'; paintChip();
    o.idealPlan().then((plan) => {
      if (!plan) { idealState = 'none'; return; }
      ideal = trackFromPlan(o.course, plan);
      idealState = ideal.cleared ? 'ready' : 'none';
    }).catch(() => { idealState = 'none'; }).finally(paintChip);
  };
  const setMode = (m: GhostMode) => {
    mode = m;
    try { localStorage.setItem(MODE_KEY, m); } catch { /* ok */ }
    if (m === 'ideal') loadIdeal();
    paintChip();
  };
  chip.onclick = () => { setMode(mode === 'off' ? 'ideal' : 'off'); chip.blur(); };
  paintChip();
  if (mode === 'ideal') loadIdeal();

  let lastMarked = -2;
  const mark = (i: number) => {
    const s = o.strip();
    if (!s || (i === lastMarked && s.querySelector('.ghosthere'))) return;
    s.querySelectorAll('.ob.ghosthere').forEach((e) => e.classList.remove('ghosthere'));
    const el = i >= 0 ? s.querySelectorAll('.ob')[i] : undefined;
    el?.classList.add('ghosthere');
    lastMarked = i;
  };

  return {
    get mode() { return mode; },
    begin(fullAttempt) { full = fullAttempt; recorder.reset(); lastMarked = -2; },
    input(i) { if (full) recorder.push(i); },
    cycle() { setMode(mode === 'off' ? 'ideal' : 'off'); },
    frame(f) {
      const track = mode === 'ideal' && idealState === 'ready' ? ideal : null;
      const show = !!track && full && f.active;
      if (!show || !track) { body.visible = false; gap.style.display = 'none'; mark(-1); return; }
      const i = Math.min(f.tick, track.ticks);
      const gx = track.xs[i], gy = track.ys[i];
      body.position.set(gx, gy + 0.85, 0);
      body.visible = !(f.firstPerson && Math.abs(gx - f.x) < 1.2); // not in front of the eyes
      gap.textContent = gapWords(gapSeconds(track, f.tick, f.x)); gap.style.display = 'inline';
      mark(o.zoneIndexAt(gx));
    },
    reportLine(ticks) {
      if (mode !== 'ideal' || idealState !== 'ready' || !ideal || !full) return null;
      const mine = ticks / 120, theirs = ideal.ticks / 120, d = mine - theirs;
      const p = document.createElement('div');
      p.style.cssText = 'font:600 15px system-ui,sans-serif;color:#17201d';
      p.textContent = Math.abs(d) < 0.05 ? `Your time ${mine.toFixed(1)} s: the same as the ideal run.` : d > 0 ? `Your time ${mine.toFixed(1)} s. The ideal run took ${theirs.toFixed(1)} s, ${d.toFixed(1)} s faster.` : `Your time ${mine.toFixed(1)} s. You were ${(-d).toFixed(1)} s ahead of the ideal run (${theirs.toFixed(1)} s).`;
      return p;
    },
    reportActions(chase) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = mode === 'ideal' ? 'Chase the ghost again' : 'Chase the ideal run (ghost)';
      b.style.cssText = 'font:inherit;border:1px solid #2a8fbd;background:#eaf6fc;color:#17201d;border-radius:8px;padding:6px 12px;cursor:pointer';
      b.onclick = () => { if (mode === 'off') setMode('ideal'); chase(); };
      return [b];
    },
  };
}
