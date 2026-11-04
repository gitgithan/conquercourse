import type { CourseData } from '../../course/course';
import { playPlan } from '../../sim/ideal';
import { NO_INPUT, type RunnerInput } from '../../sim/runner';
import { newWorld, stepWorld, type WorldState } from '../../sim/world';
import { fnv1a32, sha256 } from '../hashing/core';

// Lab 19 (Same run, any machine). The pure part: replay one recorded run with the game's own simulator on simulated "machines",
// and look at it the way the game does: one small fingerprint (hash) per frame. A machine here is a short list of habits that real
// machines really have (a last-digit rounding habit, a frame clock that drifts, a map that is walked in another order).
// Nothing here draws anything. The simulator is src/sim/world.ts (unchanged); the machines nudge its output the way the habits would.
export const COURSES: readonly { id: string; file: string; title: string; planKey: string }[] = [
  { id: 'plank', file: 'plank.course.json', title: 'Plank bridge', planKey: 'plan plank.course.json' },
  { id: 'plank-two', file: 'plank-two.course.json', title: 'Plank bridge: thick, then thin', planKey: 'plan plank-two.course.json' },
  { id: 'drop', file: 'drop.course.json', title: 'Drop', planKey: 'plan drop.course.json' },
  { id: 'lache', file: 'lache.course.json', title: 'Swing (lache)', planKey: 'plan lache.course.json' },
];
export const DEFAULT_COURSE = 'plank';

export type Rounding = 'exact' | 'fused' | 'single';
export type Order = 'natural' | 'shuffled';
export interface Machine { name: string; rounding: Rounding; drift: number; order: Order; seed: number }
export interface Pins { fixed: boolean; ordered: boolean; grid: number | null } // grid: metres the hashed numbers are rounded to; null = off
export const NO_PINS: Pins = { fixed: false, ordered: false, grid: null };
export const GRIDS: readonly number[] = [1e-9, 1e-6, 1e-3, 1e-2, 1e-1];
export const CLEAN: Machine = { name: 'Reference', rounding: 'exact', drift: 0, order: 'natural', seed: 1 };
export const ROUNDINGS: Record<Rounding, string> = { exact: 'Exact (64-bit)', fused: 'Fused multiply-add', single: 'Single (32-bit, like many GPUs)' };

const mulberry = (seed: number) => {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};

/** The keys of a recorded plan, one per tick (what the game stores as the run). */
export function recordKeys(course: CourseData): RunnerInput[] {
  const keys: RunnerInput[] = [];
  playPlan(course, course.plan!, undefined, (_w, i) => { if (i) keys.push(i); });
  return keys;
}

/** What one frame of the run looks like to a fingerprint: the runner's own numbers, plus the mode and outcome words. */
export interface Snap { fields: Record<string, number | boolean | null | string>; x: number; y: number; vx: number; vy: number }
const FIELDS = ['tick', 'x', 'y', 'vx', 'vy', 'grounded', 'landedAtTick', 'landedAtX', 'splashed'] as const;
export function snapOf(w: WorldState): Snap {
  const r = w.runner as unknown as Record<string, number | boolean | null>;
  const fields: Snap['fields'] = {};
  for (const k of FIELDS) fields[k] = r[k] ?? null;
  fields.mode = w.mode; fields.outcome = w.outcome;
  return { fields, x: w.runner.x, y: w.runner.y, vx: w.runner.vx, vy: w.runner.vy };
}

export interface Raw { snaps: Snap[]; outcome: string; endX: number; ticks: number }
const ulp = (v: number) => Math.abs(v) * 2 ** -52;

/** One run on one machine. `fixed` is the pin "fixed step": the keys are read by tick count, never by the machine's frame clock. */
export function runMachine(course: CourseData, keys: RunnerInput[], m: Machine, fixed: boolean): Raw {
  let w = newWorld(course);
  const rnd = mulberry(m.seed * 7919 + 13);
  const snaps: Snap[] = [snapOf(w)];
  for (let i = 0; i < keys.length && w.outcome === 'running'; i++) {
    const idx = fixed ? i : i + Math.floor(i * m.drift); // a machine whose frame clock is late reads a later key
    w = stepWorld(w, keys[idx] ?? NO_INPUT, course);
    const r = w.runner;
    if (m.rounding === 'single') { r.x = Math.fround(r.x); r.y = Math.fround(r.y); r.vx = Math.fround(r.vx); r.vy = Math.fround(r.vy); }
    else if (m.rounding === 'fused') {
      if (rnd() < 0.5) r.x += (rnd() < 0.5 ? -1 : 1) * ulp(r.x);
      if (rnd() < 0.5) r.y += (rnd() < 0.5 ? -1 : 1) * ulp(r.y);
      if (rnd() < 0.5) r.vx += (rnd() < 0.5 ? -1 : 1) * ulp(r.vx);
      if (rnd() < 0.5) r.vy += (rnd() < 0.5 ? -1 : 1) * ulp(r.vy);
    }
    snaps.push(snapOf(w));
  }
  return { snaps, outcome: w.outcome, endX: w.runner.x, ticks: snaps.length };
}

/** The order a machine walks a state's keys in: the insertion order, or (for a machine whose maps are not ordered) its own shuffle. Sorted when the order is pinned. */
export function keyOrder(keys: readonly string[], m: Machine, pins: Pins): string[] {
  if (pins.ordered) return [...keys].sort();
  if (m.order === 'natural') return [...keys];
  const out = [...keys], rnd = mulberry(m.seed * 104729 + 7);
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
const fmt = (v: unknown, grid: number | null): string => typeof v === 'number' && grid ? String(Math.round(v / grid)) : String(v);
const enc = new TextEncoder();
/** The fingerprint of one frame: walk the keys in the machine's order, write name=value, hash the text (FNV-1a, 32 bits, 8 hex digits). */
export function frameHash(s: Snap, m: Machine, pins: Pins): string {
  const order = keyOrder(Object.keys(s.fields), m, pins);
  return fnv1a32(enc.encode(order.map((k) => `${k}=${fmt(s.fields[k], pins.grid)}`).join(';'))).toString(16).padStart(8, '0');
}
export const hashStrip = (raw: Raw, m: Machine, pins: Pins): string[] => raw.snaps.map((s) => frameHash(s, m, pins));

export interface Compare { frames: number; first: number | null; mismatches: number; maxDiff: number[]; sameOutcome: boolean; sameEnd: boolean; peak: number }
/** Frame by frame: where do the two strips first differ, and how far apart are the real numbers? A missing frame counts as a mismatch. */
export function compare(a: { raw: Raw; hashes: string[] }, b: { raw: Raw; hashes: string[] }): Compare {
  const frames = Math.max(a.hashes.length, b.hashes.length), maxDiff: number[] = [];
  let first: number | null = null, mismatches = 0, peak = 0;
  for (let i = 0; i < frames; i++) {
    const sa = a.raw.snaps[i], sb = b.raw.snaps[i];
    const d = sa && sb ? Math.max(Math.abs(sa.x - sb.x), Math.abs(sa.y - sb.y), Math.abs(sa.vx - sb.vx), Math.abs(sa.vy - sb.vy)) : Infinity;
    maxDiff.push(d); if (Number.isFinite(d)) peak = Math.max(peak, d);
    if (a.hashes[i] !== b.hashes[i]) { mismatches++; if (first === null) first = i; }
  }
  const round6 = (v: number) => Math.round(v * 1e6) / 1e6;
  return { frames, first, mismatches, maxDiff, sameOutcome: a.raw.outcome === b.raw.outcome, sameEnd: round6(a.raw.endX) === round6(b.raw.endX) && a.raw.ticks === b.raw.ticks, peak };
}

/** The four ways to say "these two runs match" (docs/lessons-cross-hardware-testing.md), each answered for one pair. */
export function levels(c: Compare): { id: number; name: string; ok: boolean }[] {
  return [
    { id: 1, name: 'Outcome: cleared or fell', ok: c.sameOutcome },
    { id: 2, name: 'Tick count and end place (6 decimals)', ok: c.sameOutcome && c.sameEnd },
    { id: 3, name: 'Every frame within 1e-9', ok: c.sameEnd && c.peak < 1e-9 && c.maxDiff.every(Number.isFinite) },
    { id: 4, name: 'Exact bits: every frame hash equal', ok: c.mismatches === 0 },
  ];
}

// ---- the recorded trace: the whole world after every tick, hashed once (the same recipe tests/sim-trace.test.ts uses) ----
/** `ticks:hash` of the plan's whole-world trace: SHA-256 over JSON.stringify(world) of the first world and of every tick, first 16 hex digits. */
export function traceOfPlan(course: CourseData): string {
  const parts: string[] = []; let n = 0;
  playPlan(course, course.plan!, undefined, (w) => { parts.push(JSON.stringify(w)); n++; });
  const hex = Array.from(sha256(enc.encode(parts.join('')))).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${n}:${hex.slice(0, 16)}`;
}

// ---- tiny worked examples of the habits ----
/** (1+e)(1-e) - 1: a fused multiply-add keeps the tiny part (-e*e), two roundings lose it. */
export function fmaExample(expo: number): { e: number; unfused: number; fused: number } {
  const e = 2 ** -expo;
  return { e, unfused: (1 + e) * (1 - e) - 1, fused: -(e * e) };
}
/** The same numbers added in three orders. */
export function sumOrders(xs: readonly number[]): { forward: number; backward: number; sorted: number; pairs: number } {
  const fwd = xs.reduce((s, v) => s + v, 0), back = [...xs].reverse().reduce((s, v) => s + v, 0);
  const sorted = [...xs].sort((a, b) => Math.abs(a) - Math.abs(b)).reduce((s, v) => s + v, 0);
  const pair = (a: readonly number[]): number => (a.length === 1 ? a[0] : a.length === 0 ? 0 : pair(a.slice(0, a.length >> 1)) + pair(a.slice(a.length >> 1)));
  return { forward: fwd, backward: back, sorted, pairs: pair(xs) };
}

// ---- the challenge ----
export interface Level { id: number; title: string; story: string; machines: Machine[] }
export const LEVELS: readonly Level[] = [
  { id: 1, title: 'Two laptops, one map', story: 'Same maths, but machine 2 walks the saved state in another order.', machines: [
    { ...CLEAN, name: 'Machine 1' }, { ...CLEAN, name: 'Machine 2', order: 'shuffled', seed: 2 }, { ...CLEAN, name: 'Machine 3', seed: 3 }] },
  { id: 2, title: 'A GPU in the mix', story: 'Machine 2 rounds once (fused). Machine 3 works in 32-bit numbers.', machines: [
    { ...CLEAN, name: 'Machine 1' }, { ...CLEAN, name: 'Machine 2', rounding: 'fused', order: 'shuffled', seed: 2 }, { ...CLEAN, name: 'Machine 3', rounding: 'single', seed: 3 }] },
  { id: 3, title: 'A slow screen', story: 'Machine 3 also has a frame clock that runs a little slow.', machines: [
    { ...CLEAN, name: 'Machine 1' }, { ...CLEAN, name: 'Machine 2', rounding: 'fused', order: 'shuffled', seed: 2 }, { ...CLEAN, name: 'Machine 3', rounding: 'single', drift: 0.004, seed: 3 }] },
];

export interface Judged { runs: { m: Machine; raw: Raw; hashes: string[] }[]; allAgree: boolean; first: number | null; mismatches: number[]; sameOutcome: boolean }
/** All machines against Machine 1, on every frame. They agree only when every strip is equal and every run ended the same way. */
export function judge(raws: Raw[], machines: Machine[], pins: Pins): Judged {
  const runs = machines.map((m, i) => ({ m, raw: raws[i], hashes: hashStrip(raws[i], m, pins) }));
  const cs = runs.slice(1).map((r) => compare(runs[0], r));
  const firsts = cs.map((c) => c.first).filter((v): v is number => v !== null);
  return { runs, allAgree: cs.every((c) => c.mismatches === 0 && c.sameOutcome), first: firsts.length ? Math.min(...firsts) : null, mismatches: cs.map((c) => c.mismatches), sameOutcome: cs.every((c) => c.sameOutcome) };
}
export const pinCount = (p: Pins): number => (p.fixed ? 1 : 0) + (p.ordered ? 1 : 0) + (p.grid ? 1 : 0);
export const allPins = (): Pins[] => {
  const out: Pins[] = [];
  for (const fixed of [false, true]) for (const ordered of [false, true]) for (const grid of [null, ...GRIDS]) out.push({ fixed, ordered, grid });
  return out;
};
/** The fewest pins that make a level agree on all frames (tried by brute force over every pin set and rounding grid), and which sets do it. */
export function fewestPins(course: CourseData, keys: RunnerInput[], level: Level): { fewest: number; sets: Pins[] } | null {
  const rawFree = level.machines.map((m) => runMachine(course, keys, m, false)), rawFixed = level.machines.map((m) => runMachine(course, keys, m, true));
  let best = Infinity; const sets: Pins[] = [];
  for (const p of allPins()) {
    if (!judge(p.fixed ? rawFixed : rawFree, level.machines, p).allAgree) continue;
    const n = pinCount(p);
    if (n < best) { best = n; sets.length = 0; }
    if (n === best) sets.push(p);
  }
  return best === Infinity ? null : { fewest: best, sets };
}
