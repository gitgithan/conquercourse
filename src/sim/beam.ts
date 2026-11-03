import type { CourseData } from '../course/course';
import { DT, GRAVITY } from './units';
import { DEFAULT_PARAMS, type RunnerInput } from './runner';
import { standingOn } from './terrain';
import type { GameEvent, WorldState } from './world';

// The plank bridge: a plank laid across a gap, held at its two ends (and, if asked, by a post in the middle).
// The runner is a load that walks along it. The plank bends under the load (it sags) and breaks if the bending is too much.
// Euler-Bernoulli beam, simply supported, Earth gravity only; every number is a metre, a second or a kilogram.
//   sag under a load F in the middle of a span L:   F L^3 / (48 E I)   (E: how stiff the material is, I: how stiff the cross-section is)
//   I of a rectangular plank:                       width x thickness^3 / 12
//   bending stress in the outer face:               M (thickness / 2) / I, with M = F L / 4 in the middle
// Simplifications (stated, not hidden): the load is the rider's weight applied slowly (no extra push from running or jumping);
// a post in the middle turns the plank into two planks that meet on the post (the continuous-beam gain is ignored, so a post helps slightly less than in a real plank);
// the plank's own weight is spread evenly; no creep, no knots, no damage from earlier crossings.

export type Material = 'wood' | 'steel';

// Plain numbers for two materials. Sources: US Forest Products Laboratory, Wood Handbook (pine: modulus of elasticity about 9 GPa,
// bending strength about 40 MPa, density about 500 kg/m3); mild structural steel (E 200 GPa, yield 250 MPa, density 7850 kg/m3).
export const MATERIALS: Record<Material, { label: string; E: number; strength: number; density: number }> = {
  wood: { label: 'Pine plank', E: 9e9, strength: 40e6, density: 500 },
  steel: { label: 'Steel plate', E: 200e9, strength: 250e6, density: 7850 },
};

export const RIDER_MASS = 70; // kg
export const SAG_NOTE = 0.15; // m, from this much sag the plank is reported as sagging
export const DISPLAY_SAG_MAX = 1.5; // m, the drawing never bends further than this (the plank has broken long before)

export interface PlankData {
  x0: number; x1: number; // m along the run: where the plank rests on the two decks
  y: number; // m, the height of the top face when unloaded and level (the decks)
  thickness: number; // m
  width: number; // m, across the lane
  material?: Material;
  support?: boolean; // a post in the middle
}

export const materialOf = (pk: PlankData) => MATERIALS[pk.material ?? 'wood'];
export const secondMoment = (pk: PlankData): number => (pk.width * pk.thickness * pk.thickness * pk.thickness) / 12; // m^4
export const spanOf = (pk: PlankData): number => pk.x1 - pk.x0;
export const weightPerMetre = (pk: PlankData): number => materialOf(pk).density * pk.width * pk.thickness * GRAVITY; // N/m

// One segment of the plank: from where it starts (m from the left end) and how long it is.
interface Seg { s0: number; l: number }
function segOf(pk: PlankData, x: number): Seg {
  const L = spanOf(pk);
  if (!pk.support) return { s0: 0, l: L };
  return x < L / 2 ? { s0: 0, l: L / 2 } : { s0: L / 2, l: L / 2 };
}

// Sag (m, downward) at x (m from the left end) with the rider standing at a (m from the left end; a < 0: nobody on the plank), self-weight included.
export function sagAt(pk: PlankData, a: number, x: number, mass: number = RIDER_MASS): number {
  const EI = materialOf(pk).E * secondMoment(pk);
  const seg = segOf(pk, x), l = seg.l, xl = x - seg.s0;
  // own weight, spread evenly: q x (l^3 - 2 l x^2 + x^3) / (24 EI)
  const q = weightPerMetre(pk);
  let d = (q * xl * (l * l * l - 2 * l * xl * xl + xl * xl * xl)) / (24 * EI);
  // the rider, if on this segment: a point load
  if (a >= 0 && a <= spanOf(pk) && segOf(pk, a).s0 === seg.s0) {
    const F = mass * GRAVITY, al = a - seg.s0, b = l - al;
    d += xl <= al ? (F * b * xl * (l * l - b * b - xl * xl)) / (6 * EI * l) : (F * al * (l - xl) * (l * l - al * al - (l - xl) * (l - xl))) / (6 * EI * l);
  }
  return d;
}

// The largest bending moment (N m) anywhere on the plank with the rider at a.
export function maxMoment(pk: PlankData, a: number, mass: number = RIDER_MASS): number {
  const q = weightPerMetre(pk), F = mass * GRAVITY, L = spanOf(pk);
  let best = 0;
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const x = (L * i) / N;
    const seg = segOf(pk, Math.min(x, L - 1e-9)), l = seg.l, xl = x - seg.s0;
    let M = (q * xl * (l - xl)) / 2;
    if (a >= 0 && segOf(pk, Math.min(a, L - 1e-9)).s0 === seg.s0) {
      const al = a - seg.s0, b = l - al;
      M += xl <= al ? (F * b * xl) / l : (F * al * (l - xl)) / l;
    }
    best = Math.max(best, M);
  }
  return best;
}

// Stress in the outer face as a share of the material's bending strength: 1 and over means it breaks.
export function stressRatio(pk: PlankData, a: number, mass: number = RIDER_MASS): number {
  const sigma = (maxMoment(pk, a, mass) * (pk.thickness / 2)) / secondMoment(pk);
  return sigma / materialOf(pk).strength;
}

// The worst case over every place the rider can stand.
export function worstCase(pk: PlankData, mass: number = RIDER_MASS): { sag: number; ratio: number; at: number } {
  const L = spanOf(pk);
  let sag = 0, ratio = 0, at = 0;
  for (let i = 0; i <= 40; i++) {
    const a = (L * i) / 40;
    const r = stressRatio(pk, a, mass), s = sagAt(pk, a, a, mass);
    if (r > ratio) { ratio = r; at = a; }
    sag = Math.max(sag, s);
  }
  return { sag, ratio, at };
}

export const plankHolds = (pk: PlankData, mass: number = RIDER_MASS): boolean => worstCase(pk, mass).ratio < 1;

// Height of the top face at x with the rider at a (for the drawing and for the feet).
export const topAt = (pk: PlankData, a: number, x: number): number => pk.y - Math.min(DISPLAY_SAG_MAX, sagAt(pk, a, x - pk.x0));

// The picture of the bend follows the physical bend with a short lag, so a plank that loads suddenly (a landing in the middle) is not drawn jumping down in one frame.
// Looks only: the physics above is not touched, and a plank the runner runs onto at its end already bends slowly enough that the lag is hardly seen.
export const BEND_EASE_S = 0.18; // seconds: the drawn bend closes 63% of the way to the physical bend in this time
export const easeToward = (cur: number, target: number, dt: number, tau: number = BEND_EASE_S): number => target + (cur - target) * Math.exp(-Math.max(0, dt) / tau);
export const BEND_POINTS = 40; // the drawn plank is a strip of this many pieces
export const bendTarget = (pk: PlankData, a: number, i: number): number => Math.min(DISPLAY_SAG_MAX, sagAt(pk, a, (spanOf(pk) * i) / BEND_POINTS));
export const restBend = (pk: PlankData): number[] => Array.from({ length: BEND_POINTS + 1 }, (_, i) => bendTarget(pk, -1, i)); // nobody on it: its own weight
// One frame of easing: the drawn bend (sag at each point along the plank) moves toward the physical bend for a rider at a (a < 0: nobody on it).
export function easeBend(drawn: number[], pk: PlankData, a: number, dt: number): number[] {
  return drawn.map((d, i) => easeToward(d, bendTarget(pk, a, i), dt));
}
// The drawn surface height at x (m from the left end), between the points of the drawn bend.
export function drawnTopAt(pk: PlankData, drawn: number[], x: number): number {
  const u = Math.min(BEND_POINTS, Math.max(0, (x / spanOf(pk)) * BEND_POINTS)), i = Math.min(BEND_POINTS - 1, Math.floor(u)), f = u - i;
  return pk.y - (drawn[i] * (1 - f) + drawn[i + 1] * f);
}

// The smallest change that makes a plank hold with a margin (so it is not on the edge): a thicker plank, or a post in the middle.
export function fixPlank(pk: PlankData, margin = 0.8): { plank: PlankData; steps: string[]; ok: boolean } {
  if (worstCase(pk).ratio <= margin) return { plank: pk, steps: [], ok: true };
  let t = pk.thickness;
  for (let i = 0; i < 80 && worstCase({ ...pk, thickness: t }).ratio > margin; i++) t = Math.round((t + 0.002) * 1000) / 1000;
  const thicker = { ...pk, thickness: t };
  const withPost = { ...pk, support: true };
  const postOk = !pk.support && worstCase(withPost).ratio <= margin;
  const mat = pk.material ?? 'wood';
  if (postOk && (t > pk.thickness * 1.5 || t > 0.08)) return { plank: withPost, steps: ['Put a post under the middle of the plank.'], ok: true };
  if (t <= 0.08) return { plank: thicker, steps: [`Use a ${mat === 'wood' ? 'plank' : 'plate'} ${(t * 100).toFixed(1)} cm thick (it is ${(pk.thickness * 100).toFixed(1)} cm now).`], ok: true };
  if (postOk) return { plank: withPost, steps: ['Put a post under the middle of the plank.'], ok: true };
  return { plank: pk, steps: ['No plank this thin and this long can hold: shorten the gap, or add a post and use thicker planks.'], ok: false };
}

// ---- the plank in the world ----

export interface PlankState { i: number; v: number; sagged: boolean } // which plank, the speed along it

const SAG_LOSS = 1.0; // 1/s per metre of sag: a plank that dips takes some of the runner's speed (the plank shakes it away)

// Hands the runner over to a plank when the feet reach its start (or land on it): returns the next state, or null.
export function maybeEnterPlank(w: WorldState, input: RunnerInput, course: CourseData): WorldState | null {
  const planks = course.planks;
  if (!planks || w.mode !== 'run') return null;
  const r = w.runner;
  for (let i = 0; i < planks.length; i++) {
    const pk = planks[i];
    if (w.broken?.includes(i)) continue;
    const nx = r.x + r.vx * DT;
    const onTop = r.grounded && Math.abs(r.y - pk.y) < 0.1 && nx >= pk.x0 - 1e-6 && r.x < pk.x1 && r.x > pk.x0 - 0.6;
    const landing = !r.grounded && r.vy <= 0 && r.x > pk.x0 && r.x < pk.x1 && r.y + r.vy * DT <= pk.y && r.y >= pk.y - 0.2;
    if (onTop || landing) {
      const entered: WorldState = { ...w, mode: 'plank', plank: { i, v: r.vx, sagged: false }, runner: { ...r, grounded: true, vy: 0 } };
      return stepPlankWorld(entered, input, course);
    }
  }
  return null;
}

export function stepPlankWorld(w: WorldState, input: RunnerInput, course: CourseData): WorldState {
  const st = w.plank!, pk = course.planks![st.i];
  const tick = w.runner.tick + 1;
  const events: GameEvent[] = [];
  const p = DEFAULT_PARAMS;
  const tau = p.topSpeed / p.acceleration;
  // the legs: the same push as on the ground
  let v = st.v;
  const run = input.run && !input.left, back = input.left && !input.run;
  if (run) v += ((p.topSpeed - v) / tau) * DT;
  else if (back) v += ((-p.topSpeed - v) / tau) * DT;
  else v -= v * Math.min(1, 3 * DT);
  // the dip: climbing out of it costs speed, and a plank that is shaking takes some away
  const a0 = w.runner.x - pk.x0;
  const slope = (topAt(pk, a0 + 0.05, pk.x0 + a0 + 0.05) - topAt(pk, a0 - 0.05, pk.x0 + a0 - 0.05)) / 0.1;
  const sag0 = sagAt(pk, a0, a0);
  v += -GRAVITY * Math.sin(Math.atan(slope)) * DT;
  v -= v * SAG_LOSS * sag0 * DT;
  let x = w.runner.x + v * DT;
  const a = x - pk.x0;
  // the jump leaves the plank
  if (input.jump) {
    events.push({ tick, type: 'jump', detail: { vy: course.jumpSpeed, vx: v, x } });
    return { ...w, mode: 'run', plank: null, events, runner: { ...w.runner, tick, x, y: topAt(pk, a, x), vx: v, vy: course.jumpSpeed, grounded: false, landedAtTick: null, landedAtX: null } };
  }
  // the far end: back on a deck
  if (x >= pk.x1 || x <= pk.x0) {
    const side = x >= pk.x1 ? pk.x1 : pk.x0;
    const deck = standingOn(course.terrain, side + (side === pk.x1 ? 0.02 : -0.02));
    events.push({ tick, type: 'plank-off', detail: { x: side } });
    return { ...w, mode: 'run', plank: null, events, runner: { ...w.runner, tick, x, y: deck ? deck.top : pk.y, vx: v, vy: 0, grounded: !!deck, landedAtTick: null, landedAtX: null } };
  }
  // too much bending: it breaks under the feet
  const ratio = stressRatio(pk, a);
  if (ratio >= 1) {
    events.push({ tick, type: 'plank-break', detail: { x, at: a, ratio, sag: sagAt(pk, a, a) } });
    return { ...w, mode: 'run', plank: null, broken: [...(w.broken ?? []), st.i], events, runner: { ...w.runner, tick, x, y: topAt(pk, a, x), vx: v, vy: -1.2, grounded: false, landedAtTick: null, landedAtX: null } };
  }
  const sag = sagAt(pk, a, a);
  let sagged = st.sagged;
  if (!sagged && sag >= SAG_NOTE) { sagged = true; events.push({ tick, type: 'plank-sag', detail: { x, sag, ratio } }); }
  const y = topAt(pk, a, x);
  const vy = (y - w.runner.y) / DT;
  return { ...w, plank: { i: st.i, v, sagged }, events, runner: { ...w.runner, tick, x, y, vx: v, vy, grounded: true } };
}
