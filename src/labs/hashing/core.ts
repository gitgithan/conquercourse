// Lab 11: Verification and hashing. The pure part: three hash functions, three things a run can be hashed as,
// a tamper that edits one tick of the recorded keys, and the real replay judge (src/sim/replay.ts) to see what each choice catches.
// Nothing here draws anything and nothing here talks to a server.
import type { CourseData } from '../../course/course';
import { inputOfMask, maskOf, verifyLog, type InputLog } from '../../sim/replay';
import { NO_INPUT } from '../../sim/runner';
import { newWorld, stepWorld } from '../../sim/world';

// ---- hash functions (all synchronous, all on bytes) ----
export type HashId = 'fnv' | 'sha' | 'sum';
export interface HashFn { id: HashId; label: string; bits: number; about: string; digest(b: Uint8Array): Uint8Array }

/** FNV-1a, 32 bits: the same loop as `courseHash` in src/sim/replay.ts (xor the byte, multiply by the prime). */
export function fnv1a32(b: Uint8Array): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
const be = (n: number, len: number): Uint8Array => { const o = new Uint8Array(len); for (let i = len - 1; i >= 0; i--) { o[i] = n & 255; n = Math.floor(n / 256); } return o; };

/** Add up the bytes, 16 bits. A checksum, not a hash: shown so the contrast with a real hash can be measured. */
export const sum16 = (b: Uint8Array): number => { let s = 0; for (const x of b) s = (s + x) & 0xffff; return s; };

const K = Uint32Array.from([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
/** SHA-256 (32 bytes), written out here so a Lab run can hash thousands of ticks without waiting. The tests check it against the platform's own. */
export function sha256(msg: Uint8Array): Uint8Array {
  const h = Uint32Array.from([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const total = Math.ceil((msg.length + 9) / 64) * 64;
  const p = new Uint8Array(total);
  p.set(msg); p[msg.length] = 0x80;
  const dv = new DataView(p.buffer);
  dv.setUint32(total - 8, Math.floor((msg.length * 8) / 2 ** 32)); dv.setUint32(total - 4, (msg.length * 8) >>> 0);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  const out = new Uint8Array(32);
  h.forEach((x, i) => out.set(be(x, 4), i * 4));
  return out;
}

export const HASHES: HashFn[] = [
  { id: 'fnv', label: 'FNV-1a (32 bits)', bits: 32, about: 'The loop the game uses to name a course in a shared link: xor a byte, multiply by a prime, repeat.', digest: (b) => be(fnv1a32(b), 4) },
  { id: 'sha', label: 'SHA-256, first 64 bits', bits: 64, about: 'What the golden files use (cut to 16 hex digits): a strong mixing function.', digest: (b) => sha256(b).slice(0, 8) },
  { id: 'sum', label: 'Sum of bytes (16 bits)', bits: 16, about: 'Not a hash, only a checksum. It is here so you can measure what mixing buys.', digest: (b) => be(sum16(b), 2) },
];
export const hashOf = (id: HashId): HashFn => HASHES.find((h) => h.id === id)!;
export const hex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
export const bitsDiffering = (a: Uint8Array, b: Uint8Array): number => { let n = 0; for (let i = 0; i < Math.max(a.length, b.length); i++) { let x = (a[i] ?? 0) ^ (b[i] ?? 0); while (x) { n += x & 1; x >>= 1; } } return n; };

// ---- a run, as the pieces that can be hashed ----
export type Scope = 'log' | 'final' | 'ticks';
export const SCOPES: { id: Scope; label: string; about: string }[] = [
  { id: 'log', label: 'The key log', about: 'Hash the recorded keys, run by run. This is what a shared link carries.' },
  { id: 'final', label: 'The final state', about: 'Hash only where the runner ended up: tick, place, speed, energy, outcome.' },
  { id: 'ticks', label: 'Every tick', about: 'Hash the state at every tick, each hash feeding the next, so the first tick that differs is found.' },
];

export interface Played { log: InputLog; masks: number[]; states: string[]; cleared: boolean; ticks: number; finalX: number; xs: number[]; ys: number[] }
const KEY_NAMES = ['run', 'left', 'jump', 'squat', 'roll', 'handL', 'handR', 'vault', 'aimUp', 'aimDown', 'up', 'fire', 'slide'] as const;
export type KeyName = (typeof KEY_NAMES)[number];
export const KEYS: readonly KeyName[] = KEY_NAMES;
export const maskOfKey = (k: KeyName): number => maskOf({ ...NO_INPUT, [k]: true });

export const expand = (log: InputLog): number[] => log.flatMap(([m, n]) => Array<number>(n).fill(m));
export const compress = (masks: number[]): InputLog => { const out: InputLog = []; for (const m of masks) { const l = out[out.length - 1]; if (l && l[0] === m) l[1]++; else out.push([m, 1]); } return out; };
const stateText = (w: ReturnType<typeof newWorld>): string => `${w.runner.tick}|${w.runner.x}|${w.runner.y}|${w.runner.vx}|${w.runner.vy}|${w.energy}|${w.outcome}`;

/** Play the keys from the start with the real simulator and keep the state text of every tick (index 0 is the start). Stops where `verifyLog` stops. */
export function playLog(course: CourseData, log: InputLog, maxTicks = 120 * 180): Played {
  let w = newWorld(course, course.startX);
  const states = [stateText(w)], xs = [w.runner.x], ys = [w.runner.y];
  let n = 0;
  outer: for (const [m, count] of log) {
    const input = inputOfMask(m);
    for (let k = 0; k < count; k++) {
      if (w.outcome !== 'running' || n >= maxTicks) break outer;
      w = stepWorld(w, input, course); n++;
      states.push(stateText(w)); xs.push(w.runner.x); ys.push(w.runner.y);
    }
  }
  return { log, masks: expand(log), states, cleared: w.outcome === 'cleared', ticks: w.runner.tick, finalX: w.runner.x, xs, ys };
}

const enc = new TextEncoder();
export function logBytes(log: InputLog): Uint8Array {
  const o = new Uint8Array(log.length * 4);
  log.forEach(([m, n], i) => { o[i * 4] = m & 255; o[i * 4 + 1] = m >> 8; o[i * 4 + 2] = n & 255; o[i * 4 + 3] = n >> 8; });
  return o;
}
const cat = (a: Uint8Array, b: Uint8Array): Uint8Array => { const o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; };

/** Per-tick chain: h(t) = H(h(t-1) followed by the state at tick t). */
export function chainDigests(states: string[], fn: HashFn): Uint8Array[] {
  const out: Uint8Array[] = [];
  let prev: Uint8Array = new Uint8Array(0);
  for (const s of states) { prev = fn.digest(cat(prev, enc.encode(s))); out.push(prev); }
  return out;
}
export function scopeDigest(run: Played, scope: Scope, fn: HashFn): Uint8Array {
  if (scope === 'log') return fn.digest(logBytes(run.log));
  if (scope === 'final') return fn.digest(enc.encode(run.states[run.states.length - 1]));
  return chainDigests(run.states, fn).at(-1)!;
}

// ---- the tamper: change one tick of the recorded keys ----
export type TamperKey = KeyName | 'drop';
export interface Tamper { tick: number; key: TamperKey } // key: flip that key for the one tick, or 'drop' to delete the tick
export function tamperLog(log: InputLog, t: Tamper): InputLog {
  const masks = expand(log);
  if (t.tick < 0 || t.tick >= masks.length) return log.map(([m, n]) => [m, n]);
  if (t.key === 'drop') masks.splice(t.tick, 1); else masks[t.tick] ^= maskOfKey(t.key);
  return compress(masks);
}
/** The first tick whose state differs between two runs (null if they never differ, or one is just a prefix with the same states). */
export function firstDivergence(a: Played, b: Played): number | null {
  const n = Math.min(a.states.length, b.states.length);
  for (let i = 0; i < n; i++) if (a.states[i] !== b.states[i]) return i;
  return a.states.length === b.states.length ? null : n;
}
export interface Verdict { scope: Scope; hash: HashId; before: Uint8Array; after: Uint8Array; caught: boolean; bitsChanged: number }
export function verdict(orig: Played, tam: Played, scope: Scope, fn: HashFn): Verdict {
  const before = scopeDigest(orig, scope, fn), after = scopeDigest(tam, scope, fn);
  const bitsChanged = bitsDiffering(before, after);
  return { scope, hash: fn.id, before, after, caught: bitsChanged > 0, bitsChanged };
}

/** The real judge's answer on a log (src/sim/replay.ts): what a shared run is checked by. */
export const judge = (course: CourseData, log: InputLog): { cleared: boolean; ticks: number } => { const v = verifyLog(course, log); return { cleared: v.cleared, ticks: v.ticks }; };

// ---- avalanche: flip each single bit of an input in turn and count the bits of the digest that change ----
export interface Avalanche { id: HashId; bits: number; flips: number; mean: number; min: number; max: number; histogram: number[] }
export function avalanche(input: Uint8Array, fn: HashFn, maxFlips = 600): Avalanche {
  const base = fn.digest(input), total = input.length * 8;
  const step = Math.max(1, Math.floor(total / maxFlips));
  const counts: number[] = [];
  const copy = input.slice();
  for (let bit = 0; bit < total; bit += step) {
    copy[bit >> 3] ^= 1 << (bit & 7);
    counts.push(bitsDiffering(base, fn.digest(copy)));
    copy[bit >> 3] ^= 1 << (bit & 7);
  }
  const histogram = Array<number>(fn.bits + 1).fill(0);
  counts.forEach((c) => histogram[c]++);
  return { id: fn.id, bits: fn.bits, flips: counts.length, mean: counts.reduce((s, c) => s + c, 0) / counts.length, min: Math.min(...counts), max: Math.max(...counts), histogram };
}

// ---- the maths ----
/** Birthday bound: the chance that some two of k different inputs share one n-bit hash, 1 - exp(-k(k-1) / 2^(n+1)). */
export const collisionProb = (bits: number, k: number): number => -Math.expm1(-(k * (k - 1)) / 2 ** (bits + 1));
/** A fixed sample of the same sentence for a table: [k, probability]. */
export const COLLISION_TABLE = [10, 1000, 1e6];
