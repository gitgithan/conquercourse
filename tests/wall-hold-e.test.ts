import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { NO_INPUT } from '../src/sim/runner';
import { newWorld, stepWorld } from '../src/sim/world';

// CC-168: the warped wall is grabbed with the hands, so E must be down near the top. Without E the body climbs as high and slides back.
const H = 3.2; // the curve rises over H metres of run and the deck on top starts where it ends
const base = { version: 1, name: 'wall', startX: 0, finishX: 95, jumpSpeed: 4.5, wall: { x0: 40, height: H }, terrain: { waterY: -3, platforms: [{ x0: -10, x1: 40 + H, top: 0 }, { x0: 40 + H, x1: 100, top: H }] } } as unknown as CourseData;
const play = (course: CourseData, hold: boolean) => {
  let w = newWorld(course, 0);
  const ev: string[] = [];
  for (let i = 0; i < 120 * 20; i++) {
    w = stepWorld(w, { ...NO_INPUT, run: true, squat: true, handL: hold, handR: hold }, course);
    ev.push(...w.events.map((e) => e.type));
    if (ev.includes('wall-grab') || ev.includes('wall-slide')) break;
  }
  return ev;
};

describe('the warped wall needs the hands (E)', () => {
  const fast = base; // low enough that a full run reaches the top
  it('with E held the hands take the top', () => expect(play(fast, true)).toContain('wall-grab'));
  it('without E the feet get as high but the body slides back', () => {
    const ev = play(fast, false);
    expect(ev).toContain('wall-no-grip');
    expect(ev).toContain('wall-slide');
    expect(ev).not.toContain('wall-grab');
  });
  it('the old rule (wall.needE = false) grabs without E', () => {
    expect(play({ ...fast, wall: { ...fast.wall!, needE: false } } as CourseData, false)).toContain('wall-grab');
  });
});
