// Background music, one looping track per screen (CC-132). Original loops made from text prompts only (docs/ASSETS.md).
// On by default (?music=0 turns it off and the browser remembers; ?music=1 turns it on again). It tries to start at load, plays quietly, pauses while the tab is hidden,
// and M or the speaker button mutes it with the sound effects (the mute is remembered). Automated browsers stay silent unless the address has ?music=1.
import { isMuted, onMuteChange, setMuted } from './audio';
import { pageSearch } from '../flags';

export type Screen = 'course' | 'map' | 'editor' | 'dojo' | 'report' | 'library';
export const SCREENS: readonly Screen[] = ['course', 'map', 'editor', 'dojo', 'report', 'library'];
export const MUSIC_VOLUME = 0.3; // quiet: loops are all at the same loudness, this is the only level
export const FADE_IN_S = 2;
export const CROSSFADE_S = 1.5;

export function musicOn(search = pageSearch(), automated = typeof navigator !== 'undefined' && navigator.webdriver === true): boolean {
  const m = /[?&]music(?:=(\w+))?(?:&|$)/.exec(search);
  try {
    if (m) { const on = m[1] !== '0'; if (on) localStorage.removeItem('cc.music'); else localStorage.setItem('cc.music', '0'); return on; }
    if (automated) return false; // tests stay silent
    return localStorage.getItem('cc.music') !== '0';
  } catch { return m ? m[1] !== '0' : !automated; }
}

// Which music a mode gets. The Slicer is part of the map mode; the coaster, park and labs borrow the closest mood.
export function screenFor(mode: string): Screen {
  if (mode === 'map') return 'map';
  if (mode === 'gallery') return 'library'; // the community gallery, where players browse photo courses
  if (mode === 'editor' || mode === 'coaster') return 'editor';
  if (mode === 'dojo' || mode === 'lab-search' || mode === 'lab-optimization') return 'dojo';
  return 'course';
}

// Equal-power crossfade: the two gains always add up to the same loudness. t runs 0..1.
export function crossfadeGains(t: number): { out: number; in: number } {
  const u = Math.min(1, Math.max(0, t));
  return { out: Math.cos(u * Math.PI / 2), in: Math.sin(u * Math.PI / 2) };
}

interface Node { gain: { value: number; setValueAtTime(v: number, t: number): void; linearRampToValueAtTime(v: number, t: number): void; cancelScheduledValues(t: number): void }; connect(n: unknown): void }
interface Ctx {
  currentTime: number; destination: unknown; state: string; resume(): Promise<void>;
  createGain(): Node; decodeAudioData(b: ArrayBuffer): Promise<unknown>;
  createBufferSource(): { buffer: unknown; loop: boolean; connect(n: unknown): void; start(t?: number): void; stop(t?: number): void };
}

let ctx: Ctx | null = null, master: Node | null = null, playing: { screen: Screen; gain: Node; stop: (t: number) => void } | null = null, token = 0;
const buffers = new Map<Screen, Promise<unknown>>();
const url = (s: Screen) => `/assets/music/${s}.ogg`;

function load(s: Screen): Promise<unknown> {
  let p = buffers.get(s);
  if (!p) { p = fetch(url(s)).then((r) => r.arrayBuffer()).then((b) => ctx!.decodeAudioData(b)); p.catch(() => buffers.delete(s)); buffers.set(s, p); }
  return p;
}

function applyMute() { if (master && ctx) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(isMuted() ? 0 : MUSIC_VOLUME, ctx.currentTime); } }

async function switchTo(s: Screen) {
  if (!ctx || !master) return;
  const my = ++token;
  let buf: unknown;
  try { buf = await load(s); } catch { return; } // no file or no network: stay silent
  if (my !== token || !ctx || !master) return;
  const now = ctx.currentTime, g = ctx.createGain(), src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true; src.connect(g); g.connect(master);
  g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(1, now + (playing ? CROSSFADE_S : FADE_IN_S));
  src.start(now);
  if (playing) { const old = playing; old.gain.gain.cancelScheduledValues(now); old.gain.gain.setValueAtTime(old.gain.gain.value, now); old.gain.gain.linearRampToValueAtTime(0, now + CROSSFADE_S); old.stop(now + CROSSFADE_S + 0.1); }
  document.documentElement.dataset.music = s; // for the check in scripts/music-check.mjs
  playing = { screen: s, gain: g, stop: (t) => { try { src.stop(t); } catch { /* ok */ } } };
}

// Tell the music which screen is showing. Safe to call before audio wakes and when the music is off.
export function setMusicScreen(s: Screen) {
  if (!musicOn()) return;
  if (ctx && playing?.screen !== s) void switchTo(s);
}

// Call once per page after setMusicScreen. The music tries to start at load; if the browser refuses (no click, tap or key press yet),
// a small chip says so and the first pointerdown, keydown or touchstart starts it (mouse moves do not count as a gesture).
export function startMusic(s: Screen): void {
  if (!musicOn()) return;
  const root = document.documentElement;
  try {
    ctx = new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)() as unknown as Ctx;
  } catch { ctx = null; return; }
  const c = ctx;
  try { if (localStorage.getItem('cc.muted') === '1' && !isMuted()) setMuted(true); } catch { /* ok */ }
  master = c.createGain(); master.connect(c.destination); applyMute();
  onMuteChange(applyMute);
  void switchTo(s);
  let chip: HTMLElement | null = null;
  const gestures = ['pointerdown', 'keydown', 'touchstart'] as const;
  const onGesture = () => {
    for (const g of gestures) removeEventListener(g, onGesture, true);
    root.dataset.musicPath = 'gesture'; chip?.remove(); chip = null;
    void c.resume();
  };
  const refused = () => {
    if (c.state === 'running' || chip) return;
    chip = document.createElement('div');
    chip.id = 'music-chip'; chip.textContent = 'Music is on, click anywhere to hear it';
    chip.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:50;padding:6px 14px;border-radius:999px;background:rgba(20,30,28,.82);color:#fff;font:13px system-ui,sans-serif;pointer-events:none';
    document.body.append(chip);
    for (const g of gestures) addEventListener(g, onGesture, true); // capture phase: the Course stops some keys before they reach the page
  };
  (c as unknown as { onstatechange: (() => void) | null }).onstatechange = () => {
    if (c.state === 'running') { if (!chip) root.dataset.musicPath = 'autoplay'; chip?.remove(); chip = null; }
  };
  void c.resume().catch(() => {});
  setTimeout(refused, 400);
  // never plays while the tab is hidden
  const sync = () => { if (document.hidden) void (c as unknown as { suspend(): Promise<void> }).suspend(); else if (!chip) void c.resume(); };
  document.addEventListener('visibilitychange', sync); sync();
  speakerButton();
}

// A speaker button on every screen, bottom left (the Course and Dojo also have their "Sound" text button at the bottom right; both use the same mute).
// On shows a speaker with waves, muted shows the speaker with a slash through it; it pulses once when the music first starts so people see it.
const ICON_ON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6"/><path d="M3 3l18 18" stroke="#e5484d" stroke-width="2.5"/></svg>';
function speakerButton() {
  const paint = (b: HTMLButtonElement) => {
    b.innerHTML = isMuted() ? ICON_OFF : ICON_ON; b.setAttribute('aria-pressed', String(!isMuted()));
    b.title = 'Music on/off (M)'; b.setAttribute('aria-label', isMuted() ? 'Music is off, press to turn on (M)' : 'Music is on, press to turn off (M)');
  };
  const b = document.createElement('button');
  b.id = 'music-button'; b.type = 'button';
  b.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:5;width:44px;height:44px;display:grid;place-items:center;border:1px solid rgba(0,0,0,.25);border-radius:50%;background:rgba(255,255,255,.9);color:#17201d;cursor:pointer;padding:0';
  b.onclick = () => { setMuted(!isMuted()); b.blur(); };
  paint(b); onMuteChange(() => paint(b));
  document.body.append(b);
  try { // a short pulse the first time the music ever starts in this browser
    if (localStorage.getItem('cc.musicSeen') !== '1') { localStorage.setItem('cc.musicSeen', '1'); b.animate([{ boxShadow: '0 0 0 0 rgba(15,107,92,.7)' }, { boxShadow: '0 0 0 16px rgba(15,107,92,0)' }], { duration: 900, iterations: 3 }); }
  } catch { /* ok */ }
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyM' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || document.getElementById('soundbutton')) return; // the Course and Dojo handle M themselves
    const t = e.target as HTMLElement | null; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    setMuted(!isMuted());
  }, true);
}
