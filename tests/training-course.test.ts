import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { inputFor } from '../src/sim/ideal';
import { newWorld, stepWorld } from '../src/sim/world';
import { logTick, newLog } from '../src/ui/run-report';

// The Training course (CC-97) shows every move in one chain, and the efficient line is not the obvious one.
const c = JSON.parse(readFileSync('public/assets/demo/training.course.json', 'utf8')) as CourseData;
function play() {
  let w = newWorld(c); const log = newLog();
  const st = { next: 0, caught: null, bedAt: null, hangAt: null, hangs: 0, vnext: 0, cnext: 0, inClimb: false, fnext: 0, airSince: null } as unknown as Parameters<typeof inputFor>[2];
  for (let i = 0; i < 120 * 90 && w.outcome === 'running'; i++) { w = stepWorld(w, inputFor(c.plan!, w, st, c), c); logTick(log, w); }
  return { w, log };
}
describe('the Training course', () => {
  const { w, log } = play();
  it('clears with its stored plan, on the ground, after the last obstacle', () => {
    expect(w.outcome).toBe('cleared');
    expect(w.runner.grounded).toBe(true);
    expect(w.runner.x).toBeGreaterThanOrEqual(c.finishX);
  });
  it('uses every move: jump, vault, bar grab, climb, trampoline bounce and a roll', () => {
    const kinds = new Set(log.moves.map((m) => m.kind));
    for (const k of ['jump', 'vault', 'grab', 'climb', 'bounce', 'roll']) expect(kinds.has(k as never), k).toBe(true);
  });
  it('has one zone per beat, in the order they come', () => {
    expect(c.zones!.map((z) => z.id)).toEqual(['gap', 'vault', 'lache', 'rope', 'climb', 'trampoline', 'drop']);
    const xs = c.zones!.map((z) => z.x0); expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });
  it('the lache gap is wider than a jump, so the bars are needed', () => {
    const p = c.terrain.platforms, gaps = p.slice(1).map((q, i) => q.x0 - p[i].x1);
    expect(Math.max(...gaps.filter((g) => g > 9))).toBeGreaterThan(8.5);
  });
  it('the best line holds both lache bars (the far deck is out of reach of a skip), with no shortcut that skips one', () => {
    expect(c.routes?.find((r) => r.chosen)?.bars).toBe(2);
    expect(c.shortcuts ?? []).toEqual([]);
  });
  it('rolls after the second bar and at the end, and not after the rope', () => {
    const rolls = log.moves.filter((m) => m.kind === 'roll').map((m) => m.x);
    expect(rolls).toHaveLength(2);
    expect(rolls[0]).toBeGreaterThan(74); expect(rolls[0]).toBeLessThan(86);
    expect(rolls[1]).toBeGreaterThan(160);
  });
  it('the decks touch where a wall or a drop begins (no sliver to fall through)', () => {
    const p = c.terrain.platforms;
    for (let i = 1; i < p.length; i++) { const gap = p[i].x0 - p[i - 1].x1; if (gap > 0) expect(gap).toBeGreaterThan(0.5); }
  });
});
