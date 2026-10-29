import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { drumsFor, type Drum } from '../src/sim/drums';

// CC-182: the key strip (the drum lane) must list every key an obstacle needs, per docs/inputs.md:
// E for the warped wall, a climb, a lache bar and a rope; V for a vault; X for a roll after a big drop; Space for a jump and the trampoline press.
const NEEDS: Record<string, Drum['what'][]> = { wall: ['grab'], climb: ['grab'], lache: ['grab'], rope: ['grab'], vault: ['vault'] };
const STRICT: Record<string, Drum['what'][]> = { step: ['vault'], gap: ['jump'], trampoline: ['bounce'], drop: ['roll'] }; // on the Training course, where every zone is a real beat
const dir = 'public/assets/demo/';
const load = (n: string) => JSON.parse(readFileSync(dir + n, 'utf8')) as CourseData;
const missing = (c: CourseData, need: Record<string, Drum['what'][]>) => {
  const drums = drumsFor(c, c.plan!);
  const out: string[] = [];
  for (const z of c.zones ?? []) {
    const key = Object.keys(need).find((k) => z.id === k || z.id.startsWith(k + '-'));
    if (!key) continue;
    const inside = drums.filter((d) => d.x >= z.x0 - 6 && d.x <= z.x1 + 2).map((d) => d.what);
    for (const w of need[key]) if (!inside.includes(w)) out.push(`${z.id} needs ${w}`);
  }
  return out;
};
describe('the key strip lists every key an obstacle needs', () => {
  for (const n of readdirSync(dir).filter((f) => f.endsWith('.course.json'))) {
    const c = load(n);
    if (!c.plan || n === 'training.course.json' || !c.zones?.some((z) => Object.keys(NEEDS).some((k) => z.id === k || z.id.startsWith(k + '-')))) continue;
    it(n, () => expect(missing(c, NEEDS)).toEqual([]));
  }
  it('the Training course: wall, climb, lache, rope (E), vaults and step (V), gap and trampoline, and the rolls (X)', () => {
    const c = load('training.course.json');
    expect(missing(c, { ...NEEDS, ...STRICT })).toEqual([]);
    const drums = drumsFor(c, c.plan!);
    const wall = c.zones!.find((z) => z.id === 'wall')!;
    expect(drums.filter((d) => d.what === 'grab' && d.x >= wall.x0 && d.x <= wall.x1 + 2)).toHaveLength(1); // the warped wall is on the strip, near its top
  });
});
