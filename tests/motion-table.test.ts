import { describe, expect, it } from 'vitest';
import { MOTION_TABLE, ROLL_GET_UP_S, ROLL_TICKS, moveProgress, motionGaps, rollLookFrom } from '../src/motion/motion-table';
import { chooseClip, type ActorState } from '../src/motion/actor-pose';
import { actorStateFor } from '../src/motion/actor-state';
import { DEFAULT_LANDING } from '../src/sim/landing';
import { NO_INPUT } from '../src/sim/runner';
import { newWorld, stepWorld, type WorldState } from '../src/sim/world';
import type { CourseData } from '../src/course/course';

const base: ActorState = { tick: 1000, x: 10, y: 0, vx: 5, vy: 0, grounded: true, mode: 'run', squat: false, landedTicksAgo: null, facing: 1 };

describe('motion table (CC-64)', () => {
  it('a roll lasts as long as the simulator says the roll takes', () => {
    expect(ROLL_TICKS).toBe(Math.round((DEFAULT_LANDING.rollStopTime + ROLL_GET_UP_S) * 120)); // the stop time, then the get-up
    expect(MOTION_TABLE.roll.ticks).toBe(ROLL_TICKS);
  });
  it('progress runs 0 to 1 from the roll landing and is off before and after', () => {
    expect(moveProgress(MOTION_TABLE.roll, 500, 499)).toBeNull();
    expect(moveProgress(MOTION_TABLE.roll, 500, 500)).toBe(0);
    expect(moveProgress(MOTION_TABLE.roll, 500, 500 + ROLL_TICKS / 2)).toBeCloseTo(0.5, 6);
    expect(moveProgress(MOTION_TABLE.roll, 500, 500 + ROLL_TICKS)).toBeNull();
    expect(moveProgress(MOTION_TABLE.vault, 500, 510)).toBeNull(); // a move with no fixed length has no progress
  });
  it('the roll is chosen while it lasts, then the usual clips come back', () => {
    expect(chooseClip({ ...base, rolledAt: 1000 - 10 })).toBe('roll');
    expect(chooseClip({ ...base, rolledAt: 1000 - ROLL_TICKS })).toBe('run');
    expect(chooseClip({ ...base, rolledAt: -1000 })).toBe('run');
    expect(chooseClip({ ...base, mode: 'swing', grounded: false, rolledAt: 995 })).toBe('swing'); // only a run-mode body rolls
  });
  it('?roll= picks how the roll is shown', () => {
    expect(rollLookFrom('')).toBe('auto');
    expect(rollLookFrom('?roll=crouch')).toBe('crouch');
    expect(rollLookFrom('?roll=clip')).toBe('clip');
    expect(rollLookFrom('?roll=banana')).toBe('auto');
  });
  it('the moves that still have no motion are listed, never hidden', () => {
    expect(motionGaps()).toEqual(expect.arrayContaining(['hurt', 'giant-swing']));
    expect(motionGaps()).not.toContain('vault'); // the vault has a clip (CC-68)
    expect(motionGaps()).not.toContain('roll'); // the roll always has its tuck
  });
});

describe('the simulator tells the actor about a roll', () => {
  const h = 4;
  const course: CourseData = {
    version: 1, name: 'drop', startX: 0, finishX: 60, jumpSpeed: 4.5,
    terrain: { waterY: -h - 3, platforms: [{ x0: -10, x1: 10, top: h }, { x0: 10.001, x1: 80, top: 0 }] },
  };
  function fall(roll: boolean): WorldState {
    let w = newWorld(course, 4);
    w.runner = { ...w.runner, x: 4, y: h, vx: 7 };
    for (let i = 0; i < 120 * 8 && w.outcome === 'running' && !(w.runner.landing && w.runner.grounded && w.runner.x > 10); i++) {
      const near = !w.runner.grounded && w.runner.y < 1.2;
      w = stepWorld(w, { ...NO_INPUT, run: true, roll: roll && near }, course);
    }
    return w;
  }
  it('a rolled landing stamps rolledAt and the actor state carries it', () => {
    const w = fall(true);
    expect(Math.abs(w.rolledAt - w.runner.landedAtTick!)).toBeLessThan(1); // the tick the landing was seen in
    const s = actorStateFor(w, false);
    expect(s.rolledAt).toBe(w.rolledAt);
    expect(chooseClip({ ...s, tick: w.rolledAt + 5 })).toBe('roll');
  });
  it('a landing without a roll does not', () => {
    const w = fall(false);
    expect(w.rolledAt).toBe(-1000);
    expect(chooseClip(actorStateFor(w, false))).not.toBe('roll');
  });
});
