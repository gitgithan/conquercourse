import { DEFAULT_HANG, EASE_TICKS, bodyVelocity, feetOf, gripSlips, handOffset, hangStep, releaseHang, tryGrab, type Hang, type HangParams, type Hold } from './holds';

// Monkey bars: a row of rungs overhead, crossed hand over hand (docs/bars.md). The body hangs from the hands as in src/sim/holds.ts;
// two reach keys put the left and the right hand on the next rung, and the swing decides whether the arm gets there.
// Everything is a metre or a second, stepped at the fixed 120 Hz, and a run is its keys (reachL and reachR are two bits in the replay mask).
export interface BarRun { x: number; y: number; n: number; gap: number } // first rung's place along the run, height, rungs, spacing (m)

export interface BarsParams {
  arm: number; // m, from the shoulder to the hand: a straight arm reaches this far about the shoulder
  keep: number; // share of the swing speed kept when a hand catches a rung (the catch absorbs the rest)
  hang: HangParams; // the pendulum is the same body as on a bar
}
export const DEFAULT_BARS: BarsParams = { arm: 0.7, keep: 0.93, hang: DEFAULT_HANG };
export const GAP_MIN = 0.3, GAP_MAX = 1.0; // m, what the editor allows between rungs

export interface BarsHang {
  run: number; // index into the course's bar rows
  l: number; // rung under the left hand
  r: number; // rung under the right hand
  last: 0 | 1 | 2; // the hand that reached last (1 left, 2 right, 0 none yet): the next reach must be the other
  pl: boolean; // reachL was down on the last tick (a reach needs a fresh press)
  pr: boolean;
  theta: number; omega: number; ox: number; oy: number; et: number; // the pendulum, as Hang
  reaches: number; // successful reaches so far
}

export type BarsEvent = { type: 'bars-reach' | 'bars-stall'; hand: 1 | 2; why?: 'order' | 'swing' | 'end' | 'both'; rung?: number };
export interface BarsStep { s: BarsHang; events: BarsEvent[] }

export const rungX = (r: BarRun, i: number): number => r.x + i * r.gap;
export const pivotOf = (r: BarRun, s: Pick<BarsHang, 'l' | 'r'>): Hold => ({ x: (rungX(r, s.l) + rungX(r, s.r)) / 2, y: r.y });
const asHang = (s: BarsHang): Hang => ({ hold: 0, theta: s.theta, omega: s.omega, ox: s.ox, oy: s.oy, et: s.et });

// Can this hand reach its next rung now? The shoulder is `arm` down the body from the point between the hands; a straight arm
// reaches a circle of radius `arm` about it, so a rung at the height of the hands is within reach when it is between 0 and 2 arm sin(theta) ahead.
// It needs a forward swing (angle ahead of the hang and speed forward), so the swing carries the hand there.
export function canReach(run: BarRun, s: BarsHang, hand: 1 | 2, p: BarsParams = DEFAULT_BARS): { ok: boolean; why?: 'order' | 'swing' | 'end' } {
  if (s.last === hand) return { ok: false, why: 'order' };
  const next = (hand === 1 ? s.l : s.r) + 1;
  if (next >= run.n) return { ok: false, why: 'end' };
  const dx = rungX(run, next) - pivotOf(run, s).x;
  const sin = Math.sin(s.theta);
  if (s.theta <= 0 || s.omega < 0 || dx < 0 || dx > 2 * p.arm * sin) return { ok: false, why: 'swing' };
  return { ok: true };
}

// The first grab, from the air: the nearest rung within the same forgiving zone as a bar (src/sim/holds.ts). Both hands close on it.
export function tryGrabBars(runs: BarRun[], x: number, y: number, vx: number, vy: number, again: boolean, p: BarsParams = DEFAULT_BARS, reach = p.hang.reach): BarsHang | null {
  const holds: Hold[] = [], owner: { run: number; i: number }[] = [];
  runs.forEach((r, k) => { for (let i = 0; i < r.n; i++) { holds.push({ x: rungX(r, i), y: r.y }); owner.push({ run: k, i }); } });
  const g = tryGrab(holds, x, y, vx, vy, { ...p.hang, reach }, again);
  if (!g) return null;
  const o = owner[g.hold];
  return { run: o.run, l: o.i, r: o.i, last: 0, pl: true, pr: true, theta: g.theta, omega: g.omega, ox: g.ox ?? 0, oy: g.oy ?? 0, et: g.et ?? 0, reaches: 0 };
}

// One tick. `pump` is the kip (+1 forward arrow, -1 back arrow); reachL and reachR are the held states of the two reach keys.
export function barsStep(s: BarsHang, run: BarRun, reachL: boolean, reachR: boolean, pump: number, p: BarsParams = DEFAULT_BARS): BarsStep {
  const events: BarsEvent[] = [];
  const freshL = reachL && !s.pl, freshR = reachR && !s.pr;
  let n: BarsHang = { ...s, pl: reachL, pr: reachR };
  const press: (1 | 2)[] = freshL && freshR ? [] : freshL ? [1] : freshR ? [2] : [];
  if (freshL && freshR) events.push({ type: 'bars-stall', hand: 1, why: 'both' });
  for (const hand of press) {
    const c = canReach(run, n, hand, p);
    if (!c.ok) { events.push({ type: 'bars-stall', hand, why: c.why }); continue; }
    const before = pivotOf(run, n);
    const o = handOffset(asHang(n));
    n = hand === 1 ? { ...n, l: n.l + 1 } : { ...n, r: n.r + 1 };
    n.last = hand;
    const after = pivotOf(run, n);
    n.ox = o.x + (before.x - after.x); n.oy = o.y; n.et = EASE_TICKS; // the pivot moves on; the body is carried over to it, not thrown
    n.omega *= p.keep;
    n.reaches++;
    events.push({ type: 'bars-reach', hand, rung: hand === 1 ? n.l : n.r });
  }
  const h = hangStep(asHang(n), pump, p.hang);
  return { s: { ...n, theta: h.theta, omega: h.omega, et: h.et ?? 0 }, events };
}

export const barsFeet = (run: BarRun, s: BarsHang, p: BarsParams = DEFAULT_BARS): { x: number; y: number } => feetOf(pivotOf(run, s), asHang(s), p.hang);
export const barsVelocity = (s: BarsHang, p: BarsParams = DEFAULT_BARS): { vx: number; vy: number } => bodyVelocity(asHang(s), p.hang);
export const barsSlips = (s: BarsHang, p: BarsParams = DEFAULT_BARS): boolean => gripSlips(asHang(s), p.hang);
export const barsRelease = (run: BarRun, s: BarsHang, p: BarsParams = DEFAULT_BARS) => releaseHang(pivotOf(run, s), asHang(s), p.hang);

// The swing's energy per unit mass and length (what the pendulum keeps without a kip): the tests use it to show that no reach makes energy.
export const swingEnergy = (s: Pick<BarsHang, 'theta' | 'omega'>, p: BarsParams = DEFAULT_BARS): number => {
  const L = (2 / 3) * p.hang.handHeight;
  return 0.5 * s.omega * s.omega + (p.hang.gravity / L) * (1 - Math.cos(s.theta));
};
