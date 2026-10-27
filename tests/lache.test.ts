import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { playPlan, searchIdealRun } from '../src/sim/ideal';
import { newWorld, stepWorld } from '../src/sim/world';
import { NO_INPUT } from '../src/sim/runner';

// The lache pair: two bars in the air over water; grab the first, pump to build the swing, let go, catch the second, let go onto the far deck.
const course = (gap: number, y = 2.9, spacing = 3.5): CourseData => ({
  version: 1, name: 'lache', startX: 0, finishX: 30, jumpSpeed: 4.5,
  terrain: { waterY: -1.5, platforms: [{ x0: -10, x1: 6, top: 0 }, { x0: 6 + gap, x1: 40, top: 0 }] },
  holds: [{ x: 9, y }, { x: 9 + spacing, y }],
});

describe('the lache pair', () => {
  it('can be cleared over a 9 m gap, and the line has to pump the swing', () => {
    const r = searchIdealRun(course(9));
    expect(r.cleared).toBe(true);
    expect(r.plan.hangTicks![0]).toBeGreaterThan(120); // more than a second on the first bar: the swing is built, not just ridden
  });
  it('is not cleared by a plain run and jump (a run of six metres gives a jump that falls short)', () => {
    const r = playPlan(course(9), { jumpXs: [5.9], releaseAfter: 60, bouncePress: 8 });
    expect(r.world.outcome).toBe('splash');
  });
  it('is not cleared by letting go at once or by never letting go', () => {
    const base = searchIdealRun(course(9)).plan;
    expect(playPlan(course(9), { ...base, hangTicks: [0, 0] }).world.outcome).not.toBe('cleared');
    expect(playPlan(course(9), { ...base, hangTicks: [5000, 5000] }, 120 * 30).world.outcome).not.toBe('cleared');
  });
  it('cannot be cleared when the gap is far wider than two swings can cross', () => {
    expect(searchIdealRun(course(16)).cleared).toBe(false);
  });
  it('cannot be started when the bars are out of reach of a jump', () => {
    expect(searchIdealRun(course(9, 4.6)).cleared).toBe(false);
  });
  it('a hand on the key does nothing on the ground, and a bar far away is not grabbed', () => {
    let w = newWorld(course(9), 0);
    for (let i = 0; i < 240; i++) w = stepWorld(w, { ...NO_INPUT, run: true, handL: true, handR: true }, course(9));
    expect(w.mode).toBe('run');
  });
});
