import { describe, expect, it } from 'vitest';
import { EXPERIMENTS } from '../src/sim/experiments';

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
