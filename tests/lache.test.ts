import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { playPlan, searchIdealRun } from '../src/sim/ideal';
import { newWorld, stepWorld } from '../src/sim/world';
import { NO_INPUT } from '../src/sim/runner';
import { feetOf } from '../src/sim/holds';

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

// Bars at the same height, `spacing` apart: hang from the first, pump the swing for `ticks` (with the swing, or not at all), let go, hold a hand up in the air.
// Returns whether the second bar is caught.
const throwBetween = (spacing: number, ticks: number, pump: boolean): boolean => {
  const c: CourseData = {
    version: 1, name: 'x', startX: 0, finishX: 80, jumpSpeed: 4.5,
    terrain: { waterY: -8, platforms: [{ x0: -10, x1: 6, top: 0 }, { x0: 9 + spacing + 3, x1: 80, top: 0 }] },
    holds: [{ x: 9, y: 2.9 }, { x: 9 + spacing, y: 2.9 }],
  };
  let w = newWorld(c, 0);
  const f = feetOf(c.holds![0], { hold: 0, theta: 0, omega: 0 });
  w = { ...w, mode: 'hang', hang: { hold: 0, theta: 0.05, omega: 0 }, runner: { ...w.runner, x: f.x, y: f.y, grounded: false } };
  for (let i = 0; i < ticks && w.mode === 'hang'; i++) {
    const fwd = w.hang!.omega >= 0;
    w = stepWorld(w, { ...NO_INPUT, handL: true, handR: true, run: pump && fwd, left: pump && !fwd }, c);
  }
  if (w.mode !== 'hang') return false; // the grip gave out
  // the swing is built by pumping for `ticks`; then it is ridden without pumping and let go at the best moment within the next 1.1 s (a full swing is about 2.4 s)
  for (let ride = 0; ride < 130; ride += 2) {
    let q = w;
    for (let i = 0; i < ride && q.mode === 'hang'; i++) q = stepWorld(q, { ...NO_INPUT, handL: true, handR: true }, c);
    if (q.mode !== 'hang') continue;
    q = stepWorld(q, { ...NO_INPUT }, c);
    for (let i = 0; i < 400 && q.outcome === 'running'; i++) {
      q = stepWorld(q, { ...NO_INPUT, run: true, handR: true }, c);
      if (q.mode === 'hang' && q.hang!.hold === 1) return true;
    }
  }
  return false;
};
const shortestPump = (spacing: number): number | null => { for (let t = 0; t <= 900; t += 6) if (throwBetween(spacing, t, true)) return t; return null; };

describe('a bigger pump throws the body further between the bars', () => {
  it('wider gaps between the bars need a longer pump, up to the limit of the grip', () => {
    const need = [2, 4.5, 7].map(shortestPump);
    expect(need.every((n) => n !== null)).toBe(true);
    const [a, b, c] = need as number[];
    expect(a).toBeLessThan(120); // a short gap: a first swing is enough
    expect(b).toBeGreaterThan(a); // a wider one needs the swing built up
    expect(c).toBeGreaterThanOrEqual(b);
    expect(c).toBeGreaterThan(200); // the widest gap needs two or more swings
  });
  it('a gap beyond what the grip allows cannot be crossed, however long the swing is pumped', () => {
    expect(shortestPump(8)).toBeNull();
  });
  it('without any pumping even a short gap is not crossed (the catch gives almost no swing)', () => {
    const ok: number[] = [];
    for (let t = 0; t <= 900; t += 6) if (throwBetween(3, t, false)) ok.push(t);
    expect(ok).toEqual([]);
  });
});
