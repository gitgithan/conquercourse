import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { searchIdealRun } from '../src/sim/ideal';
import { EXPERIMENTS } from '../src/sim/experiments';
import { standingPush, DEFAULT_RECOIL } from '../src/sim/recoil';
import { LESSONS } from '../src/modes/lessons';
import { fixRecoil } from '../src/slice/fixrecoil';
import { withRecoil } from '../src/slice/recoil-lane';

const lane = (gap: number): CourseData => ({
  version: 1, name: 'lane', startX: 0, finishX: 16 + gap + 8, jumpSpeed: 4.5,
  terrain: { waterY: -4, platforms: [{ x0: -10, x1: 16, top: 0 }, { x0: 16 + gap, x1: 16 + gap + 20, top: 0 }] },
});

describe('a lane with a launcher (editor)', () => {
  it('puts a pad on the start deck and keeps the lane', () => {
    const c = withRecoil(lane(10.5), { kind: 'cannon', ballMass: 12, muzzle: 30 });
    expect(c.recoil).toMatchObject({ x0: 1.5, x1: 4, kind: 'cannon', ballMass: 12, muzzle: 30 });
    expect(c.terrain.platforms.length).toBe(2);
  });
  it('a start deck with no room for a pad gets none', () => {
    const c = lane(10.5);
    c.terrain.platforms[0].x1 = 2.5;
    expect(withRecoil(c, { kind: 'cannon', ballMass: 12, muzzle: 30 }).recoil).toBeUndefined();
  });
  it('the proof knows the launcher: a 10.5 m gap clears with the default ball and not without one', () => {
    expect(searchIdealRun(withRecoil(lane(10.5), { kind: 'cannon', ballMass: 12, muzzle: 30 })).cleared).toBe(true);
    expect(searchIdealRun(lane(10.5)).cleared).toBe(false);
  });
});

describe('Fix it for the launcher', () => {
  it('a lane that already clears is left alone', () => {
    const r = fixRecoil(lane(10.5), { kind: 'cannon', ballMass: 12, muzzle: 30 });
    expect(r.ok).toBe(true);
    expect(r.steps).toEqual([]);
  });
  it('a weak ball gets the smallest change that clears, and the proof agrees', () => {
    const weak = { kind: 'cannon' as const, ballMass: 4, muzzle: 10 };
    const r = fixRecoil(lane(10.5), weak);
    expect(r.ok).toBe(true);
    expect(r.cfg.ballMass * r.cfg.muzzle).toBeGreaterThan(weak.ballMass * weak.muzzle);
    expect(searchIdealRun(withRecoil(lane(10.5), r.cfg)).cleared).toBe(true);
  });
  it('a gap no launcher can cross says so', () => {
    expect(fixRecoil(lane(30), { kind: 'cannon', ballMass: 12, muzzle: 30 }).ok).toBe(false);
  });
}, 120000);

describe('the Dojo lesson for recoil', () => {
  const exp = EXPERIMENTS.find((e) => e.id === 'recoil')!;
  it('the experiment answer is the push the simulator gives', () => {
    const t = exp.run({ mass: 12, muzzle: 30 });
    expect(t.answer).toBeCloseTo(standingPush({ ...DEFAULT_RECOIL, ballMass: 12, muzzle: 30 }), 9);
  });
  it('a faster ball gives a proportionally bigger push (a straight line)', () => {
    const a = exp.run({ mass: 12, muzzle: 15 }).answer, b = exp.run({ mass: 12, muzzle: 30 }).answer;
    expect(b / a).toBeCloseTo(2, 9);
  });
  it('the lesson formula agrees with the experiment', () => {
    const v = { mass: 20, muzzle: 25 };
    expect(LESSONS.recoil.calc(v).value).toBeCloseTo(exp.run(v).answer, 9);
  });
  it('the words stay plain: no formula in the Course-facing text', () => {
    expect(exp.sayings.join(' ')).not.toMatch(/[=×÷]/);
  });
});
