import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { newWorld, stepWorld } from '../src/sim/world';
import { NO_INPUT } from '../src/sim/runner';

// CC-243: the hand reach is 0.15 m, so the drawn hands touch the bar. A bar at 2.2 m (the green line in the editor's side view) and one at 2.05 m
// (the black one) must both be caught by a person who runs, jumps and holds E, and the catch must lead into a swing.
const courseWith = (barY: number): CourseData => ({ version: 1, name: 'x', startX: 0, finishX: 40, jumpSpeed: 4.5, terrain: { waterY: -30, platforms: [{ x0: -10, x1: 20, top: 0 }, { x0: 24, x1: 40, top: 0 }] }, holds: [{ x: 11, y: barY }] });

// run to the bar, press jump at tick `at`, hold E from the take-off; returns the first hang world and the later ones
function ride(course: CourseData, at: number) {
  let w = newWorld(course, 0), grabbed = -1, swung = 0;
  for (let t = 0; t < 700; t++) {
    w = stepWorld(w, { ...NO_INPUT, run: true, jump: t === at, jumpSpeed: course.jumpSpeed, handL: t >= at, handR: t >= at }, course);
    if (w.mode === 'hang') { if (grabbed < 0) grabbed = t; swung = Math.max(swung, Math.abs(w.hang!.theta - Math.PI / 2)); }
  }
  return { grabbed, swung };
}

describe('catching a bar with E held', () => {
  for (const y of [2.05, 2.2]) {
    it(`a bar at ${y} m is caught by some jump and the catch swings`, () => {
      const course = courseWith(y);
      let best = { grabbed: -1, swung: 0 }, n = 0;
      for (let at = 100; at < 300; at += 2) { const r = ride(course, at); if (r.grabbed >= 0) { n++; if (r.swung > best.swung) best = r; } }
      console.log('BAR', y, 'jumps that grab', n, 'best swing', best.swung.toFixed(2));
      expect(n).toBeGreaterThan(0);
      expect(best.swung).toBeGreaterThan(0.2);
    });
  }
});
