import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { courseHash } from '../src/sim/replay';
import { madeCourse } from '../src/share/made-course';
import type { CourseData } from '../src/course/course';

// The hash of every shipped course, and of the same course after it went through a link (shareable + cleanCourse), is frozen.
// Moving the checks around must not change one character: a changed hash makes every old run and shared link refuse to open.
const DIR = 'public/assets/demo/';
const GOLDEN = 'tests/golden/course-hashes.json';
const files = [...readdirSync(DIR).filter((f) => f.endsWith('.course.json')).map((f) => DIR + f), 'src/course/default-course.json', 'src/course/default-course.ideal.json'].sort();

const now = (): Record<string, { hash: string; link: string | null }> => {
  const out: Record<string, { hash: string; link: string | null }> = {};
  for (const f of files) {
    const c = JSON.parse(readFileSync(f, 'utf8')) as CourseData;
    const m = madeCourse(c);
    out[f] = { hash: courseHash(c), link: m ? courseHash(m) : null };
  }
  return out;
};

describe('course hashes are frozen', () => {
  it('matches the stored hashes', () => {
    if (!existsSync(GOLDEN) && process.env.UPDATE_GOLDEN) writeFileSync(GOLDEN, JSON.stringify(now(), null, 2) + '\n');
    expect(now()).toEqual(JSON.parse(readFileSync(GOLDEN, 'utf8')));
  });
});

import { COURSE_FIELDS, LOOKS_ONLY } from '../src/course/schema';
import { cleanCourse, shareable } from '../src/share/made-course';

describe('course fields have one table', () => {
  const base = (): Record<string, unknown> => JSON.parse(readFileSync(DIR + 'training.course.json', 'utf8'));
  it('every top-level key of every shipped course has a row', () => {
    const unknown = new Set<string>();
    for (const f of files.filter((x) => !x.endsWith('.ideal.json'))) for (const k of Object.keys(JSON.parse(readFileSync(f, 'utf8')))) if (!(k in COURSE_FIELDS)) unknown.add(k);
    expect([...unknown]).toEqual([]);
  });
  it('the looks-only list is the one the link strips', () => {
    expect(LOOKS_ONLY.slice().sort()).toEqual(['designedShortcuts', 'off', 'plan', 'routes', 'scene', 'shortcuts', 'source', 'uMap', 'windows']);
    const out = shareable({ ...base(), plan: {}, scene: [] } as unknown as CourseData);
    expect('plan' in out || 'scene' in out).toBe(false);
  });
  it('a wrong machine, wall or list is refused, a right one passes', () => {
    const with_ = (k: string, v: unknown) => cleanCourse({ ...shareable(base() as unknown as CourseData), [k]: v });
    expect(with_('drone', { x0: 1, x1: 9 })).not.toBeNull();
    expect(with_('drone', { x0: 1 })).toBeNull();
    expect(with_('drone', 'big')).toBeNull();
    expect(with_('band', { x: 'far' })).toBeNull();
    expect(with_('band', { x: 4, rest: 1 })).not.toBeNull();
    expect(with_('wall', { height: 3 })).toBeNull();
    expect(with_('holds', [{ x: 1 }])).toBeNull();
    expect(with_('holds', [{ x: 1, y: 2 }])).not.toBeNull();
    expect(with_('hazard', 'jam')).toBeNull();
    expect(with_('hazard', 'lava')).not.toBeNull();
    expect(with_('jumpKeep', 4)).toBeNull();
    expect(with_('branches', [{ id: 'a' }])).toBeNull();
    expect(with_('futureField', { anything: 1 })).not.toBeNull(); // an unknown field is left alone
  });
});
