import { describe, expect, it } from 'vitest';
import { EXPERIMENTS, defaults } from '../src/sim/experiments';
import { LESSONS } from '../src/modes/lessons';

const E = Object.fromEntries(EXPERIMENTS.map((e) => [e.id, e]));

describe('the formula page calculates live from the sliders', () => {
  it('every formula input is a knob of its obstacle', () => {
    for (const e of EXPERIMENTS) for (const id of LESSONS[e.id].inputs) expect(e.knobs.map((k) => k.id)).toContain(id);
  });
  it('landing: the formula and the simulator agree exactly (push = speed ÷ stop time)', () => {
    for (const [drop, bend] of [[0.5, 0.05], [2.5, 0.1], [4, 0.5]]) {
      const v = { ...defaults(E.landing), drop, bend };
      expect(LESSONS.landing.calc(v).value).toBeCloseTo(E.landing.run(v).answer, 6);
    }
  });
  it('landing: the block under the push always has the same area for the same drop', () => {
    const area = (bend: number) => { const t = E.landing.run({ drop: 2, bend }); return t.path[2].x * t.path[2].y; };
    expect(area(0.1)).toBeCloseTo(area(0.4), 9);
  });
  it('gap: the formula matches the simulator for a level jump', () => {
    const v = { speed: 6, jump: 4 };
    expect(LESSONS.gap.calc(v).value).toBeCloseTo(E.gap.run(v).answer, 1);
  });
  it('wall: the wall height is not in the formula', () => {
    expect(LESSONS.wall.calc({ speed: 7, height: 3 }).value).toBe(LESSONS.wall.calc({ speed: 7, height: 6 }).value);
  });
});
