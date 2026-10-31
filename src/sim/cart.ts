import type { CourseData } from '../course/course';
import { DT, GRAVITY } from './units';
import type { RunnerInput } from './runner';
import type { GameEvent, WorldState } from './world';

// The cart: the runner sits in a cart that rolls along a smooth track (a coaster). Nothing drives it but gravity:
// height is stored speed. It stays on the rails while the track pushes up on it; over a crest that bends away faster than gravity can
// follow, the track stops pushing and the cart flies on as a projectile. On a hill it cannot climb, it stops and rolls back.
// Everything is a metre, a second or a kilogram; the cart is integrated with RK4 at the fixed step like the rope and the bars.

export interface TrackData {
  pts: [number, number][]; // where the track passes: [x, height] seen from the side, x rising; a smooth curve goes through them
  segments?: [number, number][][]; // separate rail splines, ordered from the start; the cart may fly between them
  push?: number; // m/s the first push gives (a shove at the top of the first hill)
}

export const trackSegments = (t: TrackData): [number, number][][] => t.segments?.length ? t.segments : [t.pts];

export interface CartParams {
  rolling: number; // rolling resistance (share of the weight along the track)
  drag: number; // 1/m, air drag on the speed squared
  brake: number; // m/s², what holding the brake takes off the speed
  seat: number; // m, the feet's height above the rails (the rider sits in the cart)
  push: number; // m/s, a push at the start
  gravity: number;
}

export const DEFAULT_CART: CartParams = { rolling: 0.012, drag: 0.0015, brake: 4.5, seat: 0.45, push: 1.5, gravity: GRAVITY };

export interface Cart {
  segment: number; // which disconnected rail spline the cart is currently riding
  x: number; // m along the run (the rails are a function of x)
  v: number; // m/s along the rails, positive toward +x
  started: boolean; // has the first push been given
  stalledAt: number | null; // tick of the turn-round on a hill the cart could not climb
  tilt: number; // rad, how steeply the rails rise here (the cart and the rider lean with it)
}

// A smooth curve through the points: a natural cubic spline, so the slope and the bend are continuous.
export interface Rails {
  x0: number; x1: number;
  y(x: number): number;
  slope(x: number): number; // dy/dx
  bend(x: number): number; // d²y/dx²
}

export function makeRails(pts: [number, number][]): Rails {
  const p = [...pts].sort((a, b) => a[0] - b[0]);
  const n = p.length;
  const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
  const M = new Array<number>(n).fill(0); // second derivatives at the points; zero at both ends (natural)
  if (n > 2) {
    const h = xs.slice(1).map((x, i) => x - xs[i]);
    const a = new Array<number>(n).fill(0), b = new Array<number>(n).fill(1), c = new Array<number>(n).fill(0), d = new Array<number>(n).fill(0);
    for (let i = 1; i < n - 1; i++) {
      a[i] = h[i - 1]; b[i] = 2 * (h[i - 1] + h[i]); c[i] = h[i];
      d[i] = 6 * ((ys[i + 1] - ys[i]) / h[i] - (ys[i] - ys[i - 1]) / h[i - 1]);
    }
    for (let i = 1; i < n; i++) { const w = a[i] / b[i - 1]; b[i] -= w * c[i - 1]; d[i] -= w * d[i - 1]; } // forward sweep
    M[n - 1] = d[n - 1] / b[n - 1];
    for (let i = n - 2; i >= 0; i--) M[i] = (d[i] - c[i] * M[i + 1]) / b[i];
  }
  const seg = (x: number): number => {
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    return i;
  };
  const clampX = (x: number) => Math.min(Math.max(x, xs[0]), xs[n - 1]);
  return {
    x0: xs[0], x1: xs[n - 1],
    y(x) {
      if (n < 2) return ys[0] ?? 0;
      x = clampX(x); const i = seg(x), h = xs[i + 1] - xs[i], l = xs[i + 1] - x, r = x - xs[i];
      return (M[i] * l ** 3) / (6 * h) + (M[i + 1] * r ** 3) / (6 * h) + (ys[i] / h - (M[i] * h) / 6) * l + (ys[i + 1] / h - (M[i + 1] * h) / 6) * r;
    },
    slope(x) {
      if (n < 2) return 0;
      x = clampX(x); const i = seg(x), h = xs[i + 1] - xs[i], l = xs[i + 1] - x, r = x - xs[i];
      return (-M[i] * l * l) / (2 * h) + (M[i + 1] * r * r) / (2 * h) - (ys[i] / h - (M[i] * h) / 6) + (ys[i + 1] / h - (M[i + 1] * h) / 6);
    },
    bend(x) {
      if (n < 2) return 0;
      x = clampX(x); const i = seg(x), h = xs[i + 1] - xs[i];
      return (M[i] * (xs[i + 1] - x)) / h + (M[i + 1] * (x - xs[i])) / h;
    },
  };
}

const railsCache = new WeakMap<object, Rails>();
export function railsOf(t: TrackData, segment = 0): Rails {
  let r = railsCache.get(t);
  if (!r) { r = makeRails(t.pts); railsCache.set(t, r); }
  if (segment === 0 && !t.segments?.length) return r;
  const perTrack = railsSetsCache.get(t) ?? trackSegments(t).map(makeRails);
  railsSetsCache.set(t, perTrack);
  return perTrack[segment] ?? perTrack[0];
}

const railsSetsCache = new WeakMap<object, Rails[]>();

// How hard the rails push up on the cart, per kilogram: the weight across the slope plus the push of a valley, minus the lift of a crest.
// At zero or below the cart is no longer held on and leaves the track.
export function railPush(rails: Rails, x: number, v: number, g: number = GRAVITY): number {
  const s = rails.slope(x), c = 1 / Math.sqrt(1 + s * s);
  const kappa = rails.bend(x) * c ** 3;
  return g * c + kappa * v * v;
}

// The speed along the rails at which a crest of this bend lets go (the cart would leave the track above it).
export function crestSpeedLimit(rails: Rails, x: number, g: number = GRAVITY): number {
  const s = rails.slope(x), c = 1 / Math.sqrt(1 + s * s), kappa = rails.bend(x) * c ** 3;
  return kappa < 0 ? Math.sqrt((g * c) / -kappa) : Infinity;
}

// One RK4 step along the rails. `brake` is held. Returns the new x and speed.
export function cartStep(rails: Rails, x: number, v: number, brake: boolean, p: CartParams = DEFAULT_CART): { x: number; v: number } {
  const acc = (xx: number, vv: number): number => {
    const s = rails.slope(xx), c = 1 / Math.sqrt(1 + s * s), sinPhi = s * c;
    const smooth = Math.tanh(vv / 0.05); // resistance opposes the motion, and fades to nothing at rest (no jitter)
    return -p.gravity * sinPhi - p.rolling * p.gravity * c * smooth - p.drag * vv * Math.abs(vv) - (brake ? p.brake * smooth : 0);
  };
  const vel = (xx: number, vv: number): number => vv / Math.sqrt(1 + rails.slope(xx) ** 2);
  const k1x = vel(x, v), k1v = acc(x, v);
  const k2x = vel(x + 0.5 * DT * k1x, v + 0.5 * DT * k1v), k2v = acc(x + 0.5 * DT * k1x, v + 0.5 * DT * k1v);
  const k3x = vel(x + 0.5 * DT * k2x, v + 0.5 * DT * k2v), k3v = acc(x + 0.5 * DT * k2x, v + 0.5 * DT * k2v);
  const k4x = vel(x + DT * k3x, v + DT * k3v), k4v = acc(x + DT * k3x, v + DT * k3v);
  return { x: x + (DT / 6) * (k1x + 2 * k2x + 2 * k3x + k4x), v: v + (DT / 6) * (k1v + 2 * k2v + 2 * k3v + k4v) };
}

export const trackParams = (course: CourseData): CartParams => ({ ...DEFAULT_CART, ...(course.track?.push !== undefined ? { push: course.track.push } : {}) });

// The world when a course has a track: the cart waits at the start of the rails, at rest, until the first push.
export function enterCart(w: WorldState, course: CourseData): WorldState {
  const rails = railsOf(course.track!, 0);
  const p = trackParams(course);
  const x = rails.x0;
  return { ...w, mode: 'cart', cart: { segment: 0, x, v: 0, started: false, stalledAt: null, tilt: Math.atan(rails.slope(x)) }, runner: { ...w.runner, x, y: rails.y(x) + p.seat, vx: 0, vy: 0, grounded: true } };
}

// Did the cart leave the rails on a hilltop? (Flying across the gap between two rail sections is planned and does not count.)
// (A rider who jumped out on purpose did not fly off a hilltop either.)
export const flewOff = (events: { type: string; detail?: Record<string, number | boolean> }[]): boolean => events.some((e) => e.type === 'cart-off' && !e.detail?.end && !e.detail?.jump);

const STALL_ROLL_TICKS = 100; // after the turn-round the cart rolls back this long, then the run is over

export function stepCartWorld(w: WorldState, input: RunnerInput, course: CourseData): WorldState {
  const track = course.track!;
  const c = w.cart!;
  const rails = railsOf(track, c.segment), p = trackParams(course);
  const tick = w.runner.tick + 1;
  const events: GameEvent[] = [];
  let { x, v, started, stalledAt } = c;
  if (!started) {
    if (input.run || input.jump) { started = true; v = p.push; events.push({ tick, type: 'cart-start', detail: { v: p.push } }); }
    return { ...w, cart: { ...c, x, v, started, stalledAt }, events, runner: { ...w.runner, tick, x, y: rails.y(x) + p.seat, vx: 0, vy: 0 } };
  }
  // CC-244: the rider may step out at any time. The body keeps the cart's velocity at that moment and takes the ordinary jump on top; the cart is left behind and never joins the body again.
  if (input.jump) {
    const s0 = rails.slope(x), cos0 = 1 / Math.sqrt(1 + s0 * s0);
    events.push({ tick, type: 'cart-off', detail: { x, v, segment: c.segment, jump: true } });
    return { ...w, mode: 'run', cart: null, cartLeft: true, events, runner: { ...w.runner, tick, x, y: rails.y(x) + p.seat, vx: v * cos0, vy: v * s0 * cos0 + course.jumpSpeed, grounded: false, landedAtTick: null, landedAtX: null } };
  }
  const prevV = v;
  const nx = cartStep(rails, x, v, input.squat, p);
  x = nx.x; v = nx.v;
  const s = rails.slope(x), cosPhi = 1 / Math.sqrt(1 + s * s);
  const y = rails.y(x) + p.seat;
  let out: WorldState = { ...w, cart: { segment: c.segment, x, v, started, stalledAt, tilt: Math.atan(s) }, events, runner: { ...w.runner, tick, x, y, vx: v * cosPhi, vy: v * s * cosPhi, grounded: true } };
  // At the end of a segment, fly toward the following section; the last rail end is the finish.
  if (x >= rails.x1 && v > 0) {
    const more = c.segment + 1 < trackSegments(track).length;
    const onward = course.finishX > rails.x1 + 1; // CC-244: other obstacles come after the last rail, so the rail's end is not the finish: the rider flies on
    if (more || onward) {
      const endX = rails.x1, slope = rails.slope(endX), cos = 1 / Math.sqrt(1 + slope * slope);
      events.push({ tick, type: 'cart-off', detail: { x: endX, v, segment: c.segment, end: true } });
      return { ...out, mode: 'run', cart: null, events, runner: { ...out.runner, x: endX, y: rails.y(endX) + p.seat, vx: v * cos, vy: v * slope * cos, grounded: false, landedAtTick: null, landedAtX: null } };
    }
    return { ...out, outcome: 'cleared', events: [...events, { tick, type: 'cleared' }] };
  }
  // turned round on a hill: stalled; it rolls back a moment, then the run is over
  if (stalledAt === null && prevV > 0 && v <= 0 && s > 0) {
    stalledAt = tick; events.push({ tick, type: 'cart-stall', detail: { x, height: rails.y(x) } });
    out = { ...out, cart: { segment: c.segment, x, v, started, stalledAt, tilt: Math.atan(s) }, events };
  }
  if (stalledAt !== null && (tick - stalledAt >= STALL_ROLL_TICKS || x <= rails.x0)) return { ...out, outcome: 'stalled', events };
  // the rails stop pushing: the cart leaves the track and flies on (the ordinary flight takes over from here)
  if (v > 0 && railPush(rails, x, v, p.gravity) <= 0) {
    events.push({ tick, type: 'cart-off', detail: { x, v, push: railPush(rails, x, v, p.gravity), segment: c.segment } });
    return { ...out, mode: 'run', cart: null, events, runner: { ...out.runner, grounded: false, landedAtTick: null, landedAtX: null } };
  }
  return out;
}
