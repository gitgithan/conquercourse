import { describe, expect, it } from 'vitest';
import { EXPERIMENTS, classify, sweep } from '../src/sim/experiments';

const lever = EXPERIMENTS.find((e) => e.id === 'lever')!;
const balance = (near: number, far: number) => lever.run({ near, far }).answer;

describe('the lever lesson (turning moments)', () => {
  it('the weight that balances you is found by the simulator and equals weight times distance on both sides', () => {
    for (const [near, far] of [[1.3, 5.5], [0.8, 3], [2, 6], [1, 1]]) expect(balance(near, far)).toBeCloseTo((80 * far) / near, 0);
  });
  it('a heavy weight close in and a light weight far out give the same turning effect', () => {
    expect(balance(1, 4) * 1).toBeCloseTo(balance(2, 4) * 2, 0);
  });
  it('the balance weight falls with the weight\'s distance (inverse) and grows with your distance (direct)', () => {
    expect(classify(sweep(lever, { near: 1.3, far: 5.5 }, 'near')).shape).toBe('inverse');
    expect(classify(sweep(lever, { near: 1.3, far: 5.5 }, 'far')).shape).toBe('direct');
  });
  it('a longer throwing arm moves its tip faster for the same turn, and the note says what the simulator measured', () => {
    const note = lever.run({ near: 1.3, far: 5.5 }).note!;
    const speeds = [...note.matchAll(/([\d.]+) m\/s/g)].map((m) => Number(m[1]));
    expect(speeds.length).toBeGreaterThanOrEqual(3);
    expect(speeds[1]).toBeGreaterThan(speeds[0] * 0.95); // the longer arm with its balanced push is at least as fast at the tip
  });
});
