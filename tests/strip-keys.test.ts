import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { drumsFor, type Drum } from '../src/sim/drums';
import { loadCourseFile } from './helpers/course';

// CC-182: the key strip (the drum lane) must list every key an obstacle needs, per docs/inputs.md:
// E for the warped wall, a climb, a lache bar and a rope; V for a vault; X for a roll after a big drop; Space for a jump and the trampoline press.
const NEEDS: Record<string, Drum['what'][]> = { wall: ['grab'], climb: ['grab'], lache: ['grab'], rope: ['grab'], vault: ['vault'] };
const STRICT: Record<string, Drum['what'][]> = { gap: ['jump'], trampoline: ['bounce'], drop: ['roll'] }; // on the Training course, where every zone is a real beat
const dir = 'public/assets/demo/';
const load = (n: string) => loadCourseFile(dir + n);
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

// CC-195: the toast for an obstacle starts before its drum key and before the obstacle's own window.
import { APPROACH_LEAD, approachToast, toastsFor } from '../src/ui/approach-toast';
describe('every key on the strip has its toast first', () => {
  for (const n of readdirSync(dir).filter((f) => f.endsWith('.course.json'))) {
    const c = load(n);
    if (!c.plan) continue;
    it(n, () => {
      const drums = drumsFor(c, c.plan!);
      for (const t of toastsFor(c, drums)) {
        const d = t.drum, k = t.kind, label = `${k} at ${d.x.toFixed(1)}`;
        expect(d.x - t.startX, label).toBeGreaterThanOrEqual(8); // at least about a second of reading at running speed
        expect(approachToast(c, drums, t.startX + 0.01), `${label} has a toast at its start`).not.toBeNull();
        const z = (c.zones ?? []).find((q) => (q.id === k || q.id.startsWith(k + '-')) && d.x >= q.x0 - 1 && d.x <= q.x1 + 1); // the zone of this very obstacle
        if (z) expect(t.startX, `${label} toast vs zone ${z.id}`).toBeLessThan(z.x0 + 0.5);
        if (k === 'roll') { const takeOff = drums.filter((q) => q.x < d.x - 0.5 && q.what !== 'roll').pop(); if (takeOff) expect(t.startX, `${label}: before the take-off`).toBeLessThan(takeOff.x); }
      }
    });
  }
  it('the lead is long enough to read', () => expect(APPROACH_LEAD).toBeGreaterThanOrEqual(10));
});

// CC-224: on a course with a fork, each way has its own keys: the high way swings (E, then release), the low way drops (X), jumps and climbs (E).
describe('the key strip lists the keys of each way through a fork', () => {
  const c = load('two-ways.course.json');
  const b = c.branches![0];
  const keysOf = (id: string) => drumsFor(c, b.routes.find((r) => r.id === id)!.plan!).filter((d) => d.x >= b.forkX - 2 && d.x <= b.joinX + 6).map((d) => d.what);
  it('high: grab and release', () => { const k = keysOf('high'); expect(k).toContain('grab'); expect(k).toContain('release'); });
  it('low: jump and climb (E)', () => { const k = keysOf('low'); expect(k).toContain('jump'); expect(k).toContain('grab'); expect(k).not.toContain('release'); });
});
