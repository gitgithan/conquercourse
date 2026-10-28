import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { drumsFor } from '../src/sim/drums';
import { playPlan, searchIdealRun } from '../src/sim/ideal';
import { predictBand } from '../src/sim/predict';
import { NO_INPUT } from '../src/sim/runner';
import { newWorld, stepWorld } from '../src/sim/world';
import { withBand } from '../src/slice/band-lane';
import { fixBand } from '../src/slice/fixband';

const course = JSON.parse(readFileSync('public/assets/demo/band.course.json', 'utf8')) as CourseData;

describe('the Band demo course', () => {
  it('has a gap no run-up can jump, but the ideal run (stretch, turn, jump) clears it', () => {
    expect(playPlan(course, course.plan!).world.outcome).toBe('cleared');
    let best = 0;
    for (let x = -30; x <= 1.5; x += 0.25) {
      const r = playPlan(course, { jumpXs: [x], releaseAfter: 60, bouncePress: 8, bandStretch: 0 });
      expect(r.world.outcome, `a plain run-up jumped it from ${x}`).not.toBe('cleared');
      best = Math.max(best, r.maxX);
    }
    expect(best).toBeLessThan(course.terrain.platforms[1].x0); // no plain run-up reaches the far deck
  });
  it('a stretch that is too short lands in the water', () => {
    const r = playPlan(course, { ...course.plan!, bandStretch: 8 });
    expect(r.world.outcome).toBe('splash');
  });
  it('the drum lane shows the turn drum on the way out and the jump near the edge', () => {
    const drums = drumsFor(course);
    const turn = drums.find((d) => d.what === 'turn');
    expect(turn).toBeDefined();
    expect(turn!.x).toBeLessThan(-10); // the turn happens far behind the post
    expect(drums.some((d) => d.what === 'jump' && d.x > 0)).toBe(true);
  });
  it('the look ahead says where a turn now would land', () => {
    let w = newWorld(course);
    for (let i = 0; i < 120 * 6; i++) w = stepWorld(w, { ...NO_INPUT, left: true }, course); // pull for a while
    const p = predictBand(w, course);
    expect(['lands', 'splash']).toContain(p.result);
    expect(p.why.length).toBeGreaterThan(10);
  });
  it('Fix it for a band that is too stiff finds a softer one that clears', () => {
    const stiff: CourseData = { ...course, band: { ...course.band!, k: 150 } };
    delete stiff.plan;
    expect(searchIdealRun(stiff).cleared).toBe(false);
    const fix = fixBand(stiff);
    expect(fix.ok).toBe(true);
    expect(fix.k).toBeLessThan(150);
    expect(fix.steps.join(' ')).toMatch(/softer band/);
  });
  it('an editor lane can start at a band (withBand moves the lane a throw away)', () => {
    const lane: CourseData = { version: 1, name: 'lane', startX: 0, finishX: 30, jumpSpeed: 4.5, terrain: { waterY: -1.5, platforms: [{ x0: 0, x1: 6, top: 0 }, { x0: 8, x1: 30, top: 0 }] } };
    const c = withBand(lane, 35);
    expect(c.band).toMatchObject({ x: 0, k: 35 });
    expect(c.terrain.platforms[0]).toMatchObject({ x1: 1.5 });
    expect(newWorld(c).mode).toBe('band');
  });
});
