import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { flewOff } from '../src/sim/cart';
import { playPlan } from '../src/sim/ideal';
import { loadDemoCourse as load } from './helpers/course';


// The three merged courses (CC-97 / CC-115): each is cleared by its stored proof, and each keeps the thing it teaches.
describe('the merged courses', () => {
  it('Park run: the stored plan clears it, and it chains six real objects', () => {
    const c = load('park-run');
    expect(playPlan(c, c.plan!).world.outcome).toBe('cleared');
    expect(c.scene?.length).toBe(6);
  });
  it('Plank bridge: thick then thin clears, and the thin plank breaks without its post', () => {
    const c = load('plank-two');
    expect(c.planks?.map((p) => p.thickness)).toEqual([0.035, 0.02]);
    expect(playPlan(c, c.plan!).world.outcome).toBe('cleared');
    const noPost = JSON.parse(JSON.stringify(c)) as CourseData; delete noPost.planks![1].support;
    expect(playPlan(noPost, c.plan!).world.outcome).not.toBe('cleared');
  });
  it('Coaster: two hills clears with one brake, and without the brake the cart leaves the rails on the sharp hill', () => {
    const c = load('coaster-two-hills');
    expect(c.plan!.cartBrake!.length).toBe(1);
    const r = playPlan(c, c.plan!);
    expect(r.world.outcome).toBe('cleared');
    expect(flewOff(r.events)).toBe(false);
    expect(flewOff(playPlan(c, { ...c.plan!, cartBrake: [] }).events)).toBe(true);
    expect(c.plan!.cartBrake![0][0]).toBeGreaterThan(40); // the brake is for the second hill, not the first
  });
});
