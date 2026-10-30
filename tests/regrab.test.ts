import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { newWorld, stepWorld, type WorldState } from '../src/sim/world';
import { NO_INPUT } from '../src/sim/runner';
import { feetOf, tryGrab, DEFAULT_HANG } from '../src/sim/holds';

// A body that lets go and comes back to a bar can catch it again (CC-67): an ellipse round the bar, wider than tall, after the no-catch time.
const course: CourseData = { version: 1, name: 'x', startX: 0, finishX: 80, jumpSpeed: 4.5, terrain: { waterY: -30, platforms: [{ x0: -10, x1: 6, top: 0 }] }, holds: [{ x: 9, y: 4 }] };
const hangAt = (theta: number, omega: number): WorldState => {
  const w = newWorld(course, 0), f = feetOf(course.holds![0], { hold: 0, theta, omega });
  return { ...w, mode: 'hang', hang: { hold: 0, theta, omega }, runner: { ...w.runner, x: f.x, y: f.y, grounded: false } };
};
// let go, then hold the hand key from `after` ticks on; returns the world at each tick
const flight = (w: WorldState, after: number, ticks: number): WorldState[] => {
  const out: WorldState[] = [];
  w = stepWorld(w, { ...NO_INPUT }, course);
  for (let i = 0; i < ticks; i++) { w = stepWorld(w, { ...NO_INPUT, handR: i >= after, handL: i >= after }, course); out.push(w); }
  return out;
};

describe('regrabbing a bar', () => {
  it('a release straight up comes back down and catches the same bar', () => {
    const ws = flight(hangAt(Math.PI / 2, 4), 30, 400);
    const caught = ws.findIndex((w) => w.mode === 'hang');
    expect(caught).toBeGreaterThan(30); // not before the no-catch time
    expect(ws[caught].hang!.hold).toBe(0);
  });
  it('the catch does not move the body: the feet are where they were, the hands ease onto the bar', () => {
    const ws = flight(hangAt(Math.PI / 2, 4), 30, 400);
    const caught = ws.findIndex((w) => w.mode === 'hang');
    for (let i = caught - 1; i < caught + 12; i++) {
      const a = ws[i].runner, b = ws[i + 1].runner;
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(0.15); // 15 cm in one tick (about 18 m/s) would be a jump
    }
  });
  it('a release that lands 2 m away does not catch the bar again', () => {
    const ws = flight(hangAt(0, 5), 0, 400); // 6 m/s along: the hands are 1.2 m away when the no-catch time ends and going on
    expect(ws.some((w) => w.mode === 'hang')).toBe(false);
  });
  it('the first grab keeps the circle; the ellipse is only for a grab again', () => {
    const bar = course.holds!;
    const handsAt = (dx: number, dy: number) => tryGrab(bar, bar[0].x + dx, bar[0].y + dy - DEFAULT_HANG.handHeight, 3, 0);
    expect(handsAt(0.1, 0)).not.toBeNull(); // CC-193: the circle is 0.15 m, the hands must visibly reach the bar
    expect(handsAt(0.3, 0)).toBeNull();
    const again = (dx: number, dy: number) => tryGrab(bar, bar[0].x + dx, bar[0].y + dy - DEFAULT_HANG.handHeight, 3, 0, DEFAULT_HANG, true);
    expect(again(1.0, 0)).not.toBeNull();
    expect(again(0, 0.5)).not.toBeNull();
    expect(again(0, -0.5)).not.toBeNull(); // falling past the bar from above
    expect(again(1.0, 0.5)).toBeNull(); // corners of the box are outside the ellipse
    expect(again(1.4, 0)).toBeNull();
  });
});
