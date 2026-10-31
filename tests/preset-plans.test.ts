import { describe, expect, it } from 'vitest';
import STORED from '../src/slice/preset-plans.json';
import { presetKey, storedPlanFor, withStoredPlan, type PresetPlan } from '../src/slice/preset-plans';
import { playPlan } from '../src/sim/ideal';
import { PRESETS } from '../src/slice/presets';
import { presetCourse } from '../scripts/preset-courses';

// CC-243: every ready-made editor course carries its proof from `npm run plans:presets`. A stale entry (the preset, an object or the physics changed) fails here.
const table = STORED as unknown as Record<string, PresetPlan>;

describe.each(PRESETS.map((p) => [p.id, p] as const))('ready-made course %s', (id, pre) => {
  const course = presetCourse(pre);
  it('has a stored proof made for exactly this course (run npm run plans:presets when this fails)', () => {
    expect(table[id], 'no stored proof').toBeTruthy();
    expect(table[id].key).toBe(presetKey(course));
  });
  it('is found by the editor from the course alone, and where it was cut from does not matter', () => {
    expect(storedPlanFor(course, table)?.key).toBe(table[id].key);
    expect(storedPlanFor({ ...course, source: { kind: 'editor', pieces: [] }, hazard: 'lava', designedShortcuts: [] } as never, table)?.key).toBe(table[id].key);
  });
  it('keeps a plan that clears the course (a stored verdict of "no" needs no plan)', () => {
    const r = table[id];
    if (!r.cleared) { expect(r.plan).toBeUndefined(); return; }
    expect(playPlan(course, r.plan!).world.outcome).toBe('cleared');
    expect(withStoredPlan(course, r).plan).toBe(r.plan);
  });
});

describe('a course the player edited', () => {
  it('has no stored proof, so the lane check searches it live', () => {
    const c = presetCourse(PRESETS[0]);
    expect(storedPlanFor({ ...c, startX: c.startX + 1 }, table)).toBeNull();
  });
  it('is given no plan when the check did not clear it', () => {
    const c = presetCourse(PRESETS[0]);
    expect(withStoredPlan(c, { cleared: false }).plan).toBeUndefined();
  });
});
