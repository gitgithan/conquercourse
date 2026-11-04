import { DEFAULT_HANG, EASE_TICKS, bodyVelocity, feetOf, gripSlips, handOffset, hangStep, releaseHang, tryGrab, type Hang, type HangParams, type Hold } from './holds';

// Monkey bars: a row of rungs overhead, crossed hand over hand (docs/bars.md). The body hangs from the hands as in src/sim/holds.ts;
// two reach keys put the left and the right hand on the next rung, and the swing decides whether the arm gets there.
// Everything is a metre or a second, stepped at the fixed 120 Hz, and a run is its keys (reachL and reachR are two bits in the replay mask).
export interface BarRun { x: number; y: number; n: number; gap: number } // first rung's place along the run, height, rungs, spacing (m)

export interface BarsParams {
  arm: number; // m, from the shoulder to the hand: a straight arm reaches this far about the shoulder
  rhythm: number; // extra share of the swing speed kept for each reach in an unbroken Q, T, Q, T chain (the catch gets smoother; a chain never adds speed, it only stops losing it)
  keep: number; // share of the swing speed kept when a hand catches a rung (the catch absorbs the rest)
  hang: HangParams; // the pendulum is the same body as on a bar
}
export const DEFAULT_BARS: BarsParams = { arm: 0.8, keep: 0.93, rhythm: 0.015, hang: DEFAULT_HANG };
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
  streak?: number; // reaches in a row without a stall: a smooth chain keeps more of the swing at each catch
}

export type BarsEvent = { type: 'bars-reach' | 'bars-stall'; hand: 1 | 2; why?: 'order' | 'swing' | 'end' | 'both'; rung?: number };
export interface BarsStep { s: BarsHang; events: BarsEvent[] }

export const rungX = (r: BarRun, i: number): number => r.x + i * r.gap;
export const pivotOf = (r: BarRun, s: Pick<BarsHang, 'l' | 'r'>): Hold => ({ x: (rungX(r, s.l) + rungX(r, s.r)) / 2, y: r.y });
const asHang = (s: BarsHang): Hang => ({ hold: 0, theta: s.theta, omega: s.omega, ox: s.ox, oy: s.oy, et: s.et });

// The rung a hand takes when it reaches: the one just past the front hand, so the hands leapfrog (the back hand overtakes the front one).
// On the last rung there is nothing past it: the hand that is still behind closes on the last rung and the run is done (both hands on the last rung).
export const targetRung = (run: BarRun, s: Pick<BarsHang, 'l' | 'r'>): number => Math.min(Math.max(s.l, s.r) + 1, run.n - 1);
// The hand whose turn it is: the one that did not reach last. A hand already on the last rung has no turn: the other hand goes.
export function nextHand(run: BarRun, s: Pick<BarsHang, 'l' | 'r' | 'last'>): 1 | 2 | null {
  const lEnd = s.l >= run.n - 1, rEnd = s.r >= run.n - 1;
  if (lEnd && rEnd) return null;
  if (lEnd) return 2;
  if (rEnd) return 1;
  return s.last === 1 ? 2 : 1;
}

// Can this hand reach its target rung now? The shoulder is `arm` down the body from the point between the hands; a straight arm
// reaches a circle of radius `arm` about it, so a rung at the height of the hands is within reach when it is between 0 and 2 arm sin(theta) ahead.
// It needs the body swung forward of the hang (theta > 0); the bigger the swing the farther the arm goes, so a big pump first makes a fast chain possible.
// It does not matter which way the body is moving: a player may alternate as fast as they like while the swing is big enough.
export function canReach(run: BarRun, s: BarsHang, hand: 1 | 2, p: BarsParams = DEFAULT_BARS): { ok: boolean; why?: 'order' | 'swing' | 'end' } {
  const own = hand === 1 ? s.l : s.r;
  if (own >= run.n - 1) return { ok: false, why: 'end' };
  if (nextHand(run, s) !== hand) return { ok: false, why: 'order' };
  const dx = rungX(run, targetRung(run, s)) - pivotOf(run, s).x;
  const sin = Math.sin(s.theta);
  if (s.theta <= 0 || dx < 0 || dx > 2 * p.arm * sin) return { ok: false, why: 'swing' };
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
  if (freshL && freshR) { events.push({ type: 'bars-stall', hand: 1, why: 'both' }); n = { ...n, streak: 0 }; }
  for (const hand of press) {
    const c = canReach(run, n, hand, p);
    if (!c.ok) { events.push({ type: 'bars-stall', hand, why: c.why }); n = { ...n, streak: 0 }; continue; }
    const before = pivotOf(run, n);
    const o = handOffset(asHang(n));
    const to = targetRung(run, n);
    n = hand === 1 ? { ...n, l: to } : { ...n, r: to };
    n.last = hand;
    const after = pivotOf(run, n);
    n.ox = o.x + (before.x - after.x); n.oy = o.y; n.et = EASE_TICKS; // the pivot moves on; the body is carried over to it, not thrown
    n.streak = (n.streak ?? 0) + 1;
    n.omega *= Math.min(1, p.keep + p.rhythm * (n.streak - 1));
    n.reaches++;
    events.push({ type: 'bars-reach', hand, rung: to });
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
