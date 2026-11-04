// CC-133: every obstacle a shipped course uses has a way to teach it: a toast before it, or a hint while the runner is in it.
// The bulb lane of the fork (a standing pole, then bars) once had neither: no key on the drum lane and no words.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TOASTS } from '../src/course/obstacles';
import { drumsForPaths } from '../src/sim/drums';
import { toastsFor, approachToast } from '../src/ui/approach-toast';
import type { CourseData } from '../src/course/course';

const hintSrc = readFileSync('src/modes/course/hint.ts', 'utf8');
const find = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? find(p) : p.endsWith('.course.json') ? [p] : []; });
const files = find('public');
const load = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as CourseData;

// course field -> where the player is taught it: a toast kind (words before the obstacle), and/or a needle in the in-mode hints (src/modes/course/hint.ts)
const TAUGHT: Record<string, { toast?: keyof typeof TOASTS; hint?: string }> = {
  holds: { toast: 'lache', hint: 'Hold E to grab the bar' },
  rope: { toast: 'rope' },
  wall: { toast: 'wall' },
  climbPoles: { toast: 'pole', hint: "w.mode === 'polec'" },
  bars: { hint: 'course.bars' },
  pole: { hint: 'course.pole' },
  planks: { hint: 'course.planks' },
  band: { hint: "w.mode === 'band'" },
  drone: { hint: 'course.drone' },
  recoil: { hint: 'course.recoil' },
  trebuchet: { hint: "w.mode === 'launch'" },
  track: { hint: "w.mode === 'cart'" },
};
const NEEDS_NOTHING = new Set(['shots']); // timed balls: the Course shows the ball itself, there is nothing to press

describe('every obstacle in a shipped course is taught', () => {
  it('finds the shipped courses', () => expect(files.length).toBeGreaterThan(40));
  it('names a toast or a hint for each obstacle field a shipped course uses', () => {
    const gaps: string[] = [];
    for (const f of files) {
      const c = load(f);
      for (const k of Object.keys(TAUGHT)) {
        const v = (c as unknown as Record<string, unknown>)[k];
        if (v === undefined || (Array.isArray(v) && !v.length)) continue;
        const t = TAUGHT[k];
        if (t.toast && !TOASTS[t.toast]) gaps.push(`${f}: ${k} has no toast row`);
        if (t.hint && !hintSrc.includes(t.hint) && !t.toast) gaps.push(`${f}: ${k} has no hint line`);
      }
    }
    expect(gaps).toEqual([]);
  });
  it('lists every field of the course type that is an obstacle, so a new one cannot slip past', () => {
    const all = readFileSync('src/course/course.ts', 'utf8'), src = all.slice(all.indexOf('export interface CourseData'));
    const fields = [...src.matchAll(/^\s{2}(\w+)\?:/gm)].map((m) => m[1]);
    const plain = new Set(['plan', 'zones', 'windows', 'checkpoints', 'hazard', 'jumpKeep', 'grabReach', 'scene', 'uMap', 'routes', 'shortcuts', 'off', 'designedShortcuts', 'source', 'keepDecks', 'branches', 'wall', 'rope']);
    const unknown = fields.filter((k) => !(k in TAUGHT) && !plain.has(k) && !NEEDS_NOTHING.has(k));
    expect(unknown).toEqual([]);
  });
});

describe('the fork course: both ways are taught', () => {
  const c = load('public/assets/demo/fork-bench-bulb.course.json');
  const drums = drumsForPaths(c)!;
  it('has a grab key for the pole on the bulb way, before the bars', () => {
    const pole = c.climbPoles![0];
    const g = drums.find((d) => d.what === 'grab' && d.route === 'bulb');
    expect(g).toBeTruthy();
    expect(Math.abs(g!.x - pole.x)).toBeLessThan(1.5);
  });
  it('shows the pole toast on the run-up, with room to read it', () => {
    const t = toastsFor(c, drums).find((q) => q.kind === 'pole')!;
    expect(t).toBeTruthy();
    expect(t.text).toMatch(/hold E/);
    const x = c.climbPoles![0].x - 4; // four metres before the pole, the bench way's gap toast is also close
    expect(approachToast(c, drums, x)?.kind).toBe('pole');
    expect(approachToast(c, drums, c.startX + 3)?.kind).toBe('pole');
  });
  it('does not turn a bench-way jump into a bar toast because a bulb-way bar is near', () => {
    const toasts = toastsFor(c, drums);
    expect(toasts.filter((q) => q.kind === 'lache')).toEqual([]);
  });
});
