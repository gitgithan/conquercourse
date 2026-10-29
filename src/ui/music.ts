// Background music, one looping track per screen (CC-132). Original loops made from text prompts only (docs/ASSETS.md).
// It is a lab: off until ?music=1 (the browser remembers it; ?music=0 turns it off). It starts after the first key press, plays quietly, and M mutes it with the sound effects.
import { isMuted, onMuteChange } from './audio';

export type Screen = 'course' | 'map' | 'editor' | 'dojo' | 'report';
export const SCREENS: readonly Screen[] = ['course', 'map', 'editor', 'dojo', 'report'];
export const MUSIC_VOLUME = 0.2; // quiet by default: loops are all at the same loudness, this is the only level
export const CROSSFADE_S = 1.5;

export function musicOn(search = location.search): boolean {
  const m = /[?&]music(?:=(\w+))?(?:&|$)/.exec(search);
  try {
    if (m) { const on = m[1] !== '0'; if (on) localStorage.setItem('cc.music', '1'); else localStorage.removeItem('cc.music'); return on; }
    return localStorage.getItem('cc.music') === '1';
  } catch { return !!m && m[1] !== '0'; }
}

// Which music a mode gets. The Slicer is part of the map mode; the coaster, park and labs borrow the closest mood.
export function screenFor(mode: string): Screen {
  if (mode === 'map') return 'map';
  if (mode === 'editor' || mode === 'coaster') return 'editor';
  if (mode === 'dojo' || mode === 'lab-search') return 'dojo';
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

let ctx: Ctx | null = null, master: Node | null = null, want: Screen | null = null, playing: { screen: Screen; gain: Node; stop: (t: number) => void } | null = null, token = 0;
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
  g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(1, now + CROSSFADE_S);
  src.start(now);
  if (playing) { const old = playing; old.gain.gain.cancelScheduledValues(now); old.gain.gain.setValueAtTime(old.gain.gain.value, now); old.gain.gain.linearRampToValueAtTime(0, now + CROSSFADE_S); old.stop(now + CROSSFADE_S + 0.1); }
  playing = { screen: s, gain: g, stop: (t) => { try { src.stop(t); } catch { /* ok */ } } };
}

// Tell the music which screen is showing. Safe to call before audio wakes and when the music is off.
export function setMusicScreen(s: Screen) {
  if (!musicOn()) return;
  want = s;
  if (ctx && playing?.screen !== s) void switchTo(s);
}

// Call once per page after setMusicScreen: the browser only allows sound after the first key press or click.
export function startMusic(s: Screen): void {
  if (!musicOn()) return;
  want = s;
  const wake = () => {
    removeEventListener('keydown', wake, true); removeEventListener('pointerdown', wake, true);
    try {
      ctx = new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)() as unknown as Ctx;
      void ctx.resume();
      master = ctx.createGain(); master.connect(ctx.destination); applyMute();
      onMuteChange(applyMute);
      if (want) void switchTo(want);
    } catch { ctx = null; }
  };
  addEventListener('keydown', wake, true); addEventListener('pointerdown', wake, true); // capture phase: the Course stops some keys before they reach the page
}
