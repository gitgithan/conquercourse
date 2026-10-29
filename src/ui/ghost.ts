// The ghost (CC-99): a see-through runner that replays another run on the same clock, so you can chase it.
// It is only a drawing: it never blocks a key and nothing can touch it. The gap is a fact in plain words, never a grade.
// Three runs can be chased: the ideal run, your own best, and a friend's run from a link (checked by playing its keys again).
import * as THREE from 'three';
import type { CourseData } from '../course/course';
import type { Plan } from '../sim/ideal';
import type { RunnerInput } from '../sim/runner';
import {
  InputRecorder, REPLAY_VERSION, cleanNick, courseHash, gapSeconds, gapWords, makeChallengeParam, readChallengeParam, shouldKeepBest, trackFromPlan, verifyLog,
  type GhostTrack, type InputLog,
} from '../sim/replay';

export type GhostMode = 'off' | 'ideal' | 'best' | 'friend';
const MODE_KEY = 'cc.ghost.mode', NICK_KEY = 'cc.nick';
const COLOR = '#2a8fbd';

export interface GhostOpts {
  scene: THREE.Scene;
  parent: HTMLElement;
  course: CourseData;
  params: URLSearchParams;
  idealPlan: () => Promise<Plan | null>; // the plan stored with the course, or the workers' search
  zoneIndexAt: (x: number) => number; // which obstacle on the strip a place belongs to (-1 for none)
  strip: () => HTMLElement | null;
  reportOpen: () => boolean; // the end report is on screen: the chip steps aside so it covers nothing
}
export interface GhostFrame { tick: number; x: number; active: boolean; firstPerson: boolean }

export interface Ghost {
  begin(fullAttempt: boolean): void; // a new run starts: a ghost chases only a run from the start of the course
  input(i: RunnerInput): void; // the keys of this tick
  frame(f: GhostFrame): void;
  cycle(): void;
  cleared(ticks: number): void; // the run cleared the course: keep it if it is the fastest
  readonly mode: GhostMode;
  reportLine(ticks: number): HTMLElement | null; // plain lines for the end report
  reportActions(chase: () => void): HTMLElement[]; // buttons for the end report
}

const ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21 V11 a7 7 0 0 1 14 0 V21 l-3.5 -2.5 L12 21 l-3.5 -2.5 Z"/><circle cx="9.5" cy="11" r="1" fill="currentColor"/><circle cx="14.5" cy="11" r="1" fill="currentColor"/></svg>`;
const secs = (ticks: number): string => `${(ticks / 120).toFixed(1)} s`;

interface Kept { ticks: number; log: InputLog; at: string }

export function createGhost(o: GhostOpts): Ghost {
  const hash = courseHash(o.course), bestKey = `cc.best.${hash}`;
  let mode: GhostMode = 'off';
  try { const m = localStorage.getItem(MODE_KEY); if (m === 'ideal' || m === 'best') mode = m; } catch { /* the chip still works for this visit */ }
  const recorder = new InputRecorder();
  let full = true; // this run began at the start of the course
  let ideal: GhostTrack | null = null, idealState: 'idle' | 'working' | 'none' | 'ready' = 'idle';
  let best: (Kept & { track: GhostTrack }) | null = null;
  let friend: { track: GhostTrack; nick: string; ticks: number } | null = null;
  let note = '';

  // your best: kept in this browser as its keys; it is played again before it is trusted (a changed simulator or course drops it)
  try {
    const raw = localStorage.getItem(bestKey);
    if (raw) {
      const k = JSON.parse(raw) as Kept & { v?: number };
      if (k.v === REPLAY_VERSION && Array.isArray(k.log)) {
        const v = verifyLog(o.course, k.log);
        if (v.cleared && v.ticks === k.ticks) best = { ticks: k.ticks, log: k.log, at: k.at, track: v.track };
      }
    }
  } catch { /* no best yet */ }
  if (mode === 'best' && !best) mode = 'ideal';

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.1, 6, 12), new THREE.MeshBasicMaterial({ color: 0x5ec8ff, transparent: true, opacity: 0.4, depthWrite: false }));
  body.raycast = () => undefined; // nothing can pick it
  body.renderOrder = 5; body.visible = false;
  o.scene.add(body);

  const style = document.createElement('style');
  style.textContent = `
    #ghost-hud{position:fixed;left:50%;top:46px;transform:translateX(-50%);z-index:12;display:flex;align-items:center;gap:8px;font:600 13px system-ui,sans-serif;color:#17201d;white-space:nowrap;max-width:94vw}
    #ghost-chip{display:inline-flex;align-items:center;gap:6px;border:2px solid #17201d;background:#fff;color:#17201d;border-radius:10px;padding:3px 10px;cursor:pointer;font:inherit}
    #ghost-chip[aria-pressed=true]{border-color:${COLOR};color:${COLOR};background:#eaf6fc}
    #ghost-gap{background:#fffffff0;border-radius:8px;padding:3px 9px;display:none}
    #ghost-note{position:fixed;left:50%;top:76px;transform:translateX(-50%);z-index:12;background:#fff8dc;border:1px solid #d9a521;border-radius:8px;padding:3px 10px;font:600 13px system-ui,sans-serif;color:#17201d;display:none;max-width:90vw}
    #strip .ob.ghosthere{position:relative}
    #strip .ob.ghosthere::after{content:'';position:absolute;top:-7px;left:50%;width:10px;height:10px;margin-left:-5px;border-radius:50% 50% 2px 2px;background:#5ec8ff;border:2px solid ${COLOR}}`;
  document.head.append(style);
  const hud = document.createElement('div'); hud.id = 'ghost-hud';
  const chip = document.createElement('button'); chip.id = 'ghost-chip'; chip.type = 'button';
  const gap = document.createElement('span'); gap.id = 'ghost-gap'; gap.setAttribute('aria-live', 'polite');
  const noteEl = document.createElement('div'); noteEl.id = 'ghost-note';
  hud.append(chip, gap); o.parent.append(hud, noteEl);
  const say = (t: string) => { note = t; noteEl.textContent = t; noteEl.style.display = t ? 'block' : 'none'; if (t) setTimeout(() => { if (note === t) say(''); }, 9000); };

  const who = (): string => (mode === 'best' ? 'Your best' : mode === 'friend' ? (friend?.nick || 'Friend') : 'Ghost');
  const track = (): GhostTrack | null => (mode === 'ideal' && idealState === 'ready' ? ideal : mode === 'best' ? best?.track ?? null : mode === 'friend' ? friend?.track ?? null : null);
  const paintChip = () => {
    const word = mode === 'off' ? 'Off'
      : mode === 'ideal' ? (idealState === 'working' ? 'working out the ideal run…' : idealState === 'none' ? 'no ideal run here' : 'Ideal run')
      : mode === 'best' ? `Your best (${secs(best?.ticks ?? 0)})`
      : `${friend?.nick || 'A friend'}'s run (${secs(friend?.ticks ?? 0)})`;
    chip.innerHTML = `${ICON}<span>Ghost: ${word}</span><span style="font-weight:500;color:#58635d">N</span>`;
    chip.setAttribute('aria-pressed', String(mode !== 'off'));
    chip.title = 'A see-through runner that replays another run. Chase it. Press N to switch between the ideal run, your best and a friend\'s run.';
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
  const order = (): GhostMode[] => ['off', 'ideal', ...(best ? ['best' as const] : []), ...(friend ? ['friend' as const] : [])];
  const setMode = (m: GhostMode) => {
    mode = m;
    try { if (m !== 'friend') localStorage.setItem(MODE_KEY, m); } catch { /* ok */ }
    if (m === 'ideal') loadIdeal();
    paintChip();
  };
  const next = () => { const l = order(); setMode(l[(l.indexOf(mode) + 1) % l.length]); };
  chip.onclick = () => { next(); chip.blur(); };
  paintChip();
  if (mode === 'ideal') loadIdeal();

  // a friend's run from a link: the keys are played here, so the time is the simulator's and cannot be faked
  const challenge = o.params.get('challenge');
  if (challenge) {
    void readChallengeParam(challenge).then((r) => {
      if (!r.ok) { say(r.why === 'version' ? 'That link is from another version of the game, so its run cannot play here. Chasing the ideal run instead.' : 'That link could not be read. Chasing the ideal run instead.'); setMode(mode === 'off' ? 'ideal' : mode); return; }
      if (r.challenge.hash !== hash) { say('The course has changed since that link was made, so its run cannot play here. Chasing the ideal run instead.'); setMode(mode === 'off' ? 'ideal' : mode); return; }
      const v = verifyLog(o.course, r.challenge.log);
      if (!v.cleared) { say('That run could not be checked, so it cannot be a ghost. Chasing the ideal run instead.'); setMode(mode === 'off' ? 'ideal' : mode); return; }
      friend = { track: v.track, nick: r.challenge.nick, ticks: v.ticks };
      mode = 'friend'; paintChip();
      say(`Chase ${r.challenge.nick ? r.challenge.nick + '\'s' : 'a friend\'s'} run: ${secs(v.ticks)}. Press N to switch.`);
    });
  }

  let lastMarked = -2;
  const mark = (i: number) => {
    const s = o.strip();
    if (!s || (i === lastMarked && s.querySelector('.ghosthere'))) return;
    s.querySelectorAll('.ob.ghosthere').forEach((e) => e.classList.remove('ghosthere'));
    const el = i >= 0 ? s.querySelectorAll('.ob')[i] : undefined;
    el?.classList.add('ghosthere');
    lastMarked = i;
  };

  const copy = async (text: string): Promise<boolean> => {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back to selecting a text box */ }
    const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;left:-9999px'; document.body.append(t); t.select();
    const done = document.execCommand?.('copy') ?? false; t.remove(); return done;
  };

  return {
    get mode() { return mode; },
    begin(fullAttempt) { full = fullAttempt; recorder.reset(); lastMarked = -2; },
    input(i) { if (full) recorder.push(i); },
    cycle() { next(); },
    cleared(ticks) {
      if (!full || !recorder.valid) return;
      const log = recorder.snapshot();
      const v = verifyLog(o.course, log);
      if (!v.cleared || v.ticks !== ticks) return; // only a run that plays again exactly is kept
      if (!shouldKeepBest(best?.ticks ?? null, ticks)) return;
      best = { ticks, log, at: new Date().toISOString().slice(0, 10), track: v.track };
      try { localStorage.setItem(bestKey, JSON.stringify({ v: REPLAY_VERSION, ticks, log, at: best.at })); } catch { /* the best lasts this visit only */ }
      paintChip();
    },
    frame(f) {
      const away = o.reportOpen();
      hud.style.display = away ? 'none' : 'flex'; if (away) noteEl.style.display = 'none';
      const t = track();
      const show = !!t && full && f.active;
      if (!show || !t) { body.visible = false; gap.style.display = 'none'; mark(-1); return; }
      const i = Math.min(f.tick, t.ticks);
      const gx = t.xs[i], gy = t.ys[i];
      body.position.set(gx, gy + 0.85, 0);
      body.visible = !(f.firstPerson && Math.abs(gx - f.x) < 1.2); // not in front of the eyes
      gap.textContent = gapWords(gapSeconds(t, f.tick, f.x), who()); gap.style.display = 'inline';
      mark(o.zoneIndexAt(gx));
    },
    reportLine(ticks) {
      if (!full) return null;
      const box = document.createElement('div');
      box.style.cssText = 'display:grid;gap:2px;font:600 15px system-ui,sans-serif;color:#17201d';
      const line = (t: string) => { const p = document.createElement('div'); p.textContent = t; box.append(p); };
      const t = track();
      if (t && t.cleared) {
        const d = (ticks - t.ticks) / 120, name = mode === 'ideal' ? 'the ideal run' : mode === 'best' ? 'your best' : `${friend?.nick || 'your friend'}'s run`;
        line(Math.abs(d) < 0.05 ? `Your time ${secs(ticks)}: the same as ${name}.` : d > 0 ? `Your time ${secs(ticks)}. ${name[0].toUpperCase() + name.slice(1)} took ${secs(t.ticks)}, ${d.toFixed(1)} s faster.` : `Your time ${secs(ticks)}. You were ${(-d).toFixed(1)} s ahead of ${name} (${secs(t.ticks)}).`);
      } else line(`Your time ${secs(ticks)}.`);
      if (best && best.ticks === ticks && recorder.valid) line('This is your best run on this course.');
      return box;
    },
    reportActions(chase) {
      const out: HTMLElement[] = [];
      const btn = (text: string, onclick: () => void, strong = false) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = text;
        b.style.cssText = `font:inherit;border:1px solid ${COLOR};background:${strong ? '#eaf6fc' : '#fff'};color:#17201d;border-radius:8px;padding:6px 12px;cursor:pointer`;
        b.onclick = onclick; return b;
      };
      out.push(btn(mode === 'off' ? 'Chase the ideal run (ghost)' : 'Chase the ghost again', () => { if (mode === 'off') setMode('ideal'); chase(); }, true));
      if (best) {
        const nick = document.createElement('input');
        nick.type = 'text'; nick.maxLength = 3; nick.placeholder = 'ABC'; nick.setAttribute('aria-label', 'A nickname of up to three letters (optional)'); nick.title = 'A nickname of up to three letters (optional). The link holds no other name.';
        nick.style.cssText = 'width:44px;font:inherit;text-transform:uppercase;text-align:center;border:1px solid #b9c2bb;border-radius:8px;padding:5px';
        try { nick.value = localStorage.getItem(NICK_KEY) ?? ''; } catch { /* ok */ }
        const share = btn(`Copy link to my best run (${secs(best.ticks)})`, () => {
          const n = cleanNick(nick.value); try { localStorage.setItem(NICK_KEY, n); } catch { /* ok */ }
          void makeChallengeParam(o.course, best!.log, n).then(async (p) => {
            const u = new URL(location.href);
            ['bot', 'ghost', 'startx', 'welcome'].forEach((k) => u.searchParams.delete(k));
            u.searchParams.set('challenge', p); u.searchParams.set('welcome', '0');
            const ok = await copy(u.toString());
            share.textContent = ok ? `Copied (${u.toString().length} characters)` : 'Could not copy: select the address bar link instead';
            if (!ok) history.replaceState(null, '', u.toString());
            setTimeout(() => { share.textContent = `Copy link to my best run (${secs(best!.ticks)})`; }, 4000);
          });
        });
        share.id = 'ghost-share'; nick.id = 'ghost-nick';
        out.push(nick, share);
      }
      return out;
    },
  };
}
