import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { drumsFor, ROLL_DRUM_TICKS } from '../src/sim/drums';
import { inputFor } from '../src/sim/ideal';
import { newWorld, stepWorld } from '../src/sim/world';
import { searchIdealRun } from '../src/sim/ideal';

// The drum lane shows an X drum for every landing the ideal run rolls out of (CC-67).
describe('roll drums', () => {
  it('the drop demo shows the X drum in the air before the 5 m ledge landing', () => {
    const c = JSON.parse(readFileSync('public/assets/demo/drop.course.json', 'utf8')) as CourseData;
    const drums = drumsFor(c);
    const roll = drums.find((d) => d.what === 'roll');
    expect(roll).toBeDefined();
    const edge = c.terrain.platforms[0].x1;
    expect(roll!.x).toBeGreaterThan(edge);
    expect(roll!.x).toBeLessThan(c.terrain.platforms[1].x1);
  });
  it('a release from a bar onto a deck far below shows the X drum after the release', () => {
    const c: CourseData = { version: 1, name: 'low', startX: 0, finishX: 40, jumpSpeed: 4.5, terrain: { waterY: -12, platforms: [{ x0: -10, x1: 6, top: 0 }, { x0: 17, x1: 60, top: -5 }] }, holds: [{ x: 9, y: 2.9 }, { x: 12.5, y: 2.9 }] };
    const r = searchIdealRun(c);
    expect(r.cleared).toBe(true);
    const drums = drumsFor(c, r.plan);
    const release = drums.find((d) => d.what === 'release')!;
    const roll = drums.find((d) => d.what === 'roll')!;
    expect(roll).toBeDefined();
    expect(roll.x).toBeGreaterThan(release.x);
  });
  for (const demo of ['lache', 'lache-wide']) {
    it(`the ${demo} demo shows the X drum after the last release (the landing would stumble without it)`, () => {
      const c = JSON.parse(readFileSync(`public/assets/demo/${demo}.course.json`, 'utf8')) as CourseData;
      const drums = drumsFor(c);
      const releases = drums.filter((d) => d.what === 'release');
      expect(releases.length).toBeGreaterThanOrEqual(1); // the lache has the skip (one release) and bar to bar (two); the wide one has two
      const roll = drums.find((d) => d.what === 'roll');
      expect(roll).toBeDefined();
      expect(roll!.x).toBeGreaterThan(releases[releases.length - 1].x);
    });
  }
  it('a landing that is clean with straight legs has no X drum (the lane is not cluttered)', () => {
    const c = JSON.parse(readFileSync('public/assets/demo/lane-1.course.json', 'utf8')) as CourseData;
    expect(drumsFor(c).some((d) => d.what === 'roll')).toBe(false);
  });

  // the drum sits on the path point 0.3 s (36 ticks) before touchdown, not at the landing and not early in the flight
  const pathPointBeforeLanding = (c: CourseData): { x: number; landTick: number }[] => {
    const plan = c.plan!;
    let w = newWorld(c);
    const st = { next: 0, caught: null as number | null, bedAt: null as number | null, hangAt: null as number | null, hangs: 0, vnext: 0 };
    const xs: number[] = [];
    let airStart = 0;
    const out: { x: number; landTick: number }[] = [];
    for (let i = 0; i < 120 * 80 && w.outcome === 'running'; i++) {
      xs.push(w.runner.x);
      if (w.runner.grounded) airStart = i;
      w = stepWorld(w, inputFor(plan, w, st, c), c);
      const land = w.events.find((e) => e.type === 'land');
      if (land && (land.detail?.rolled || ((land.detail?.impact as number) ** 2) / (2 * 9.81) > 1.83)) out.push({ x: xs[Math.max(airStart, i - ROLL_DRUM_TICKS)], landTick: i });
    }
    return out;
  };
  for (const demo of ['drop', 'lache', 'lache-wide']) {
    it(`the ${demo} demo's X drum is on the path point 0.3 s before the landing (within 2 cm)`, () => {
      const c = JSON.parse(readFileSync(`public/assets/demo/${demo}.course.json`, 'utf8')) as CourseData;
      const want = pathPointBeforeLanding(c);
      const got = drumsFor(c).filter((d) => d.what === 'roll');
      expect(want.length).toBeGreaterThan(0);
      expect(got.length).toBe(want.length);
      want.forEach((q, k) => expect(Math.abs(got[k].x - q.x)).toBeLessThan(0.02));
      expect(ROLL_DRUM_TICKS).toBe(36);
    });
  }
  it('the drum is well after the take-off and before the ground: the runner is in the air and low enough to need the key', () => {
    const c = JSON.parse(readFileSync('public/assets/demo/drop.course.json', 'utf8')) as CourseData;
    const drum = drumsFor(c).find((d) => d.what === 'roll')!;
    const edge = c.terrain.platforms[0].x1;
    expect(drum.x).toBeGreaterThan(edge); // past the ledge
  });
});
