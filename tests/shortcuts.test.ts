import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import defaultCourse from '../src/course/default-course.json';
import type { CourseData } from '../src/course/course';
import { playPlan } from '../src/sim/ideal';
import { findShortcuts, shortcutLine, variantsOf } from '../src/sim/shortcuts';

const demo = (name: string) => JSON.parse(readFileSync(`public/assets/demo/${name}.course.json`, 'utf8')) as CourseData;

// The lache demo with its far deck brought within reach of the first bar: a full pump on bar 1 flies over bar 2 and lands on it.
function skipCourse(): CourseData {
  const c = demo('lache');
  delete c.plan; delete c.shortcuts;
  c.terrain.platforms[3] = { ...c.terrain.platforms[3], x0: 45.5 };
  return c;
}

describe('shortcut search', () => {
  it('lists the ways to take a move away: each bar, each neighbouring pair, the wall, the rope', () => {
    const ids = variantsOf(demo('lache')).map((v) => v.id);
    expect(ids).toEqual(['skip-bar-1', 'skip-bar-2', 'skip-bars-1-2']);
    const d = variantsOf(defaultCourse as unknown as CourseData).map((v) => v.id);
    expect(d).toContain('skip-wall');
    expect(d).toContain('skip-rope');
  });

  it('finds the skip over bar 2 when the far deck is within reach of bar 1, and the saving is right', () => {
    const c = skipCourse();
    const r = findShortcuts(c, { onlyIds: ['skip-bar-2'], moveChoices: false });
    const s = r.shortcuts.find((x) => x.id === 'skip-bar-2');
    expect(s, 'a skip over bar 2').toBeTruthy();
    expect(s!.skipped).toEqual(['Bar 2']);
    // the saving is the difference of the two whole-run times, each played on the real course with both bars in place
    const played = playPlan(c, s!.plan);
    expect(played.world.outcome).toBe('cleared');
    expect(played.events.filter((e) => e.type === 'hang-catch').length).toBe(1); // one bar held, the other flown past
    expect(s!.seconds).toBeCloseTo(played.world.runner.tick / 120, 1);
    expect(r.intendedSeconds! - s!.seconds).toBeCloseTo(s!.secondsSaved, 1);
    expect(s!.secondsSaved).toBeGreaterThan(0.3);
    expect(shortcutLine(s!)).toMatch(/^Shortcut: .* saves \d+\.\d s/);
  }, 600_000);

  it('reports no shortcut on a course where nothing can be skipped (the default course: wall, rope, trampoline)', () => {
    const r = findShortcuts(defaultCourse as unknown as CourseData, { moveChoices: false });
    expect(r.shortcuts).toEqual([]);
    expect(r.intendedSeconds).not.toBeNull();
  }, 600_000);

  it('stays within a search budget and says when it stopped early', () => {
    const r = findShortcuts(skipCourse(), { maxSearches: 2, moveChoices: false });
    expect(r.searches).toBeLessThanOrEqual(3); // the ideal run plus at most the budgeted variants
    expect(r.complete).toBe(false);
  }, 600_000);

  it('every stored shortcut still clears its course in the time it says', () => {
    for (const f of readdirSync('public/assets/demo').filter((n) => n.endsWith('.course.json'))) {
      const c = JSON.parse(readFileSync(`public/assets/demo/${f}`, 'utf8')) as CourseData;
      for (const s of c.shortcuts ?? []) {
        const r = playPlan(c, s.plan);
        expect(r.world.outcome, `${f} ${s.id}`).toBe('cleared');
        expect(r.world.runner.tick / 120, `${f} ${s.id} seconds`).toBeCloseTo(s.seconds, 1);
      }
    }
  });
});
