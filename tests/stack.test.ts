import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { searchIdealRun } from '../src/sim/ideal';
import { NO_INPUT } from '../src/sim/runner';
import { DT } from '../src/sim/units';
import { newWorld, stepWorld } from '../src/sim/world';
import { CELL, sliceProfile } from '../src/slice/slice';
import { ACROSS, baseOf, CUP, FLOOR, PATTERNS, stackCollider, stackCups, stackHeight, stackHeightAt, stackPiece, stackSrc } from '../src/slice/stack';
import { worldSamples } from '../src/slice/world';

// Sport stacking: pyramids of cups (1, 3, 6, 10 cups have bases of 1, 2, 3, 4), mouth down, each row sitting a little higher.
describe('cup geometry', () => {
  it('a pyramid of 1, 3, 6 or 10 cups has a base of 1, 2, 3 or 4', () => {
    expect([1, 3, 6, 10].map(baseOf)).toEqual([1, 2, 3, 4]);
  });
  it('every pattern has the cups of its formations (times the cups across the lane)', () => {
    for (const p of PATTERNS) expect(stackCups(p).cups.length).toBe(p.formations.reduce((a, b) => a + b, 0) * ACROSS);
  });
  it('rows sit one rise higher and every row is half a cup in from the one below', () => {
    const p = PATTERNS.find((q) => q.id === '3-6-3')!;
    const mid = stackCups(p).cups.filter((c) => c.z === stackCups(p).cups[0].z && c.x > 0.3 && c.x < 0.6);
    const rows = [...new Set(mid.map((c) => c.row))].sort();
    expect(rows).toEqual([0, 1, 2]);
    for (const r of rows) expect(mid.find((c) => c.row === r)!.y).toBeCloseTo(r * CUP.rise, 9);
  });
  it('a default stack is between half a metre and 1.3 m tall for the runner', () => {
    for (const p of PATTERNS) {
      const h = stackHeight(p) * p.scale;
      expect(h, p.id).toBeGreaterThanOrEqual(0.5);
      expect(h, p.id).toBeLessThanOrEqual(1.3);
    }
  });
});

describe('the lane through a stack is its stepped outline', () => {
  for (const p of PATTERNS) {
    it(`${p.id}: every cell the outline does not change inside has the outline's height`, () => {
      const piece = stackPiece(stackSrc(p.id))!;
      const pr = sliceProfile(worldSamples([piece]), { x: 0, z: 0 }, { angle: 0, offset: 0, level: 0 });
      const { length } = stackCups(p), k = piece.scale;
      let checked = 0;
      pr.cells.forEach((cell, i) => {
        const x0 = ((pr.origin ?? 0) + i * CELL) / k + length / 2, x1 = x0 + CELL / k, margin = 0.011 / k;
        const probes = [x0 - margin, x0 + margin, (x0 + x1) / 2, x1 - margin, x1 + margin].map((x) => stackHeightAt(p, x)), mid = probes[2];
        if (probes.some((h) => h !== mid) || cell === null) return; // an edge falls in or right next to this cell (samples on a wall can land either side): skip it
        expect(cell, `cell ${i}`).toBeCloseTo(mid * k, 2);
        checked++;
      });
      expect(checked).toBeGreaterThanOrEqual(Math.max(4, Math.floor(pr.cells.length / 4))); // at small scales the steps are about as narrow as a 10 cm cell, so many cells hold an edge
    });
  }
  it('the floor between pyramids is thin ground, not a gap', () => {
    const p = PATTERNS[1], piece = stackPiece(stackSrc(p.id))!;
    const pr = sliceProfile(worldSamples([piece]), { x: 0, z: 0 }, { angle: 0, offset: 0, level: 0 });
    expect(pr.cells.every((c) => c !== null)).toBe(true);
    expect(Math.min(...(pr.cells as number[]))).toBeCloseTo(FLOOR * piece.scale, 2);
  });
  it('the collision mesh stands on y = 0', () => {
    const m = stackCollider(PATTERNS[0]), ys = (m.positions as number[]).filter((_, i) => i % 3 === 1);
    expect(Math.min(...ys)).toBe(0);
  });
});

describe('the stack demo course', () => {
  const course = JSON.parse(readFileSync('public/assets/demo/stack.course.json', 'utf8')) as CourseData;
  it('draws cups instead of blocks', () => {
    expect(course.scene?.[0]?.stack).toBe('3-6-3');
  });
  it('can be cleared by the ideal run', () => {
    expect(searchIdealRun(course).cleared).toBe(true);
  });
  it('the saying: at running speed the narrow top is crossed in a blink', () => {
    // standing on the first full-height top at 5 m/s, keep running: the flat top is one cup wide
    const topX = course.terrain.platforms[1].profile!.filter((q) => q[1] >= 1.04).map((q) => q[0]);
    let w = newWorld(course, topX[0] + 0.05);
    w = { ...w, runner: { ...w.runner, y: 1.05, vx: 5 } };
    const t0 = w.runner.tick;
    while (w.runner.x < topX[topX.length - 1] + 0.1 && w.runner.tick - t0 < 600) w = stepWorld(w, { ...NO_INPUT, run: true }, course);
    expect((w.runner.tick - t0) * DT).toBeLessThan(0.2);
  });
});
