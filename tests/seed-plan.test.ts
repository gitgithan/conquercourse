import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { playPlan, type Plan } from '../src/sim/ideal';
import { recordPlan, verifyLog } from '../src/sim/replay';
import { chooseWithSeeds, planFromLog } from '../src/sim/seed-plan';
import { loadDemoCourse as load } from './helpers/course';

// CC-176: a verified human line seeds the search; the faster of the two is kept, and a human line that beats the stored plan is a finding, not an error.
const humanLog = (c: CourseData, p: Plan) => recordPlan(c, p).recorder.snapshot();
const ticks = (c: CourseData, p: Plan) => { const r = playPlan(c, p); return r.world.outcome === 'cleared' ? r.world.runner.tick : null; };

describe('keys to plan', () => {
  for (const name of ['lache', 'bench-and-stairs', 'climb']) {
    it(`${name}: the plan read from the keys of the stored plan replays to the same time`, () => {
      const c = load(name);
      const log = humanLog(c, c.plan!);
      expect(verifyLog(c, log).cleared).toBe(true);
      const p = planFromLog(c, log, c.plan);
      expect(ticks(c, p)).toBe(ticks(c, c.plan!));
    });
  }
});

describe('seeded choice', () => {
  const c = load('lache');
  const good = c.plan!;
  // a stored plan made slow on purpose: the bar to bar route with a long first hang, which clears but takes longer than the skip
  let slow: Plan = good, slowTicks = 0;
  for (let h1 = 0; h1 <= 300; h1 += 30) for (let h2 = 0; h2 <= 480; h2 += 30) {
    const p: Plan = { ...good, hangTicks: [h1, h2] };
    delete p.airHands;
    const t = ticks(c, p);
    if (t !== null && t > slowTicks) { slow = p; slowTicks = t; }
  }
  it('the slow stored plan clears and is slower than the hand-made line', () => {
    expect(ticks(c, slow)).not.toBeNull();
    expect(ticks(c, good)!).toBeLessThan(ticks(c, slow)!);
  });
  it('a hand-made faster line beats the stored plan: the seed is kept, at most the human ticks', () => {
    const human = humanLog(c, good);
    const humanTicks = verifyLog(c, human).ticks;
    const r = chooseWithSeeds(c, slow, [human], { polish: false })!;
    expect(r.from).toBe('seed');
    expect(r.ticks).toBeLessThanOrEqual(humanTicks);
    expect(ticks(c, r.plan)).toBe(r.ticks);
  });
  it('a slower human line does not replace the stored plan', () => {
    const r = chooseWithSeeds(c, good, [humanLog(c, slow)], { polish: false })!;
    expect(r.from).toBe('search');
    expect(r.plan).toBe(good);
  });
  it('a log that does not clear is not used', () => {
    const r = chooseWithSeeds(c, good, [[[1, 200]]], { polish: false })!;
    expect(r.from).toBe('search');
    expect(r.seedTicks).toEqual([null]);
  });
  it('no stored plan: the seed is the plan', () => {
    const r = chooseWithSeeds(c, null, [humanLog(c, good)], { polish: false })!;
    expect(r.from).toBe('seed');
  });
});
