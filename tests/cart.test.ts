import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../src/sim/runner';
import { newWorld, stepWorld } from '../src/sim/world';
import { playPlan, searchIdealRun } from '../src/sim/ideal';
import { DEFAULT_CART, cartStep, crestSpeedLimit, makeRails, railPush, type CartParams } from '../src/sim/cart';
import { coasterCourse } from '../src/slice/coaster';
import { GRAVITY } from '../src/sim/units';

const FREE: CartParams = { ...DEFAULT_CART, rolling: 0, drag: 0, brake: 0 };

function ride(pts: [number, number][], push = 1.5, maxS = 60) {
  const c = coasterCourse('t', pts, push);
  let w = newWorld(c);
  const events: string[] = [];
  let maxV = 0;
  for (let i = 0; i < 120 * maxS && w.outcome === 'running'; i++) {
    w = stepWorld(w, { ...NO_INPUT, run: i === 0 }, c);
    for (const e of w.events) events.push(e.type);
    maxV = Math.max(maxV, Math.abs(w.cart?.v ?? 0));
  }
  return { w, events, maxV, course: c };
}

describe('the rails', () => {
  it('a smooth curve goes through every point', () => {
    const pts: [number, number][] = [[0, 8], [8, 1], [16, 3], [24, 0.5]];
    const r = makeRails(pts);
    for (const [x, y] of pts) expect(r.y(x)).toBeCloseTo(y, 9);
  });
  it('the slope is continuous across a point (no kink)', () => {
    const r = makeRails([[0, 8], [8, 1], [16, 3], [24, 0.5]]);
    expect(Math.abs(r.slope(8 - 1e-6) - r.slope(8 + 1e-6))).toBeLessThan(1e-4);
  });
});

describe('energy: height is stored speed', () => {
  const pts: [number, number][] = [[0, 6], [10, 2], [20, 4.5], [30, 1], [40, 3]];
  it('without friction the energy (speed squared over two plus g times height) stays the same', () => {
    const r = makeRails(pts);
    let x = 0.01, v = 0;
    const e0 = 0.5 * v * v + GRAVITY * r.y(x);
    let worst = 0;
    for (let i = 0; i < 120 * 40; i++) {
      ({ x, v } = cartStep(r, x, v, false, FREE));
      if (x <= r.x0 || x >= r.x1) break;
      worst = Math.max(worst, Math.abs(0.5 * v * v + GRAVITY * r.y(x) - e0));
    }
    expect(worst).toBeLessThan(0.02 * Math.abs(e0));
  });
  it('a cart never rises above its start height (plus what the push gave)', () => {
    const r = makeRails(pts);
    let x = 0.01, v = 1.5, top = 0;
    const limit = r.y(x) + (1.5 * 1.5) / (2 * GRAVITY);
    for (let i = 0; i < 120 * 40; i++) {
      ({ x, v } = cartStep(r, x, v, false, DEFAULT_CART));
      if (x <= r.x0 || x >= r.x1) break;
      top = Math.max(top, r.y(x));
    }
    expect(top).toBeLessThanOrEqual(limit + 0.05);
  });
  it('friction and air only ever take energy out', () => {
    const r = makeRails(pts);
    const run = (p: CartParams) => { let x = 0.01, v = 0; for (let i = 0; i < 120 * 12; i++) ({ x, v } = cartStep(r, x, v, false, p)); return 0.5 * v * v + GRAVITY * r.y(x); };
    expect(run(DEFAULT_CART)).toBeLessThan(run(FREE));
  });
});

describe('leaving the track', () => {
  const sharp: [number, number][] = [[0, 9], [7, 5], [14, 1], [22, 0.6], [27, 3.6], [32, 0.6], [46, 0.6], [56, 0.2]];
  const broad: [number, number][] = [[0, 9], [7, 5], [14, 1], [22, 0.6], [34, 3.6], [46, 0.6], [56, 0.2]];
  it('the rails push up in a valley and lift less on a crest', () => {
    const r = makeRails(broad);
    expect(railPush(r, 14, 6)).toBeGreaterThan(GRAVITY * 0.9); // valley
    expect(railPush(r, 34, 12)).toBeLessThan(GRAVITY);          // crest
  });
  it('on a sharp hilltop at speed the cart leaves the rails and flies on, past where the limit says', () => {
    const { events, w } = ride(sharp);
    expect(events).toContain('cart-off');
    expect(w.outcome).not.toBe('cleared');
    const r = makeRails(sharp);
    expect(crestSpeedLimit(r, 27)).toBeLessThan(9);
  });
  it('a broad hilltop at the same speed holds the cart on, all the way to the finish', () => {
    const { events, w } = ride(broad);
    expect(events).not.toContain('cart-off');
    expect(w.outcome).toBe('cleared');
  });
  it('braking before the sharp hilltop keeps the cart on: the search finds where, and the run clears', () => {
    const c = coasterCourse('sharp', sharp);
    const s = searchIdealRun(c);
    expect(s.cleared).toBe(true);
    expect(s.plan.cartBrake?.length).toBeGreaterThan(0);
    expect(playPlan(c, s.plan).world.outcome).toBe('cleared');
  });
});

describe('a hill that is too high', () => {
  it('stalls: it turns round near the start height, and the run ends', () => {
    const { events, w } = ride([[0, 5], [8, 1], [18, 7], [28, 1]]);
    expect(events).toContain('cart-stall');
    expect(w.outcome).toBe('stalled');
  });
  it('a first hill high enough for the second one clears it', () => {
    const { w } = ride([[0, 8], [8, 1], [18, 6], [28, 1], [40, 0.5]]);
    expect(w.outcome).toBe('cleared');
  });
  it('a bigger push climbs a bit higher (a push adds its speed squared over two g of height)', () => {
    const pts: [number, number][] = [[0, 5], [8, 1], [18, 5.2], [28, 1]];
    expect(ride(pts, 0.5).w.outcome).toBe('stalled');
    expect(ride(pts, 4).w.outcome).toBe('cleared');
  });
});

describe('the cart waits for the push', () => {
  it('without the key it stays where it is, however long', () => {
    const c = coasterCourse('t', [[0, 5], [8, 1], [18, 3]]);
    let w = newWorld(c);
    for (let i = 0; i < 600; i++) w = stepWorld(w, NO_INPUT, c);
    expect(w.cart!.started).toBe(false);
    expect(w.runner.x).toBe(0);
  });
});
