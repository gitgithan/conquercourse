import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { newWorld, stepWorld, type WorldState } from '../src/sim/world';
import type { CourseData } from '../src/course/course';
import type { RunnerInput } from '../src/sim/runner';

// CC-239: the pole vault as a world mode. E picks the pole up; carrying it, E held in the plant box jams it; letting go of E at the top sends the runner over.
const course = JSON.parse(readFileSync('public/assets/experiments/pole/pole.course.json', 'utf8')) as CourseData;
const key = (o: Partial<RunnerInput> = {}): RunnerInput => ({ run: true, jump: false, jumpSpeed: 4.5, squat: false, ...o });

/** Run right with E held from the pole to the box (E held the whole way: pick up, then plant), let go after `hold` ticks of the ride (null: never). */
function vaultRun(hold: number | null, grabPole = true, maxTicks = 120 * 40): { w: WorldState; types: string[] } {
  let w = newWorld(course);
  const types: string[] = [];
  let planted = -1;
  for (let i = 0; i < maxTicks && w.outcome === 'running'; i++) {
    if (w.mode === 'pole' && planted < 0) planted = i;
    const e = grabPole && (w.mode === 'pole' ? hold === null || i - planted < hold : w.runner.x >= course.pole!.pickX - 1 || w.pole?.carrying);
    w = stepWorld(w, key(e ? { handL: true, handR: true } : {}), course);
    for (const ev of w.events) types.push(ev.type);
    if (w.runner.x > 60) break;
  }
  return { w, types };
}

describe('pole vault in the world', () => {
  it('E near the pole picks it up; far from it does nothing', () => {
    const near = vaultRun(null);
    expect(near.types).toContain('pole-pickup');
    const far = vaultRun(null, false);
    expect(far.types).not.toContain('pole-pickup');
    expect(far.types).not.toContain('pole-plant');
  });
  it('holding E in the box with the pole plants it, without the pole nothing happens', () => {
    expect(vaultRun(30).types).toContain('pole-plant');
    expect(vaultRun(30, false).types).not.toContain('pole-plant');
  });
  it('some release clears the bar and lands on the cushion, and runs on', () => {
    const clears = [];
    for (let hold = 20; hold <= 260; hold += 4) { const r = vaultRun(hold); if (r.types.includes('pole-land') && !r.types.includes('bar-down')) clears.push(hold); }
    expect(clears.length).toBeGreaterThan(3);
  });
  it('letting go too early falls short and too late knocks the bar', () => {
    expect(vaultRun(3).types).not.toContain('pole-land');
    expect(vaultRun(null).types.some((t) => t === 'bar-down' || t === 'pole-fell-back')).toBe(true);
  });
  it('the same keys give the same end, every time', () => {
    const a = vaultRun(100), b = vaultRun(100);
    expect(a.w.runner.x).toBe(b.w.runner.x);
    expect(a.types).toEqual(b.types);
  });
});
