import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { playPlan } from '../src/sim/ideal';

const load = (n: string) => JSON.parse(readFileSync(`public/assets/demo/${n}.course.json`, 'utf8')) as CourseData;

describe('the coaster demo courses', () => {
  it('"Coaster" carries a proof that still clears (regenerate with npx tsx scripts/coaster-demos.ts if the simulator changed)', () => {
    const c = load('coaster');
    expect(c.plan).toBeDefined();
    expect(playPlan(c, c.plan!).world.outcome).toBe('cleared');
  });
  it('"a sharp hilltop" needs the brake: its proof brakes, and without it the cart leaves the rails', () => {
    const c = load('coaster-sharp');
    expect(c.plan?.cartBrake?.length).toBeGreaterThan(0);
    expect(playPlan(c, c.plan!).world.outcome).toBe('cleared');
    expect(playPlan(c, { ...c.plan!, cartBrake: [] }).world.outcome).not.toBe('cleared');
  });
  it('"first hill too low" cannot be cleared: it stalls, and it carries no proof', () => {
    const c = load('coaster-low');
    expect(c.plan).toBeUndefined();
    expect(playPlan(c, { jumpXs: [], releaseAfter: 0, bouncePress: 0, cartBrake: [] }).world.outcome).toBe('stalled');
  });
});
