import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { drumsFor } from '../src/sim/drums';
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
});
