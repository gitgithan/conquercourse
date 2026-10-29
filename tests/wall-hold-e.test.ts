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

// CC-182: missing the top of the warped wall is not a failure: the body slides back to the foot and may run up again, with no respawn.
describe('a missed warped wall only slides back', () => {
  it('the run goes on, and a second run up with E held takes the top', () => {
    let w = newWorld(base, 0);
    const ev: string[] = [];
    let slid = false, back = 0;
    for (let i = 0; i < 120 * 40 && !ev.includes('wall-grab'); i++) {
      const walkBack = slid && back++ < 300; // after the slide the runner is at the foot with no speed, so it walks back to get a run-up
      w = stepWorld(w, { ...NO_INPUT, run: !walkBack, left: walkBack, squat: true, handL: slid && !walkBack, handR: slid && !walkBack }, base);
      for (const e of w.events) { ev.push(e.type); if (e.type === 'wall-slide') { slid = true; expect(w.outcome).toBe('running'); expect(w.runner.x).toBeLessThan(40); } }
    }
    expect(slid).toBe(true);
    expect(w.outcome).toBe('running');
    expect(ev).toContain('wall-grab');
  });
});

// CC-194: E counts only in the last moment of the climb, and the hint opens just before it, when the hands are near the lip.
import { WALL_HINT_TICKS, WALL_HOLD_TICKS } from '../src/sim/world';
describe('the wall E window is at the lip', () => {
  const run = (hold: (idx: number, gt: number) => boolean) => {
    let w = newWorld(base, 0);
    const ev: string[] = [];
    for (let i = 0; i < 120 * 20; i++) {
      const h = w.mode === 'wall' && w.wall!.result.grabTick !== null && hold(w.wall!.index, w.wall!.result.grabTick);
      w = stepWorld(w, { ...NO_INPUT, run: true, squat: true, handL: h, handR: h }, base);
      ev.push(...w.events.map((e) => e.type));
      expect(w.outcome === 'running' || w.outcome === 'cleared').toBe(true); // an early press never ends the run
      if (ev.includes('wall-grab') || ev.includes('wall-slide')) break;
    }
    return ev;
  };
  it('the window is a fifth of a second or less and the hint opens a little before it', () => {
    expect(WALL_HOLD_TICKS).toBeLessThanOrEqual(24);
    expect(WALL_HINT_TICKS).toBeGreaterThan(WALL_HOLD_TICKS);
    expect(WALL_HINT_TICKS).toBeLessThanOrEqual(WALL_HOLD_TICKS + 12);
  });
  it('pressing E when the window opens grabs the top', () => expect(run((i, gt) => i >= gt - WALL_HOLD_TICKS)).toContain('wall-grab'));
  it('pressing E at the natural moment, a few ticks into the window, grabs the top', () => expect(run((i, gt) => i >= gt - WALL_HOLD_TICKS + 6)).toContain('wall-grab'));
  it('a tap that ends before the window does nothing: the body slides back and the run goes on', () => {
    const ev = run((i, gt) => i < gt - WALL_HOLD_TICKS - 2);
    expect(ev).toContain('wall-slide');
    expect(ev).not.toContain('wall-grab');
  });
  it('E held from far below the lip still grabs (holding is not a mistake)', () => expect(run(() => true)).toContain('wall-grab'));
});
