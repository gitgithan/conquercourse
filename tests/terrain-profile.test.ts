import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, NO_INPUT, startState, step } from '../src/sim/runner';
import { groundAt, heightAt, type Terrain } from '../src/sim/terrain';
import { bumpProfile, buildCourse, fitPrimitives, proveCourse } from '../src/park/fit';
import { searchIdealRun } from '../src/sim/ideal';

const hill: Terrain = { waterY: -1.5, platforms: [{ x0: -10, x1: 12, top: 0 }, { x0: 12, x1: 15, top: 0.7, profile: bumpProfile(12, 15, 0.7) }, { x0: 15, x1: 40, top: 0 }] };

describe('curved tops', () => {
  it('the height follows the curve: level at the ends, highest in the middle, smooth between', () => {
    const p = hill.platforms[1];
    expect(heightAt(p, 12)).toBeCloseTo(0, 6);
    expect(heightAt(p, 13.5)).toBeCloseTo(0.7, 3);
    expect(heightAt(p, 15)).toBeCloseTo(0, 6);
    expect(heightAt(p, 12.75)).toBeGreaterThan(0.05);
    expect(heightAt(p, 12.75)).toBeLessThan(0.65);
    expect(groundAt(hill, 13.5)).toBeCloseTo(0.7, 3);
  });
  it('a flat platform is unchanged', () => expect(heightAt(hill.platforms[0], 3)).toBe(0));
  it('a runner crossing the hill follows its surface and never sinks into it', () => {
    let s = { ...startState(9), vx: 6 };
    let lowest = Infinity;
    for (let i = 0; i < 120; i++) {
      s = step(s, { ...NO_INPUT, run: true }, DEFAULT_PARAMS, hill);
      if (s.grounded && s.x > 12 && s.x < 15) lowest = Math.min(lowest, s.y - groundAt(hill, s.x));
    }
    expect(Math.abs(lowest)).toBeLessThan(1e-6);
  });
  it('a jump that lands on the curve lands on its surface, exactly', () => {
    let s = { ...startState(8), vx: 7 };
    s = step(s, { ...NO_INPUT, run: false, jump: true, jumpSpeed: 4.5 }, DEFAULT_PARAMS, hill);
    for (let i = 0; i < 400 && !s.grounded; i++) s = step(s, NO_INPUT, DEFAULT_PARAMS, hill);
    expect(s.grounded).toBe(true);
    expect(s.y).toBeCloseTo(groundAt(hill, s.x), 6);
  });
  it('a slope that is too steep stops the runner where it becomes too steep, not at the platform edge', () => {
    const wallish: Terrain = { waterY: -1.5, platforms: [{ x0: -10, x1: 10, top: 0 }, { x0: 10, x1: 14, top: 2, profile: [[10, 0], [11, 0], [11.2, 2], [14, 2]] }] };
    let s = { ...startState(8), vx: 7 };
    for (let i = 0; i < 300; i++) s = step(s, { ...NO_INPUT, run: true }, DEFAULT_PARAMS, wallish);
    expect(s.x).toBeGreaterThan(10.9);
    expect(s.x).toBeLessThan(11.2);
    expect(s.y).toBeLessThan(0.5);
  });
});

describe('a mound in a Park course', () => {
  const prims = fitPrimitives([
    { id: 1, phrase: 'bench', box: [0, 0, 100, 50], score: 1 },
    { id: 2, phrase: 'dome', box: [200, 0, 300, 50], score: 1, heightM: 0.8 },
  ]);
  it('becomes a platform with a curved top', () => {
    const c = buildCourse(prims, 'x');
    const m = c.terrain.platforms.find((p) => p.profile);
    expect(m).toBeDefined();
    expect(m!.top).toBeCloseTo(0.8, 2);
  });
  it('can be cleared, and the ideal run is found over the curve', () => {
    const proof = proveCourse(prims, 'x');
    expect(proof.cleared).toBe(true);
    expect(searchIdealRun(proof.course).cleared).toBe(true);
  });
});
