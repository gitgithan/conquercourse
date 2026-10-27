import { describe, expect, it } from 'vitest';
import { EXPERIMENTS, classify, closeEnough, defaults, sweep } from '../src/sim/experiments';

const E = Object.fromEntries(EXPERIMENTS.map((e) => [e.id, e]));
const near = (a: number, b: number, rel: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.abs(b));

describe('Dojo experiments come from the simulator', () => {
  it('gap: flight distance is 2 vx vy / g', () => {
    near(E.gap.run({ speed: 7, jump: 4.5 }).answer, (2 * 7 * 4.5) / 9.81, 0.01);
  });
  it('gap: the far side comes from the Course when it is passed in', () => {
    expect(E.gap.run({ speed: 7, jump: 4.5 }, { width: 4.5 }).cleared).toBe(true);
    expect(E.gap.run({ speed: 5, jump: 4.5 }, { width: 6.5 }).cleared).toBe(false);
  });
  it('wall: the same speed reaches the same height whatever the wall height (R1-W1)', () => {
    const h = (H: number) => E.wall.run({ speed: 6, height: H }).answer;
    near(h(3), h(6), 0.005);
    near(h(2), h(5), 0.005);
  });
  it('wall: height is v² over 2 g with a little friction', () => {
    near(E.wall.run({ speed: 6, height: 4.3 }).answer, 36 / (2 * 9.81 * 1.1), 0.01);
  });
  it('wall: the wall height only decides whether the hands reach', () => {
    expect(E.wall.run({ speed: 8, height: 4.3 }).cleared).toBe(true);
    expect(E.wall.run({ speed: 7, height: 6 }).cleared).toBe(false);
  });
  it('rope: letting go at the best moment flies further than too early or too late', () => {
    const d = (a: number) => E.rope.run({ speed: 8, length: 5, angle: a }).answer;
    expect(d(50)).toBeGreaterThan(d(10));
    expect(d(50)).toBeGreaterThan(d(110));
  });
  it('rope: a swing too weak for the chosen angle never gets there', () => {
    expect(E.rope.run({ speed: 3, length: 5, angle: 100 }).answer).toBe(0);
  });
  it('trampoline: a harder landing throws higher', () => {
    expect(E.trampoline.run({ drop: 3 }).answer).toBeGreaterThan(E.trampoline.run({ drop: 1 }).answer);
  });
  it('landing: a longer stop makes a smaller push', () => {
    expect(E.landing.run({ drop: 1.5, bend: 0.3 }).answer).toBeLessThan(E.landing.run({ drop: 1.5, bend: 0.1 }).answer);
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

describe('the shape of each relationship is found from the simulator', () => {
  const shape = (id: string, knob: string) => classify(sweep(E[id], defaults(E[id]), knob)).shape;
  it('gap distance grows in direct proportion to speed and to the push', () => {
    expect(shape('gap', 'speed')).toBe('direct');
    expect(shape('gap', 'jump')).toBe('direct');
  });
  it('wall height grows with the square of speed', () => expect(shape('wall', 'speed')).toBe('square'));
  it('trampoline height grows in direct proportion to the drop', () => expect(shape('trampoline', 'drop')).toBe('direct'));
  it('landing push falls in inverse proportion to the stop time', () => expect(shape('landing', 'bend')).toBe('inverse'));
  it('landing push grows with the square root of the drop', () => expect(shape('landing', 'drop')).toBe('root'));
  it('rope distance rises then falls with the release angle (a hump)', () => expect(shape('rope', 'angle')).toBe('hump'));
});
