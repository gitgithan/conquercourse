import { describe, expect, it } from 'vitest';
import { roleCourse } from '../src/slice/roles';
import { newWorld, stepWorld } from '../src/sim/world';
import { NO_INPUT } from '../src/sim/runner';
import { holdsOf } from '../src/slice/holds-world';
import { pieceFromSrc } from '../src/slice/photo-course';
import { smoothPts, TRACK_SHAPES, trackPiece, trackEndY, TRACK_STEP_DOWN } from '../src/slice/track-world';

// CC-244: the end of the last rail is not the finish when other obstacles follow; a 3D object can be a swing bar; the ribbon curves like the rail.
const lane = { angle: 0, offset: 0, level: 0 };
const start = TRACK_SHAPES.find((t) => t.id === 'start')!.pts;

describe('coaster flow in the editor', () => {
  it('the rider flies on at the end of the last rail instead of clearing the course', () => {
    const q = trackPiece(start, { x: 0, z: 0 }, 0); q.x = 11;
    const deck = { ...pieceFromSrc('box:10:0.4:2', { x: 32, z: 0 }), src: 'box:10:0.4:2', y: trackEndY(q) - TRACK_STEP_DOWN - 0.4 };
    const { course } = roleCourse([q, deck] as never[], lane);
    expect(course.finishX).toBeGreaterThan(course.track!.pts[course.track!.pts.length - 1][0] + 1);
    let w = newWorld(course);
    for (let i = 0; i < 6000 && w.mode === 'cart' && w.outcome === 'running'; i++) w = stepWorld(w, { ...NO_INPUT, run: true }, course);
    expect(w.outcome).toBe('running');
    expect(w.mode).toBe('run');
    expect(w.events.some((e) => e.type === 'cart-off')).toBe(true);
  });

  it('a track piece is drawn along the smooth rail, not straight between the dots', () => {
    const dots = TRACK_SHAPES.find((t) => t.id === 'wave')!.pts;
    const s = smoothPts(dots);
    expect(s.length).toBeGreaterThan(dots.length * 3);
    const [a, b] = [dots[1], dots[2]], mid = s.reduce((best, p) => Math.abs(p[0] - (a[0] + b[0]) / 2) < Math.abs(best[0] - (a[0] + b[0]) / 2) ? p : best);
    // the curve passes through the dots and bends away from the straight line between them
    expect(s.some((p) => Math.abs(p[0] - a[0]) < 0.26 && Math.abs(p[1] - a[1]) < 0.05)).toBe(true);
    expect(Math.abs(mid[1] - (a[1] + b[1]) / 2)).toBeGreaterThan(0.005);
  });

  it('a 3D object used as a swing bar becomes a hold at its top and is not ground', () => {
    const post = { ...pieceFromSrc('box:0.3:2.5:0.3', { x: 12, z: 0 }), src: 'box:0.3:2.5:0.3', role: 'bar' as const, y: 1 };
    const holds = holdsOf([post] as never[], lane);
    expect(holds.length).toBe(1);
    expect(holds[0].y).toBeCloseTo(3.5, 1);
    const { course } = roleCourse([post, { ...pieceFromSrc('box:10:0.4:2', { x: 5, z: 0 }), src: 'box:10:0.4:2' }] as never[], lane);
    expect(course.holds?.length).toBe(1);
    expect(course.terrain.platforms.every((p) => !(p.x0 <= 12 && p.x1 >= 12 && p.top > 3))).toBe(true); // no tall block stands where the object is
  });
});
