import { describe, expect, it } from 'vitest';
import { EXPERIMENTS } from '../src/sim/experiments';
import { addTry, discovered, type Try } from '../src/modes/sayings';

const knob = { min: 2, max: 10 };
const run = (...vs: [number, number][]): Try[] => vs.reduce<Try[]>((l, [v, a]) => addTry(l, { v, a }, knob), []);

describe('a saying is earned only by discovery (CC-14)', () => {
  it('not by one lucky run', () => expect(discovered(run([6, 5]), knob)).toBe(false));
  it('not by three runs with the slider nudged a hair', () => expect(discovered(run([6, 5], [6.1, 5.1], [6.2, 5.2]), knob)).toBe(false));
  it('not by the same setting pressed three times', () => expect(discovered(run([6, 5], [6, 5], [6, 5]), knob)).toBe(false));
  it('not by three different settings that gave the same answer', () => expect(discovered(run([3, 5], [6, 5.05], [9, 5.1]), knob)).toBe(false));
  it('not by two runs, however different', () => expect(discovered(run([3, 1], [9, 9]), knob)).toBe(false));
  it('yes by three clearly different settings with clearly different answers', () => expect(discovered(run([3, 2], [6, 6], [9, 14]), knob)).toBe(true));
  it('counts a repeated setting once', () => expect(run([6, 5], [6.1, 5], [6.2, 5]).length).toBe(1));
});

describe('the sayings themselves (docs/sayings.md)', () => {
  const all = EXPERIMENTS.flatMap((e) => e.sayings);
  it('every obstacle has at least one', () => { for (const e of EXPERIMENTS) expect(e.sayings.length).toBeGreaterThan(0); });
  it('are short, with no numbers and no formulas', () => {
    for (const s of all) {
      expect(s.split(/\s+/).length, s).toBeLessThanOrEqual(15);
      expect(s, s).not.toMatch(/[0-9=×÷√²]/);
    }
  });
});
