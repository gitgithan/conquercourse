import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { CLIMB_CATCH_VY, CLIMB_COST, CLIMB_EXIT_SPEED, CLIMB_HAND, CLIMB_MIN_RISE, CLIMB_STAND_REACH, CLIMB_TICKS, climbMaxRise, climbable, findClimb } from '../src/sim/climb';
import { JUMP_COST } from '../src/sim/energy';
import { NO_INPUT } from '../src/sim/runner';
import { newWorld, stepWorld, type WorldState } from '../src/sim/world';
import { playPlan, searchIdealRun } from '../src/sim/ideal';

// A deck, then a wall of height h, then more deck on top of it.
const wall = (h: number): CourseData => ({
  version: 1, name: 'climb', startX: 0, finishX: 40, jumpSpeed: 4.5,
  terrain: { waterY: -1.5, platforms: [{ x0: -10, x1: 20, top: 0 }, { x0: 20, x1: 45, top: h }] },
});

const run = (c: CourseData, ticks: number, input: (w: WorldState) => Partial<Parameters<typeof stepWorld>[1]>, x0 = 0) => {
  let w = newWorld(c, x0);
  const log: WorldState[] = [w];
  for (let i = 0; i < ticks; i++) { w = stepWorld(w, { ...NO_INPUT, run: true, squat: true, ...input(w) }, c); log.push(w); }
  return { w, log };
};

describe('the climb: where the limits come from', () => {
  it('the hands reach 2.2 m from the ground and a jump adds the height gained while the body is slow enough to catch', () => {
    expect(CLIMB_HAND).toBeCloseTo(2.1, 6);
    expect(CLIMB_STAND_REACH).toBeCloseTo(2.2, 6);
    // 4.5 m/s take-off: the feet are (4.5^2 - 2^2) / (2 g) = 0.83 m up when the upward speed has dropped to the catch speed
    expect(climbMaxRise(4.5)).toBeCloseTo(2.2 + (4.5 ** 2 - CLIMB_CATCH_VY ** 2) / (2 * 9.81) - 0.2, 2);
    expect(climbMaxRise(4.5)).toBeGreaterThan(2.7);
    expect(climbMaxRise(4.5)).toBeLessThan(3.0);
    expect(climbMaxRise(5.5)).toBeGreaterThan(climbMaxRise(4.5)); // a stronger jump reaches higher
  });
  it('walls from 1 m up to the limit are climbable and walls above it are not', () => {
    expect(climbable(CLIMB_MIN_RISE)).toBe(true);
    expect(climbable(2.0)).toBe(true);
    expect(climbable(climbMaxRise())).toBe(true);
    expect(climbable(climbMaxRise() + 0.1)).toBe(false);
    expect(climbable(0.9)).toBe(false); // a jump or a vault does that
  });
  it('findClimb: the hands must meet the edge, from the ground or in the air', () => {
    const t = wall(2.0).terrain;
    expect(findClimb(t, 19.7, 0, 5, 0)).not.toBeNull(); // on the ground at the foot of a 2 m wall
    expect(findClimb(t, 17, 0, 5, 0)).toBeNull(); // too far from the wall
    expect(findClimb(wall(2.5).terrain, 19.7, 0, 5, 0)).toBeNull(); // 2.5 m is out of reach standing (2.2 m)
    expect(findClimb(wall(2.5).terrain, 19.7, 0.6, 1, 0)).not.toBeNull(); // 0.6 m up in a jump, the edge is in reach
    expect(findClimb(wall(2.5).terrain, 19.7, 0.6, 1, 4)).toBeNull(); // rising too fast to close the hands
    expect(findClimb(wall(3.2).terrain, 19.7, 1.0, 1, 0)).toBeNull(); // above the limit even at the top of a jump
  });
});

describe('the climb: what it costs', () => {
  const c = wall(2.0);
  const r = run(c, 120 * 7, (w) => ({ handR: true, handL: true, run: w.mode === 'run' }));
  it('the run speed is lost: the climb ends on the top at a walking pace', () => {
    const afterIdx = r.log.findIndex((w, i) => i > 0 && r.log[i - 1].mode === 'climb' && w.mode === 'run');
    expect(afterIdx).toBeGreaterThan(0);
    const w = r.log[afterIdx];
    expect(w.runner.vx).toBeCloseTo(CLIMB_EXIT_SPEED, 6);
    expect(w.runner.grounded).toBe(true);
    expect(w.runner.y).toBeCloseTo(2.0, 6);
    expect(Math.max(...r.log.slice(0, afterIdx).map((x) => x.runner.vx))).toBeGreaterThan(6); // it had been running fast
  });
  it('takes 1 to 1.5 s from grab to standing and costs as much energy as two jumps', () => {
    const start = r.log.findIndex((w) => w.mode === 'climb');
    const end = r.log.findIndex((w, i) => i > start && w.mode === 'run');
    expect(start).toBeGreaterThan(0);
    expect((end - start) / 120).toBeGreaterThanOrEqual(1.0);
    expect((end - start) / 120).toBeLessThanOrEqual(1.5);
    expect(end - start).toBe(CLIMB_TICKS);
    expect(r.log[start].energy).toBeCloseTo(1 - CLIMB_COST, 9);
    expect(CLIMB_COST).toBeCloseTo(2 * JUMP_COST, 9);
  });
  it('never teleports: no tick moves the feet further than the hands pull', () => {
    const start = r.log.findIndex((w) => w.mode === 'climb');
    const end = r.log.findIndex((w, i) => i > start && w.mode === 'run');
    for (let i = start + 1; i <= end; i++) {
      const a = r.log[i - 1].runner, b = r.log[i].runner;
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(0.05);
    }
  });
  it('letting go of the hold key while hanging drops the body; after the pull-up starts it is committed', () => {
    const early = run(c, 120 * 8, (w) => ({ handR: w.mode !== 'climb' || w.climb!.i < 10, handL: w.mode !== 'climb' || w.climb!.i < 10, run: w.mode === 'run' }));
    expect(early.log.some((w) => w.events.some((e) => e.type === 'climb-drop'))).toBe(true);
    const late = run(c, 120 * 8, (w) => ({ handR: w.mode !== 'climb' || w.climb!.i < 60, handL: w.mode !== 'climb' || w.climb!.i < 60, run: w.mode === 'run' }));
    expect(late.log.some((w) => w.events.some((e) => e.type === 'climb-drop'))).toBe(false);
    expect(late.log.some((w) => w.mode === 'climb')).toBe(true);
  });
});

describe('the climb: the search and the lane', () => {
  it('the ideal run climbs a 2 m wall that no vault or jump makes, and clears the course', () => {
    const c = wall(2.0);
    const r = searchIdealRun(c);
    expect(r.cleared).toBe(true);
    expect(r.plan.climbXs?.length ?? 0).toBeGreaterThan(0);
    expect(playPlan(c, { jumpXs: [], releaseAfter: 60, bouncePress: 8 }).world.outcome).not.toBe('cleared'); // running at it does not
  });
  it('a 2.6 m wall needs a jump and the grab (standing reach is 2.2 m); a 3.2 m wall is not climbable', () => {
    expect(searchIdealRun(wall(2.6)).cleared).toBe(true);
    expect(searchIdealRun(wall(3.2)).cleared).toBe(false);
  });
});
