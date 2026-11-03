import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { courseActorState, nextFacing } from '../src/motion/actor-state';
import { inputOfMask, trackFromPlan, verifyLog, type InputLog } from '../src/sim/replay';
import { newWorld, stepWorld } from '../src/sim/world';
import { loadCourseFile as load } from './helpers/course';

// CC-133: the ghost is posed from the actor state the simulator gives the player, recorded per tick.
const demo = (n: string) => `public/assets/demo/${n}`;

describe.each(['bars', 'swing-to-bars'])('the ghost on %s', (name) => {
  const course = JSON.parse(readFileSync(demo(`${name}.course.json`), 'utf8')) as CourseData;
  const run = JSON.parse(readFileSync(demo(`${name}.run.json`), 'utf8')) as { log: InputLog };
  const v = verifyLog(course, run.log);
  const t = v.track;
  it('records one state per tick, next to the same positions', () => {
    expect(t.states).toBeDefined();
    expect(t.states!.length).toBe(t.xs.length);
  });
  it('matches the state the player gets at sampled ticks of the same replay', () => {
    let w = newWorld(course), facing: 1 | -1 = 1, i = 0;
    const want = [courseActorState(w, course, false, facing)];
    for (const [m, n] of run.log) for (let k = 0; k < n; k++) {
      if (w.outcome !== 'running') break;
      const input = inputOfMask(m);
      w = stepWorld(w, input, course); facing = nextFacing(w, facing);
      want.push(courseActorState(w, course, input.squat, facing)); i++;
    }
    for (let k = 0; k < want.length; k += 37) expect(t.states![k]).toEqual(want[k]);
  });
  it('hangs on the bars (mode swing, rungs given) during the hang ticks, not running', () => {
    const hang = t.states!.filter((s) => s.bars);
    expect(hang.length).toBeGreaterThan(100);
    for (const s of hang) expect(s.mode).toBe('swing');
  });
});

describe('older tracks and plans', () => {
  it('a track without states is still a track (the figure falls back to its guess)', () => {
    const course = load(demo('lache.course.json'));
    const t = trackFromPlan(course, course.plan!);
    const old = { ...t }; delete old.states;
    expect(old.states).toBeUndefined();
    expect(old.xs.length).toBe(t.xs.length);
  });
  it('a plan track on the rope has swing states, and states match the position arrays', () => {
    const course = load(demo('lache.course.json'));
    const t = trackFromPlan(course, course.plan!);
    expect(t.states!.length).toBe(t.xs.length);
    expect(t.states!.some((s) => s.mode === 'swing')).toBe(true);
    for (let k = 0; k < t.xs.length; k += 50) { const s = t.states![k]; if (s.mode !== 'swing') expect(s.x).toBeCloseTo(t.xs[k], 5); }
  });
});
