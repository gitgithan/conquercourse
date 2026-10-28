import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { DEFAULT_DRONE, weight } from '../src/sim/drone';
import { holdThrust, EXPERIMENTS } from '../src/sim/experiments';
import { searchIdealRun } from '../src/sim/ideal';
import { withDrone } from '../src/slice/drone-lane';
import { fixDrone } from '../src/slice/fixdrone';
import { LESSONS } from '../src/modes/lessons';
import { DIAGRAM_IDS } from '../src/modes/diagrams';

const bare = (): CourseData => { const { drone: _d, plan: _p, routes: _r, ...c } = JSON.parse(readFileSync('public/assets/demo/drone.course.json', 'utf8')) as CourseData; void _d; void _p; void _r; return c; };

describe('the editor drone piece', () => {
  it('puts a pad with a drone on the start deck and the proof clears it', () => {
    const c = withDrone(bare(), { payload: 70, battery: 50 });
    expect(c.drone).toBeTruthy();
    expect(c.drone!.x1 - c.drone!.x0).toBeGreaterThanOrEqual(2);
    expect(searchIdealRun(c).cleared).toBe(true);
  });
  it('Fix it gives a bigger battery when the pack is too small', () => {
    const fix = fixDrone(bare(), { payload: 70, battery: 15 });
    expect(fix.ok).toBe(true);
    expect(fix.cfg.battery).toBeGreaterThan(15);
    expect(fix.steps[0]).toMatch(/Wh battery/);
    expect(searchIdealRun(withDrone(bare(), fix.cfg)).cleared).toBe(true);
  }, 120000);
});

describe('the Hover lesson', () => {
  it('the push needed is measured from the flying drone: the weight when level, weight over cos(lean) when leaning', () => {
    const level = holdThrust(70, 0);
    expect(level.thrust).toBeCloseTo(weight(DEFAULT_DRONE), 0);
    const lean = holdThrust(70, 30);
    expect(lean.thrust).toBeCloseTo(weight(DEFAULT_DRONE) / Math.cos((30 * Math.PI) / 180), 0);
    expect(holdThrust(140, 0).thrust).toBeGreaterThan(level.thrust);
    expect(lean.power).toBeGreaterThan(level.power);
  });
  it('is a full experiment with a lesson, a diagram and a saying', () => {
    const e = EXPERIMENTS.find((q) => q.id === 'drone')!;
    expect(e).toBeTruthy();
    const t = e.run({ payload: 70, lean: 0 });
    expect(t.answer).toBeCloseTo(weight(DEFAULT_DRONE), 0);
    expect(LESSONS.drone.formula).toMatch(/cos/);
    expect(DIAGRAM_IDS).toContain('drone');
    expect(e.sayings[0].split(/\s+/).length).toBeLessThanOrEqual(15);
  });
});
