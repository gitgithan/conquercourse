// Replays for the ghost and for shared runs (CC-99). The simulator is deterministic at 120 Hz, so a run is its key presses:
// record the inputs, play them again from the start, and the same run comes out. Nothing here draws anything.
import type { CourseData } from '../course/course';
import { inputFor, playPlan, type Plan } from './ideal';
import { NO_INPUT, type RunnerInput } from './runner';
import { newWorld, stepWorld, type WorldState } from './world';

export const REPLAY_VERSION = 1; // bump when a change to the simulator makes old recordings play differently
export const MAX_REPLAY_TICKS = 120 * 180; // three minutes: a longer run is not a ghost
const BITS = ['run', 'left', 'jump', 'squat', 'roll', 'handL', 'handR', 'vault', 'aimUp', 'aimDown', 'up', 'fire'] as const;
export type InputLog = [mask: number, ticks: number][]; // run-length encoded: the same keys held for this many ticks

export const maskOf = (i: RunnerInput): number => BITS.reduce((m, k, b) => (i[k] ? m | (1 << b) : m), 0);
export const inputOfMask = (m: number): RunnerInput => {
  const i: RunnerInput = { ...NO_INPUT };
  BITS.forEach((k, b) => { if (m & (1 << b)) (i as unknown as Record<string, boolean>)[k] = true; });
  return i;
};
// A person's keys fit in the mask. A bot's input can also carry a take-off speed or a cannon angle: that is not a person's run, so it is not recorded.
export const isPlainInput = (i: RunnerInput): boolean => (i.jumpSpeed ?? 0) === 0 && i.aim === undefined;

export class InputRecorder {
  private log: InputLog = [];
  ticks = 0;
  valid = true; // false when something other than keys was pressed, or the run is too long
  push(i: RunnerInput): void {
    if (!isPlainInput(i) || this.ticks >= MAX_REPLAY_TICKS) { this.valid = false; return; }
    const m = maskOf(i), last = this.log[this.log.length - 1];
    if (last && last[0] === m) last[1]++; else this.log.push([m, 1]);
    this.ticks++;
  }
  reset(): void { this.log = []; this.ticks = 0; this.valid = true; }
  snapshot(): InputLog { return this.log.map(([m, n]) => [m, n]); }
}

// Where the runner was at every tick of a run (index = tick since the start): the ghost is drawn from this.
export interface GhostTrack { xs: Float32Array; ys: Float32Array; cleared: boolean; ticks: number; maxX: Float32Array }
function trackOf(xs: number[], ys: number[], cleared: boolean): GhostTrack {
  const maxX = new Float32Array(xs.length);
  let m = -Infinity;
  xs.forEach((x, i) => { m = Math.max(m, x); maxX[i] = m; });
  return { xs: Float32Array.from(xs), ys: Float32Array.from(ys), cleared, ticks: xs.length - 1, maxX };
}

// The ideal line: play the plan once and keep every tick's place. A contraption (cart, drone, cannon) is the same: the world states are kept, not the keys.
export function trackFromPlan(course: CourseData, plan: Plan, maxTicks = MAX_REPLAY_TICKS): GhostTrack {
  const xs: number[] = [], ys: number[] = [];
  const r = playPlan(course, plan, maxTicks, (w) => { xs.push(w.runner.x); ys.push(w.runner.y); });
  return trackOf(xs, ys, r.world.outcome === 'cleared');
}

export interface Verified { cleared: boolean; ticks: number; track: GhostTrack; world: WorldState }
// Play recorded keys from the start of the course. This is also the check on a shared run: the time is what the simulator says, never what the link says.
export function verifyLog(course: CourseData, log: InputLog, maxTicks = MAX_REPLAY_TICKS): Verified {
  let w = newWorld(course, course.startX);
  const xs = [w.runner.x], ys = [w.runner.y];
  let n = 0;
  outer: for (const [m, count] of log) {
    const input = inputOfMask(m);
    for (let k = 0; k < count; k++) {
      if (w.outcome !== 'running' || n >= maxTicks) break outer;
      w = stepWorld(w, input, course);
      n++;
      xs.push(w.runner.x); ys.push(w.runner.y);
    }
  }
  const cleared = w.outcome === 'cleared';
  return { cleared, ticks: w.runner.tick, track: trackOf(xs, ys, cleared), world: w };
}

// How the same plan would be keys: used by the tests to check that recording and replaying agree on the demo courses.
export function recordPlan(course: CourseData, plan: Plan, maxTicks = MAX_REPLAY_TICKS): { recorder: InputRecorder; world: WorldState } {
  const st = { next: 0, caught: null as number | null, bedAt: null as number | null } as Parameters<typeof inputFor>[2];
  const recorder = new InputRecorder();
  let w = newWorld(course);
  for (let i = 0; i < maxTicks && w.outcome === 'running'; i++) {
    const input = inputFor(plan, w, st, course);
    recorder.push(input);
    w = stepWorld(w, input, course);
  }
  return { recorder, world: w };
}

// Time at which a track first reached x (null if it never did): the gap to the ghost is how long ago, or how soon, it was where you are now.
export function reachTick(t: GhostTrack, x: number): number | null {
  if (t.maxX.length === 0 || x > t.maxX[t.maxX.length - 1]) return null;
  let lo = 0, hi = t.maxX.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (t.maxX[mid] >= x) hi = mid; else lo = mid + 1; }
  return lo;
}
// Where the ghost was at x, as a stretch of ticks: it can stand still there (hanging on a wall, waiting on a bar), so one place can last a while.
// The gap is zero while you are there at the same time as the ghost, and counts from the moment it left (ahead) or from when it arrived (behind).
export function reachSpan(t: GhostTrack, x: number): [first: number, last: number] | null {
  const first = reachTick(t, x - 0.02);
  if (first === null) return null;
  let lo = first, hi = t.maxX.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (t.maxX[mid] <= x + 0.02) lo = mid; else hi = mid - 1; }
  return [first, Math.max(first, lo)];
}
// Positive: the ghost left this place earlier (it is ahead). Seconds.
export function gapSeconds(t: GhostTrack, playerTick: number, playerX: number): number | null {
  const span = reachSpan(t, playerX);
  if (!span) return null;
  const [a, b] = span;
  return (playerTick > b ? playerTick - b : playerTick < a ? playerTick - a : 0) / 120;
}
export const gapWords = (gap: number | null, who = 'Ghost'): string => {
  if (gap === null) return `${who} is ahead`;
  if (Math.abs(gap) < 0.05) return `Level with the ${who.toLowerCase()}`;
  return gap > 0 ? `${who} is ${gap.toFixed(1)} s ahead` : `You are ${(-gap).toFixed(1)} s ahead`;
};

// ---- a run as text (for a link) ----
const toVarints = (log: InputLog): Uint8Array => {
  const out: number[] = [];
  const put = (n: number) => { while (n >= 128) { out.push((n & 127) | 128); n >>>= 7; } out.push(n); };
  for (const [m, n] of log) { put(m); put(n); }
  return Uint8Array.from(out);
};
const fromVarints = (b: Uint8Array): InputLog => {
  const out: InputLog = [];
  let i = 0;
  const get = (): number => {
    let n = 0, shift = 0;
    for (;;) {
      if (i >= b.length || shift > 28) throw new Error('bad run');
      const c = b[i++]; n |= (c & 127) << shift; shift += 7;
      if (c < 128) return n >>> 0;
    }
  };
  while (i < b.length) {
    const m = get(), n = get();
    if (m >= 1 << BITS.length || n < 1 || n > MAX_REPLAY_TICKS || out.length >= 6000) throw new Error('bad run');
    out.push([m, n]);
  }
  return out;
};
export const b64url = (b: Uint8Array): string => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64url = (s: string): Uint8Array => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
export async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const w = stream.writable.getWriter();
  void w.write(data as BufferSource); void w.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}
const canCompress = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
export async function encodeLog(log: InputLog): Promise<string> {
  const raw = toVarints(log);
  if (!canCompress) return 'r' + b64url(raw);
  const z = await pipe(raw, new CompressionStream('deflate-raw'));
  return z.length < raw.length ? 'd' + b64url(z) : 'r' + b64url(raw);
}
export async function decodeLog(s: string): Promise<InputLog> {
  if (!/^[dr][A-Za-z0-9_-]+$/.test(s) || s.length > 8000) throw new Error('bad run');
  const bytes = unb64url(s.slice(1));
  return fromVarints(s[0] === 'd' ? await pipe(bytes, new DecompressionStream('deflate-raw')) : bytes);
}

// ---- who made the course (a changed course makes an old run meaningless) ----
export function courseHash(course: CourseData): string {
  const { plan: _p, shortcuts: _s, routes: _r, ...rest } = course as CourseData & { plan?: unknown; shortcuts?: unknown; routes?: unknown };
  const text = JSON.stringify(rest);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}
export const cleanNick = (s: string): string => s.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();

export interface Challenge { hash: string; nick: string; log: InputLog }
export async function makeChallengeParam(course: CourseData, log: InputLog, nick = ''): Promise<string> {
  return `${REPLAY_VERSION}.${courseHash(course)}.${cleanNick(nick)}.${await encodeLog(log)}`;
}
export type ChallengeRead = { ok: true; challenge: Challenge } | { ok: false; why: 'version' | 'broken' };
export async function readChallengeParam(param: string): Promise<ChallengeRead> {
  const [v, hash, nick, data, ...rest] = param.split('.');
  if (rest.length || data === undefined) return { ok: false, why: 'broken' };
  if (Number(v) !== REPLAY_VERSION) return { ok: false, why: 'version' };
  if (!/^[a-z0-9]{1,8}$/.test(hash) || !/^[A-Z0-9]{0,3}$/.test(nick)) return { ok: false, why: 'broken' };
  try { return { ok: true, challenge: { hash, nick, log: await decodeLog(data) } }; } catch { return { ok: false, why: 'broken' }; }
}
