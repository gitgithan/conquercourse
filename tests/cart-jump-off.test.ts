import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../src/sim/runner';
import { newWorld, stepWorld, type WorldState } from '../src/sim/world';
import { coasterCourse } from '../src/slice/coaster';
import { makeRails } from '../src/sim/cart';

// CC-244: the rider may jump out of the cart at any moment; the cart is then a separate thing that never joins the body again.
const PTS: [number, number][] = [[0, 9], [7, 5], [14, 1], [22, 0.6], [34, 3.6], [46, 0.6], [56, 0.2]];
const course = coasterCourse('t', PTS, 1.5);

function rideTo(tick: number): WorldState {
  let w = newWorld(course);
  for (let i = 0; i < tick; i++) w = stepWorld(w, { ...NO_INPUT, run: i === 0 }, course);
  return w;
}

describe('jumping out of the cart', () => {
  for (const tick of [30, 120, 240, 400]) {
    it(`at tick ${tick}: the body keeps the cart's velocity (plus the jump) and does not teleport`, () => {
      const before = rideTo(tick);
      if (!before.cart) return; // the ride ended on its own before this tick
      const rails = makeRails(course.track!.pts);
      const v = before.cart.v, s = rails.slope(before.cart.x), cos = 1 / Math.sqrt(1 + s * s);
      const after = stepWorld(before, { ...NO_INPUT, jump: true }, course);
      expect(after.cart).toBeNull();
      expect(after.runner.vx).toBeCloseTo(v * cos, 6);
      expect(after.runner.vy).toBeCloseTo(v * s * cos + course.jumpSpeed, 6);
      expect(Math.abs(after.runner.x - before.runner.x)).toBeLessThan(0.2);
      expect(Math.abs(after.runner.y - before.runner.y)).toBeLessThan(0.2);
      expect(after.events.some((e) => e.type === 'cart-off' && e.detail?.jump)).toBe(true);
    });
  }
  it('the rails never catch the body again, even when it lands on the track', () => {
    let w = rideTo(200);
    expect(w.cart).not.toBeNull();
    w = stepWorld(w, { ...NO_INPUT, jump: true }, course);
    for (let i = 0; i < 120 * 20 && w.outcome === 'running'; i++) {
      w = stepWorld(w, NO_INPUT, course);
      expect(w.cart).toBeNull();
      expect(w.mode).not.toBe('cart');
    }
  });
});
