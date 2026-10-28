import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { playPlan, searchIdealRun, type Plan } from '../src/sim/ideal';
import { NO_INPUT } from '../src/sim/runner';
import { shot } from '../src/sim/recoil';
import { newWorld, recoilParams, stepWorld, type WorldState } from '../src/sim/world';

const demo = JSON.parse(readFileSync('public/assets/demo/recoil.course.json', 'utf8')) as CourseData;
const run = { ...NO_INPUT, run: true };

const advance = (w: WorldState, c: CourseData, ticks: number, input = run): WorldState => {
  for (let i = 0; i < ticks; i++) w = stepWorld(w, input, c);
  return w;
};

describe('recoil in the world', () => {
  it('stepping onto the pad clips the launcher on, once', () => {
    let w = newWorld(demo);
    expect(w.recoil?.armed ?? 0).toBe(0);
    while (w.runner.x < demo.recoil!.x0 + 0.5) w = stepWorld(w, run, demo);
    expect(w.recoil?.armed).toBe(1);
  });
  it('K off the pad does nothing', () => {
    let w = advance(newWorld(demo), demo, 20);
    expect(w.runner.x).toBeLessThan(demo.recoil!.x0);
    const before = w.runner.vx;
    w = stepWorld(w, { ...run, fire: true }, demo);
    expect(w.events.some((e) => e.type === 'recoil')).toBe(false);
    expect(w.runner.vx).toBeLessThanOrEqual(before + 0.2); // only the sprint's own gain
  });
  it('K on the pad pushes the runner forward by exactly the shot, and only once', () => {
    let w = newWorld(demo);
    while (w.runner.x < demo.recoil!.x0 + 0.3) w = stepWorld(w, run, demo);
    const vx = w.runner.vx;
    const without = stepWorld(w, run, demo).runner.vx; // what the sprint alone would do this tick
    const fired = stepWorld(w, { ...run, fire: true }, demo);
    const sh = shot(recoilParams(demo), vx, 0, false);
    expect(fired.runner.vx - without).toBeCloseTo(sh.dvx, 6);
    expect(fired.events.find((e) => e.type === 'recoil')).toBeTruthy();
    expect(fired.recoil?.armed).toBe(0);
    expect(fired.recoil?.balls.length).toBe(1);
    const again = stepWorld(fired, { ...run, fire: true }, demo);
    expect(again.events.some((e) => e.type === 'recoil')).toBe(false); // no second load
  });
  it('the ball flies backward and lands, behind the runner', () => {
    let w = newWorld(demo);
    while (w.runner.x < demo.recoil!.x0 + 0.3) w = stepWorld(w, run, demo);
    const x = w.runner.x;
    w = stepWorld(w, { ...run, fire: true }, demo);
    w = advance(w, demo, 240);
    const ball = w.recoil!.balls[0];
    expect(ball.landed).toBe(true);
    expect(ball.x).toBeLessThan(x);
  });
  it('in the air the shot adds to the speed and the flight carries it', () => {
    let w = newWorld(demo);
    while (w.runner.x < 10) w = stepWorld(w, run, demo);
    w = stepWorld(w, { ...run, jump: true }, demo);
    const vx = w.runner.vx;
    w = stepWorld(w, { ...run, fire: true }, demo);
    expect(w.runner.vx).toBeGreaterThan(vx + 3);
    const v2 = w.runner.vx;
    w = advance(w, demo, 30, NO_INPUT);
    expect(w.runner.vx).toBeCloseTo(v2, 9); // nothing slows it in the air
  });
});

describe('the recoil demo course', () => {
  const stripped: CourseData = { ...demo, recoil: undefined, plan: undefined };
  it('is a gap no run-up can jump: without the launcher no press clears it', () => {
    const r = searchIdealRun(stripped);
    expect(r.cleared).toBe(false);
  });
  it('the stored plan clears it, with a shot', () => {
    expect(demo.plan?.fireAfterJump !== undefined || demo.plan?.fireXs !== undefined).toBe(true);
    const r = playPlan(demo, demo.plan as Plan);
    expect(r.world.outcome).toBe('cleared');
    expect(r.events.some((e) => e.type === 'recoil')).toBe(true);
  });
  it('a light and slow ball is too little: the same line falls short', () => {
    const weak: CourseData = { ...demo, recoil: { ...demo.recoil!, ballMass: 2, muzzle: 10 } };
    expect(playPlan(weak, demo.plan as Plan).world.outcome).toBe('splash');
  });
  it('a heavy ball at the same speed pushes harder than a light one (the lesson)', () => {
    const heavy = shot(recoilParams({ ...demo, recoil: { ...demo.recoil!, ballMass: 20 } }), 7, 0, true).dvx;
    const light = shot(recoilParams({ ...demo, recoil: { ...demo.recoil!, ballMass: 5 } }), 7, 0, true).dvx;
    expect(heavy).toBeGreaterThan(light * 2);
  });
  it('a ball half as heavy and twice as fast gives about the same push', () => {
    const a = shot(recoilParams({ ...demo, recoil: { ...demo.recoil!, ballMass: 12, muzzle: 30 } }), 0, 0, false).dvx;
    const b = shot(recoilParams({ ...demo, recoil: { ...demo.recoil!, ballMass: 24, muzzle: 15 } }), 0, 0, false).dvx;
    expect(Math.abs(a - b) / a).toBeLessThan(0.18);
  });
});
