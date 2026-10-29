import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { BEND_EASE_S, BEND_POINTS, bendTarget, drawnTopAt, easeBend, easeToward, restBend } from '../src/sim/beam';
import { NO_INPUT } from '../src/sim/runner';
import { newWorld, stepWorld } from '../src/sim/world';

const course = JSON.parse(readFileSync('public/assets/demo/plank.course.json', 'utf8')) as CourseData;
const pk = course.planks![0];
const mid = BEND_POINTS / 2;
const FRAME = 1 / 60;

describe('the drawn plank bends smoothly (CC-82)', () => {
  it('easing never overshoots and closes most of the gap in three time constants', () => {
    let v = 0;
    for (let i = 0; i < 600; i++) { const n = easeToward(v, 1, FRAME); expect(n).toBeGreaterThanOrEqual(v); expect(n).toBeLessThanOrEqual(1); v = n; }
    expect(easeToward(0, 1, 3 * BEND_EASE_S)).toBeGreaterThan(0.94);
    expect(easeToward(0.4, 0.4, FRAME)).toBeCloseTo(0.4, 12); // already there: stays
  });

  it('a rider landing in the middle would bend the picture by tens of centimetres in one frame; the eased picture moves a few centimetres', () => {
    const rest = restBend(pk);
    const raw = bendTarget(pk, 4.5, mid) - rest[mid];
    expect(raw).toBeGreaterThan(0.3); // the physical bend jumps at once
    const first = easeBend(rest, pk, 4.5, FRAME)[mid] - rest[mid];
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(0.06);
    expect(first).toBeLessThan(raw / 5);
  });

  it('crossing the demo plank at a stepped 60 frames a second: the drawn bend and the drawn surface under the feet change little from frame to frame and stay near the physics', () => {
    let w = newWorld(course);
    let drawn = restBend(pk);
    let prevMid = drawn[mid], prevSurface = NaN, maxDMid = 0, maxDSurface = 0, maxLag = 0, onPlank = 0;
    for (let tick = 0; tick < 120 * 40 && w.outcome === 'running'; tick++) {
      w = stepWorld(w, { ...NO_INPUT, run: true }, course);
      if (tick % 2 === 1) { // a 60 Hz frame is two 120 Hz ticks
        const a = w.mode === 'plank' ? w.runner.x - pk.x0 : -1;
        drawn = easeBend(drawn, pk, a, FRAME);
        maxDMid = Math.max(maxDMid, Math.abs(drawn[mid] - prevMid)); prevMid = drawn[mid];
        if (w.mode === 'plank') {
          onPlank++;
          const s = drawnTopAt(pk, drawn, w.runner.x - pk.x0);
          if (Number.isFinite(prevSurface)) maxDSurface = Math.max(maxDSurface, Math.abs(s - prevSurface));
          prevSurface = s; maxLag = Math.max(maxLag, Math.abs(s - w.runner.y));
        } else prevSurface = NaN;
      }
    }
    expect(w.outcome).toBe('cleared'); // the physics is unchanged: the plank still holds
    expect(onPlank).toBeGreaterThan(30);
    expect(maxDMid).toBeLessThan(0.03); // m per frame
    expect(maxDSurface).toBeLessThan(0.05);
    expect(maxLag).toBeLessThan(0.25); // the picture trails the physical surface by a few centimetres, never a plank's thickness of clutter
  });
});
