import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { newWorld, stepWorld } from '../src/sim/world';
import { NO_INPUT } from '../src/sim/runner';
import { bodyVelocity, comDistance, DEFAULT_HANG, feetOf, releaseHang, releaseRadius } from '../src/sim/holds';
import { GRAVITY } from '../src/sim/units';

// Letting go (CC-67): the body flies on with all the energy the swing had, from where its middle was, on a true ballistic path.
const course: CourseData = { version: 1, name: 'x', startX: 0, finishX: 80, jumpSpeed: 4.5, terrain: { waterY: -30, platforms: [{ x0: -10, x1: 6, top: 0 }] }, holds: [{ x: 9, y: 2.9 }, { x: 40, y: 2.9 }] };
const hangAt = (theta: number, omega: number) => {
  const w = newWorld(course, 0), f = feetOf(course.holds![0], { hold: 0, theta, omega });
  return { ...w, mode: 'hang' as const, hang: { hold: 0, theta, omega }, runner: { ...w.runner, x: f.x, y: f.y, grounded: false } };
};
const L = DEFAULT_HANG.handHeight;
const middle = (w: { runner: { x: number; y: number } }) => ({ x: w.runner.x, y: w.runner.y + comDistance() }); // the middle is half a rod above the feet in flight

describe('the release', () => {
  it('the flight starts with the kinetic energy the swinging rod had (1/2 I w^2, I = m L^2 / 3)', () => {
    for (const [theta, omega] of [[0, 6], [0.5, 5], [1.2, 4], [-0.8, -5], [2.5, 3]]) {
      const v = bodyVelocity({ hold: 0, theta, omega });
      const flight = 0.5 * (v.vx ** 2 + v.vy ** 2), swing = 0.5 * ((L * L) / 3) * omega * omega; // per unit mass
      expect(flight).toBeCloseTo(swing, 9);
    }
    expect(releaseRadius()).toBeCloseTo(L / Math.sqrt(3), 12);
  });
  it('the velocity is along the swing, perpendicular to the arms, and the speed on the runner while swinging is the same number', () => {
    const w = stepWorld(hangAt(0.7, 5), { ...NO_INPUT, handL: true, handR: true }, course);
    const v = bodyVelocity(w.hang!);
    expect(w.runner.vx).toBeCloseTo(v.vx, 12);
    expect(w.runner.vy).toBeCloseTo(v.vy, 12);
    const arm = { x: Math.sin(w.hang!.theta), y: -Math.cos(w.hang!.theta) };
    expect(v.vx * arm.x + v.vy * arm.y).toBeCloseTo(0, 9);
  });
  it('the middle does not jump when the hands open (the path is continuous to within one step of travel)', () => {
    for (const theta of [0, 0.4, 0.9, 1.3, -0.6]) {
      const w = hangAt(theta, 5), h = course.holds![0];
      const before = { x: h.x + comDistance() * Math.sin(theta), y: h.y - comDistance() * Math.cos(theta) };
      const rel = releaseHang(h, w.hang!);
      expect(rel.x).toBeCloseTo(before.x, 12);
      expect(rel.y + comDistance()).toBeCloseTo(before.y, 12);
    }
  });
  it('in flight the horizontal speed does not change and the middle follows a parabola (no drag, no input effect)', () => {
    let w = stepWorld(hangAt(0.45, 6), { ...NO_INPUT }, course); // both hands off
    expect(w.mode).toBe('run');
    const m0 = middle(w), v0 = { vx: w.runner.vx, vy: w.runner.vy };
    for (let k = 1; k <= 60; k++) {
      w = stepWorld(w, { ...NO_INPUT, run: true }, course); // holding run in the air changes nothing
      const t = k / 120, m = middle(w);
      expect(w.runner.vx).toBeCloseTo(v0.vx, 9);
      expect(m.x).toBeCloseTo(m0.x + v0.vx * t, 6);
      expect(m.y).toBeCloseTo(m0.y + v0.vy * t - 0.5 * GRAVITY * t * t, 6);
    }
  });
  it('the range on level ground is v^2 sin(2a) / g (within 2%)', () => {
    for (const theta of [0.3, 0.6, 0.9]) {
      let w = stepWorld(hangAt(theta, 6), { ...NO_INPUT }, course);
      const m0 = middle(w), v = { vx: w.runner.vx, vy: w.runner.vy };
      let t = 0, m = m0;
      while (t < 5) { w = stepWorld(w, { ...NO_INPUT }, course); t += 1 / 120; m = middle(w); if (m.y <= m0.y && w.runner.vy < 0) break; }
      const speed = Math.hypot(v.vx, v.vy), a = Math.atan2(v.vy, v.vx);
      expect(m.x - m0.x).toBeCloseTo((speed * speed * Math.sin(2 * a)) / GRAVITY, 0);
      expect(Math.abs((m.x - m0.x) / ((speed * speed * Math.sin(2 * a)) / GRAVITY) - 1)).toBeLessThan(0.02);
    }
  });
});
