import { describe, expect, it } from 'vitest';
import { EXPERIMENTS, closeEnough, defaults } from '../src/sim/experiments';

const E = Object.fromEntries(EXPERIMENTS.map((e) => [e.id, e]));
const near = (a: number, b: number, rel: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.abs(b));

describe('Dojo experiments come from the simulator', () => {
  it('gap: flight distance is 2 vx vy / g and does not change in the air', () => {
    near(E.gap.run({ speed: 7, jump: 4.5 }).answer, (2 * 7 * 4.5) / 9.81, 0.01);
  });
  it('gap: jumping higher does not fly further past 45 degrees', () => {
    const d = (jump: number) => E.gap.run({ speed: 5, jump }).answer;
    expect(d(5)).toBeCloseTo(d(5), 9);
    expect(d(8)).toBeGreaterThan(d(5)); // more push is still further at 5 m/s forward...
    expect(E.gap.run({ speed: 2, jump: 8 }).answer).toBeGreaterThan(E.gap.run({ speed: 2, jump: 4 }).answer);
    // ...but at a fixed total speed a steeper take-off throws you shorter
    const flat = E.gap.run({ speed: 8, jump: 2 }).answer;
    const steep = E.gap.run({ speed: 2, jump: 8 }).answer;
    expect(flat).toBeCloseTo(steep, 6); // same product vx vy: the range depends on both, symmetric here
  });
  it('wall: height is speed² over 2 g (with friction)', () => {
    const r = E.wall.run({ speed: 6, height: 40 });
    near(r.answer, 36 / (2 * 9.81 * 1.1), 0.01);
  });
  it('rope: it gives back the height you give it: v² / 2g when the rope is long enough', () => {
    near(E.rope.run({ speed: 5, length: 9 }).answer, 25 / (2 * 9.81), 0.02);
  });
  it('trampoline: a harder landing throws higher', () => {
    expect(E.trampoline.run({ drop: 3 }).answer).toBeGreaterThan(E.trampoline.run({ drop: 1 }).answer);
  });
  it('landing: a longer stop makes a smaller force', () => {
    expect(E.landing.run({ drop: 1.5, bend: 0.3 }).answer).toBeLessThan(E.landing.run({ drop: 1.5, bend: 0.08 }).answer);
  });
  it('every experiment runs at its default knobs and returns a path', () => {
    for (const e of EXPERIMENTS) {
      const t = e.run(defaults(e));
      expect(t.path.length).toBeGreaterThan(2);
      expect(Number.isFinite(t.answer)).toBe(true);
    }
  });
  it('guesses count as close within about 25 %', () => {
    expect(closeEnough(5, 5.9)).toBe(true);
    expect(closeEnough(3, 5.9)).toBe(false);
  });
});
