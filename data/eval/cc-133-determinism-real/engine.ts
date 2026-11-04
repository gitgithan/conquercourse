// CC-133: the game's own golden-trace logic (tests/sim-trace.test.ts) as one file that runs on any JavaScript engine.
// For every course it replays the stored best line ("plan") and one seeded key mash, hashes the whole world after every tick,
// and returns the frame count, the whole-trace hash (same recipe as tests/golden/sim-trace.json) and one short fingerprint per frame.
import type { CourseData } from '../../../src/course/course';
import { playPlan } from '../../../src/sim/ideal';
import { newWorld, stepWorld } from '../../../src/sim/world';
import type { RunnerInput } from '../../../src/sim/runner';
import { fnv1a32, hex, sha256 } from '../../../src/labs/hashing/core';

const enc = new TextEncoder();
const mash = (seed: number) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

class Recorder {
  chunks: Uint8Array[] = []; frames: string[] = []; len = 0;
  add(world: unknown) { const b = enc.encode(JSON.stringify(world)); this.chunks.push(b); this.len += b.length; this.frames.push(fnv1a32(b).toString(16).padStart(8, '0')); }
  done(n: number, tag = '') {
    const all = new Uint8Array(this.len); let o = 0; for (const c of this.chunks) { all.set(c, o); o += c.length; }
    return { frames: n, trace: `${n}:${tag}${hex(sha256(all)).slice(0, 16)}`, frameHashes: this.frames.join('') };
  }
}

function planRun(course: CourseData) {
  const r = new Recorder(); let n = 0;
  playPlan(course, course.plan!, undefined, (w) => { r.add(w); n++; });
  return r.done(n);
}
function mashRun(course: CourseData, seed: number) {
  const rnd = mash(seed), r = new Recorder();
  let w = newWorld(course), hold: Partial<RunnerInput> = {}, n = 0;
  for (let i = 0; i < 2400 && w.outcome === 'running'; i++) {
    if (i % 24 === 0) hold = { run: rnd() < 0.85, left: rnd() < 0.05, squat: rnd() < 0.2, roll: rnd() < 0.1, slide: rnd() < 0.1, handL: rnd() < 0.5, handR: rnd() < 0.5, vault: rnd() < 0.15, up: rnd() < 0.3, fire: rnd() < 0.2, aimUp: rnd() < 0.2, aimDown: rnd() < 0.2 };
    const input = { run: false, jump: i % 36 === 0 && rnd() < 0.6, jumpSpeed: 5 + rnd() * 3, squat: false, ...hold } as RunnerInput;
    w = stepWorld(w, input, course); r.add(w); n++;
  }
  return r.done(n, `${w.outcome}:`);
}

export function runAll(list: { name: string; course: CourseData }[]) {
  const out: Record<string, { frames: number; trace: string; frameHashes: string }> = {};
  for (const { name, course } of list) {
    if (course.plan) out[`plan ${name}`] = planRun(course);
    out[`mash1 ${name}`] = mashRun(course, 1);
  }
  return out;
}
// One fingerprint per Math function over 20,000 fixed inputs: tells which functions round their last digit another way on this engine.
const probe = () => {
  const fns: Record<string, (x: number) => number> = { sin: Math.sin, cos: Math.cos, tan: Math.tan, exp: Math.exp, log: (x) => Math.log(x + 1.5), atan: Math.atan, atan2: (x) => Math.atan2(x, 0.7), asin: (x) => Math.asin(x / 3), acos: (x) => Math.acos(x / 3), pow: (x) => Math.pow(x + 3.1, 1.5), sqrt: (x) => Math.sqrt(x + 3), hypot: (x) => Math.hypot(x, 1.3), tanh: Math.tanh, cbrt: Math.cbrt };
  const out: Record<string, string> = {}, f64 = new Float64Array(1), u = new Uint32Array(f64.buffer);
  for (const [k, f] of Object.entries(fns)) { let h = 0x811c9dc5; for (let i = 0; i < 20000; i++) { f64[0] = f((i - 10000) * 0.00123 + 0.0007); h = Math.imul(h ^ u[0], 16777619) >>> 0; h = Math.imul(h ^ u[1], 16777619) >>> 0; } out[k] = h.toString(16).padStart(8, '0'); }
  return out;
};
export const engineInfo = () => ({ ua: typeof navigator !== 'undefined' ? navigator.userAgent : `node ${process.version} v8 ${process.versions.v8}`, math: probe() });
(globalThis as Record<string, unknown>).determinismReal = { runAll, engineInfo };
