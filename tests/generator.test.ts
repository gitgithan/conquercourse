import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { searchIdealRun } from '../src/sim/ideal';
import { generateCourse, generateDetailed, type Generated } from '../src/slice/generator';

// The course generator: a seed becomes a course of proved moves, easy first, growing.
const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const runs: Generated[] = seeds.map((s) => generateDetailed(s));

describe('the course generator', () => {
  it('every seed gives a course the simulator clears, with several moves', () => {
    for (const g of runs) {
      expect(g.cleared).toBe(true);
      expect(g.moves.length).toBeGreaterThanOrEqual(3);
    }
  });
  it('the ideal-run search clears whole generated courses too (spot check on cheap ones)', () => {
    const cheap = runs.filter((g) => !g.moves.some((m) => m.kind === 'lache')).slice(0, 2);
    expect(cheap.length).toBeGreaterThan(0);
    for (const g of cheap) expect(searchIdealRun(g.course).cleared).toBe(true);
  }, 60_000);
  it('different seeds give different move orders (at least 6 of 10)', () => {
    const seqs = new Set(runs.map((g) => g.moves.map((m) => m.kind).join('>')));
    expect(seqs.size).toBeGreaterThanOrEqual(6);
  });
  it('the ramp: the first move is easy and no later move is easier than the first; the last is harder', () => {
    for (const g of runs) {
      const lv = g.moves.map((m) => m.level);
      expect(lv[0]).toBeLessThanOrEqual(0.15);
      for (const l of lv) expect(l).toBeGreaterThanOrEqual(lv[0]);
      expect(lv[lv.length - 1]).toBeGreaterThan(lv[0] + 0.3);
    }
  });
  it('a seed is reproducible', () => {
    for (const s of [3, 7]) expect(JSON.stringify(generateCourse(s))).toBe(JSON.stringify(runs[s - 1].course));
  });
  it('each move has a zone and a checkpoint, and bars or steps switch jumpKeep on', () => {
    for (const g of runs) {
      expect(g.course.zones!.length).toBe(g.moves.length);
      expect(g.course.checkpoints!.map((c) => c.id)).toEqual(g.course.zones!.map((z) => z.id));
      const needsKeep = g.moves.some((m) => m.kind === 'lache' || m.kind === 'step');
      expect(g.course.jumpKeep).toBe(needsKeep ? 0.88 : undefined);
      expect(!!g.course.holds).toBe(g.moves.some((m) => m.kind === 'lache'));
    }
  });
  it('the options choose the moves and the length', () => {
    const g = generateDetailed(4, { moves: ['gap', 'step'], length: 5 });
    expect(g.moves.length).toBe(5);
    expect(g.moves.every((m) => m.kind === 'gap' || m.kind === 'step')).toBe(true);
    expect(g.cleared).toBe(true);
  });
  it('a gap that is too wide is not cleared (the proof is not a rubber stamp)', () => {
    const c = generateDetailed(4, { moves: ['gap'], length: 1 }).course;
    const wide: CourseData = { ...c, terrain: { ...c.terrain, platforms: c.terrain.platforms.map((p, i) => (i === 1 ? { ...p, x0: p.x0 + 9, x1: p.x1 + 9 } : p)) } };
    expect(searchIdealRun(wide).cleared).toBe(false);
  });
  it('the rope clears when asked for (slow proof, not in the default pool)', () => {
    const g = generateDetailed(1, { moves: ['gap', 'rope'], length: 2 });
    expect(g.cleared).toBe(true);
    expect(g.course.rope).toBeDefined();
  }, 60_000);
  it('the sample course in the demo folder is the generator\'s output for seed 2 and is cleared', () => {
    const file = JSON.parse(readFileSync('public/assets/demo/generated-1.course.json', 'utf8')) as CourseData;
    expect({ ...file, name: '' }).toEqual({ ...generateCourse(2), name: '' });
    expect(searchIdealRun(file).cleared).toBe(true);
  }, 120_000);
});
