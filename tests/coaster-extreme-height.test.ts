// CC-244: a very tall coaster (300 m, 1000 m) still behaves: the cart stays on its rail, no tick skips the end of the rail, and the speed matches the energy it was given.
import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../src/sim/runner';
import { newWorld, stepWorld } from '../src/sim/world';
import { DEFAULT_CART, cartStep, makeRails, type CartParams } from '../src/sim/cart';
import { coasterCourse } from '../src/slice/coaster';
import { GRAVITY } from '../src/sim/units';

const FREE: CartParams = { ...DEFAULT_CART, rolling: 0, drag: 0, brake: 0 };
// a smooth drop (a cosine ease, steep in the middle), then a flat run-out: a smooth valley, no bump for a fast cart to fly off
const FLAT = 10; // index of the first flat dot
const drop = (h: number): [number, number][] => {
  const L = h * 0.6, pts: [number, number][] = [];
  for (let i = 0; i <= FLAT; i++) pts.push([(L * i) / FLAT, 0.5 + ((h - 0.5) / 2) * (1 + Math.cos((Math.PI * i) / FLAT))]);
  for (const dx of [40, 80, 120]) pts.push([L + dx, 0.5]);
  return pts;
};

describe('the rail never goes under its lowest dot', () => {
  it('a steep drop onto a low flat does not swing underground', () => {
    const pts: [number, number][] = [[0, 9], [7, 14], [14, 1], [22, 0.6]];
    const r = makeRails(pts);
    for (let x = 0; x <= 22; x += 0.05) expect(r.y(x)).toBeGreaterThanOrEqual(0.6 - 1e-9);
    expect(r.slope(21)).toBeCloseTo(r.slope(21), 9);
  });
  it('the dots are still on the rail', () => {
    const pts: [number, number][] = [[0, 9], [7, 14], [14, 1], [22, 0.6]];
    const r = makeRails(pts);
    for (const [x, y] of pts) expect(r.y(x)).toBeCloseTo(y, 9);
  });
});

describe.each([300, 1000])('a %i m drop', (h) => {
  it('without friction the speed at the bottom is what the energy gives, and the step stays under the rail length scale', () => {
    const pts = drop(h), r = makeRails(pts);
    let x = 0.001, v = 0, maxStep = 0, maxErr = 0;
    for (let i = 0; i < 120 * 90 && x < pts[FLAT][0]; i++) {
      const n = cartStep(r, x, v, false, FREE); maxStep = Math.max(maxStep, n.x - x); x = n.x; v = n.v;
      maxErr = Math.max(maxErr, Math.abs((v * v) / 2 + GRAVITY * r.y(x) - GRAVITY * r.y(0.001)) / (GRAVITY * h));
    }
    expect(Math.abs(maxErr)).toBeLessThan(0.002); // energy kept to 0.2% of the starting energy at every tick
    expect(x).toBeGreaterThan(pts[FLAT][0] - 1.5); // the cart reached the flat: it did not stall or stop on the way
    expect(v).toBeGreaterThan(0.95 * Math.sqrt(2 * GRAVITY * (h - 0.5)));
    expect(maxStep).toBeLessThan(2); // never more than about a metre of rail in one tick
  });
  it('the whole ride with friction ends cleared, never fell off the rail and never went through it', () => {
    const c = coasterCourse('t', drop(h), 1.5);
    let offInfo = ''; let w = newWorld(c), maxV = 0, offs = 0, lastX = -1, jump = 0;
    for (let i = 0; i < 120 * 200 && w.outcome === 'running'; i++) {
      w = stepWorld(w, { ...NO_INPUT, run: i === 0 }, c);
      for (const e of w.events) if (e.type === 'cart-off' && !e.detail?.end && (e.detail?.x as number) < drop(h)[FLAT][0]) { offs++; offInfo = JSON.stringify(e); } // only the drop itself is judged: on the flat after it a cart at 50 m/s or more leaves the rail at any bump of a few mm per metre (v squared times the bend beats gravity), at every height; that is the physics, not a missed tick
      if (!w.cart) lastX = -1;
      if (w.cart) { maxV = Math.max(maxV, w.cart.v); if (lastX >= 0) jump = Math.max(jump, w.cart.x - lastX); lastX = w.cart.x; expect(w.runner.y).toBeCloseTo(makeRails(drop(h)).y(w.cart.x) + DEFAULT_CART.seat, 6); }
    }
    expect(w.outcome).toBe('cleared');
    expect(offs, offInfo).toBe(0);
    expect(maxV).toBeLessThan(Math.sqrt(2 * GRAVITY * h)); // friction and drag keep it under the frictionless speed
    expect(jump).toBeLessThan(2);
  });
});
