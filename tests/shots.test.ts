import { describe, expect, it } from 'vitest';
import { ballAt, ballHit, ballsAt, type ShotLauncher } from '../src/sim/shots';
import { newWorld, stepWorld } from '../src/sim/world';
import { NO_INPUT } from '../src/sim/runner';
import { courseHash } from '../src/sim/replay';
import base from '../src/course/default-course.json';
import type { CourseData } from '../src/course/course';
import { DT } from '../src/sim/units';

const L: ShotLauncher = { x: 40, y: 1, vx: -10, every: 3, phase: 1 };
const tickOf = (s: number) => Math.round(s / DT);

describe('timed balls: the same for every player', () => {
  it('a ball is not there before its time, then flies by its muzzle speed', () => {
    expect(ballAt(L, 0, tickOf(0.9))).toBeNull();
    const b = ballAt(L, 0, tickOf(2))!; // one second after the shot
    expect(b.x).toBeCloseTo(30, 1);
    expect(b.y).toBeCloseTo(1 - 0.5 * 9.81, 1); // gravity pulls it down
  });
  it('shots come every `every` seconds: shot k is shot 0 delayed by k * every', () => {
    const a = ballAt(L, 0, tickOf(2))!, b = ballAt(L, 2, tickOf(2 + 2 * 3))!;
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(b.y).toBeCloseTo(a.y, 6);
  });
  it('asking twice, or in any order, gives the same balls (no hidden state)', () => {
    const first = ballsAt([L], 900), second = (ballsAt([L], 100), ballsAt([L], 900));
    expect(second).toEqual(first);
  });
  it('a ball is gone after its life', () => {
    expect(ballsAt([{ ...L, life: 2 }], tickOf(1 + 2.5))).toHaveLength(0);
  });
  it('two balls are in the air at once when the flight is longer than the gap', () => {
    expect(ballsAt([{ ...L, vy: 6, every: 1 }], tickOf(4)).length).toBeGreaterThan(1);
  });
});

describe('a hit', () => {
  it('a ball through the body hits; one over the head or under the feet does not', () => {
    const s: ShotLauncher = { x: 10, y: 1, vx: 0, every: 100, phase: 0 };
    expect(ballHit([{ ...s, y: 1 }], 1, 10, 0, 0)).not.toBeNull();
    expect(ballHit([{ ...s, y: 3 }], 1, 10, 0, 0)).toBeNull();
    expect(ballHit([{ ...s, y: -1 }], 1, 10, 0, 0)).toBeNull();
  });
  it('standing in the way at the moment the ball arrives is hurt; standing 5 m further on is not', () => {
    const course = { ...(base as unknown as CourseData), shots: [{ x: 20, y: 0.9, vx: -10, vy: 9.81, every: 100, phase: 0.5, life: 10 }] } as CourseData;
    const stand = (x: number) => {
      let w = { ...newWorld(course) }; w = { ...w, runner: { ...w.runner, x } };
      // gravity bends the ball, so it leaves going up at g and is level at 0.9 m again 2 s later, at x = 0
      for (let i = 0; i < tickOf(2.5) + 40; i++) w = stepWorld(w, NO_INPUT, course);
      return w;
    };
    expect(stand(0).outcome).toBe('hurt');
    expect(stand(5).outcome).toBe('running');
    expect(stand(0).events.some((e) => e.type === 'ball-hit')).toBe(true);
  });
  it('the same inputs always end the same way (replayable)', () => {
    const course = { ...(base as unknown as CourseData), shots: [{ x: 20, y: 0.9, vx: -10, every: 2, phase: 0.5 }] } as CourseData;
    const run = () => { let w = newWorld(course); for (let i = 0; i < 600; i++) w = stepWorld(w, { ...NO_INPUT, run: true }, course); return [w.outcome, w.runner.x, w.runner.tick]; };
    expect(run()).toEqual(run());
  });
});

describe('courses without shots', () => {
  it('play exactly as before: the same world with the field set to an empty list', () => {
    const plain = base as unknown as CourseData, none = { ...plain, shots: [] } as CourseData;
    const play = (c: CourseData) => { let w = newWorld(c); for (let i = 0; i < 900; i++) w = stepWorld(w, { ...NO_INPUT, run: i % 200 < 150 }, c); return JSON.stringify(w.runner); };
    expect(play(none)).toBe(play(plain));
  });
  it('shots change the course hash, so the old ideal run is not trusted for a new course', () => {
    const plain = base as unknown as CourseData;
    expect(courseHash({ ...plain, shots: [L] } as CourseData)).not.toBe(courseHash(plain));
  });
});

describe('the ball switch (CC-240)', () => {
  it('the balls are off unless ?balls=1', async () => {
    const { ballsOn } = await import('../src/sim/shots');
    expect(ballsOn(new URLSearchParams(''))).toBe(false);
    expect(ballsOn(new URLSearchParams('balls=0'))).toBe(false);
    expect(ballsOn(new URLSearchParams('balls=1'))).toBe(true);
  });
  it('the First Course has no balls in its data, so its plans and hashes stay valid', () => {
    expect((base as unknown as CourseData).shots).toBeUndefined();
  });
  it('with the three launchers the ideal run waits at the start and still clears', async () => {
    const { BALL_LAUNCHERS } = await import('../src/sim/shots');
    const { searchIdealRun } = await import('../src/sim/ideal');
    const r = searchIdealRun({ ...(base as unknown as CourseData), shots: BALL_LAUNCHERS });
    expect(r.cleared).toBe(true);
  });
});
