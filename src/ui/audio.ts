// Plain event sounds, made in code (WebAudio): no files, no licence. They say what happened, never how well.
// Audio starts after the first key press (browsers refuse earlier); M or the button mutes.
export type Sfx = 'jump' | 'land' | 'vault' | 'grab' | 'letgo' | 'splash' | 'sizzle' | 'squelch' | 'clang' | 'blast' | 'plunge' | 'finish';

// One short sound = a few tones (frequency sweep, length, shape) and optional noise.
interface Tone { f0: number; f1: number; len: number; type: OscillatorType; gain: number; at?: number }
const SOUNDS: Record<Sfx, { tones: Tone[]; noise?: { len: number; gain: number; at?: number } }> = {
  jump: { tones: [{ f0: 260, f1: 520, len: 0.12, type: 'triangle', gain: 0.18 }] },
  land: { tones: [{ f0: 120, f1: 60, len: 0.12, type: 'sine', gain: 0.3 }], noise: { len: 0.05, gain: 0.08 } },
  vault: { tones: [{ f0: 200, f1: 420, len: 0.14, type: 'triangle', gain: 0.16 }, { f0: 140, f1: 70, len: 0.1, type: 'sine', gain: 0.22, at: 0.16 }] },
  grab: { tones: [{ f0: 700, f1: 700, len: 0.05, type: 'square', gain: 0.07 }, { f0: 1050, f1: 1050, len: 0.07, type: 'square', gain: 0.06, at: 0.05 }] },
  letgo: { tones: [{ f0: 900, f1: 450, len: 0.12, type: 'sine', gain: 0.14 }] },
  splash: { tones: [{ f0: 300, f1: 90, len: 0.3, type: 'sine', gain: 0.12 }], noise: { len: 0.35, gain: 0.22 } },
  sizzle: { tones: [{ f0: 180, f1: 60, len: 0.4, type: 'sawtooth', gain: 0.07 }], noise: { len: 0.5, gain: 0.3 } },
  squelch: { tones: [{ f0: 110, f1: 55, len: 0.25, type: 'sine', gain: 0.25 }, { f0: 160, f1: 70, len: 0.18, type: 'sine', gain: 0.18, at: 0.12 }], noise: { len: 0.2, gain: 0.12 } },
  clang: { tones: [{ f0: 520, f1: 480, len: 0.3, type: 'square', gain: 0.1 }, { f0: 780, f1: 740, len: 0.25, type: 'square', gain: 0.07, at: 0.02 }] },
  blast: { tones: [{ f0: 150, f1: 40, len: 0.35, type: 'sine', gain: 0.3 }], noise: { len: 0.35, gain: 0.25 } },
  plunge: { tones: [{ f0: 700, f1: 70, len: 0.8, type: 'sine', gain: 0.14 }] },
  finish: { tones: [{ f0: 520, f1: 520, len: 0.12, type: 'triangle', gain: 0.16 }, { f0: 660, f1: 660, len: 0.12, type: 'triangle', gain: 0.16, at: 0.12 }, { f0: 880, f1: 880, len: 0.25, type: 'triangle', gain: 0.18, at: 0.24 }] },
};

// The game events (src/sim/world.ts) that make a sound. A bounce on the trampoline sounds like a jump; a wall grab like a grab.
const EVENT: Record<string, Sfx | undefined> = {
  jump: 'jump', bounce: 'jump', land: 'land', roll: 'land', vault: 'vault', 'hang-catch': 'grab', 'rope-catch': 'grab', 'wall-grab': 'grab',
  'hang-release': 'letgo', 'rope-release': 'letgo', 'launch-fire': 'clang', recoil: 'blast', 'band-release': 'letgo', 'band-snap': 'clang', 'launch-release': 'letgo', 'drone-board': 'grab', 'drone-land': 'land', 'drone-drop': 'letgo', 'drone-crash': 'clang', splash: 'splash', cleared: 'finish',
};

export interface AudioLike { // the little part of AudioContext we use, so a test can fake it
  currentTime: number; destination: unknown; state?: string; resume?: () => Promise<void>;
  createOscillator(): { type: OscillatorType; frequency: { setValueAtTime(v: number, t: number): void; exponentialRampToValueAtTime(v: number, t: number): void }; connect(n: unknown): void; start(t: number): void; stop(t: number): void };
  createGain(): { gain: { setValueAtTime(v: number, t: number): void; exponentialRampToValueAtTime(v: number, t: number): void }; connect(n: unknown): void };
  createBufferSource(): { buffer: unknown; connect(n: unknown): void; start(t: number): void };
  createBuffer(channels: number, length: number, rate: number): { getChannelData(c: number): Float32Array };
  sampleRate: number;
}

let ctx: AudioLike | null = null, muted = false, made: (() => AudioLike) | null = null;
const log: Sfx[] = [];

export function setAudioFactory(f: (() => AudioLike) | null) { made = f; ctx = null; log.length = 0; muted = false; }
export function isMuted() { return muted; }
const muteListeners: (() => void)[] = [];
export function onMuteChange(f: () => void) { muteListeners.push(f); }
export function setMuted(m: boolean) { muted = m; muteListeners.forEach((f) => f()); try { localStorage.setItem('cc.muted', m ? '1' : '0'); } catch { /* ok */ } }
export function playedSounds(): readonly Sfx[] { return log; }

function context(): AudioLike | null {
  if (ctx) return ctx;
  try { ctx = made ? made() : new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)() as unknown as AudioLike; } catch { ctx = null; }
  return ctx;
}

// Call once per page: audio wakes on the first key press, and M mutes.
export function startAudio(): () => void {
  try { muted = localStorage.getItem('cc.muted') === '1'; } catch { /* ok */ }
  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    const c = context();
    if (c?.state === 'suspended') void c.resume?.();
    if (e.code === 'KeyM' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) { setMuted(!muted); paintButton(); }
  };
  addEventListener('keydown', onKey);
  return () => removeEventListener('keydown', onKey);
}

let button: HTMLButtonElement | null = null;
function paintButton() { if (button) { const words = muted ? 'Sound: off (M)' : 'Sound: on (M)'; button.textContent = muted ? '\u{1F507}' : '\u{1F50A}'; button.title = words; button.setAttribute('aria-label', words); button.setAttribute('aria-pressed', String(!muted)); } }
export function soundButton(): HTMLButtonElement {
  button = document.createElement('button');
  button.id = 'soundbutton';
  button.style.cssText = 'position:fixed;right:120px;bottom:16px;z-index:50;font:16px/1 system-ui;padding:4px 8px;opacity:.85;cursor:pointer;border:2px solid #17201d;background:#fff;color:#17201d;border-radius:10px;box-shadow:0 4px 16px #0003';
  button.onclick = () => { setMuted(!muted); paintButton(); button?.blur(); };
  paintButton();
  return button;
}

export function sfx(name: Sfx) {
  if (muted) return;
  log.push(name);
  if (log.length > 200) log.shift();
  const c = context();
  if (!c) return;
  const spec = SOUNDS[name], now = c.currentTime;
  for (const t of spec.tones) {
    const o = c.createOscillator(), g = c.createGain(), at = now + (t.at ?? 0);
    o.type = t.type;
    o.frequency.setValueAtTime(t.f0, at);
    if (t.f1 !== t.f0) o.frequency.exponentialRampToValueAtTime(t.f1, at + t.len);
    g.gain.setValueAtTime(t.gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + t.len);
    o.connect(g); g.connect(c.destination);
    o.start(at); o.stop(at + t.len + 0.02);
  }
  if (spec.noise) {
    const n = Math.max(1, Math.floor(c.sampleRate * spec.noise.len)), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(), g = c.createGain(), at = now + (spec.noise.at ?? 0);
    s.buffer = buf; g.gain.setValueAtTime(spec.noise.gain, at); g.gain.exponentialRampToValueAtTime(0.0001, at + spec.noise.len);
    s.connect(g); g.connect(c.destination); s.start(at);
  }
}

// Plays the sound for each event of one simulator step.
const FALL_SOUND: Record<string, Sfx> = { water: 'splash', lava: 'sizzle', mud: 'squelch', spikes: 'clang', void: 'plunge' };
export function soundsFor(events: readonly { type: string; detail?: Record<string, unknown> }[], hazard = 'water') {
  for (const e of events) {
    const s = e.type === 'splash' ? FALL_SOUND[hazard] ?? 'splash' : EVENT[e.type];
    if (!s) continue;
    if (e.type === 'land' && !((e.detail?.impact as number) > 1)) continue; // a soft touch-down after a step is silent
    sfx(s);
  }
}
