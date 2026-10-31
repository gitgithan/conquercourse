import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OBSTACLES, type ObstacleId } from '../src/course/obstacles';
import { COURSE_FIELDS } from '../src/course/schema';
import { DEMO_COURSE_FILES } from '../src/course/demo-list';
import type { CourseData } from '../src/course/course';
import { playPlan } from '../src/sim/ideal';
import { BITS } from '../src/sim/replay';
import { COVERED_BY_VIEW, GROUP_TITLES, PARTS, PLAIN_FIELDS, partById, partsOfCourse } from '../src/ui/parts-data';
import { frameSrc } from '../src/modes/parts';
import { DEMOS, currentWorld, partsCardOn, worldHref } from '../src/ui/world-picker';

const cov = <K extends 'bits' | 'modes' | 'obstacles' | 'fields'>(k: K): Set<string> => new Set(PARTS.flatMap((p) => (p.covers[k] ?? []) as string[]));
const modes = (): string[] => {
  const m = /export type Mode = ([^;]+);/.exec(readFileSync('src/sim/world.ts', 'utf8'));
  return [...m![1].matchAll(/'(\w+)'/g)].map((x) => x[1]);
};
const read = (f: string) => JSON.parse(readFileSync(f, 'utf8')) as CourseData;

describe('the Parts gallery covers every part the game has', () => {
  it('has a card for every obstacle kind (a new kind without a card fails here)', () => {
    const have = cov('obstacles');
    for (const id of Object.keys(OBSTACLES) as ObstacleId[]) expect(have.has(id) || COVERED_BY_VIEW.includes(id), `obstacle kind "${id}" has no card in src/ui/parts-data.ts`).toBe(true);
  });
  it('has a card for every course field that places something', () => {
    const have = cov('fields');
    for (const k of Object.keys(COURSE_FIELDS)) {
      const looks = COURSE_FIELDS[k as keyof typeof COURSE_FIELDS].looks;
      if (PLAIN_FIELDS.includes(k) || (looks && k !== 'scene')) continue;
      expect(have.has(k), `course field "${k}" has no card (or add it to PLAIN_FIELDS if it places nothing)`).toBe(true);
    }
  });
  it('has a card for every input bit of a recorded run', () => {
    const have = cov('bits');
    for (const b of BITS) expect(have.has(b), `input "${b}" has no card`).toBe(true);
  });
  it('has a card for every world mode', () => {
    const have = cov('modes');
    const all = modes();
    expect(all.length).toBeGreaterThan(10);
    for (const m of all) expect(have.has(m), `world mode "${m}" has no card`).toBe(true);
  });
  it('lists nothing that does not exist', () => {
    const real = new Set<string>([...Object.keys(OBSTACLES), ...Object.keys(COURSE_FIELDS), ...BITS, ...modes()]);
    for (const p of PARTS) for (const list of Object.values(p.covers)) for (const x of list) expect(real.has(x), `${p.id} covers "${x}"`).toBe(true);
  });
});

describe('the cards', () => {
  it('have unique ids, plain words and a group', () => {
    expect(new Set(PARTS.map((p) => p.id)).size).toBe(PARTS.length);
    for (const p of PARTS) {
      expect(GROUP_TITLES[p.group], p.id).toBeTruthy();
      expect(p.line.length, p.id).toBeGreaterThan(15);
      expect(p.keys.length, p.id).toBeGreaterThan(2);
      expect(`${p.name} ${p.line} ${p.keys}`, p.id).not.toMatch(/[=∑√∫]|\bF\s*=|\bm\/s²/); // no formulas
    }
  });
  it('give every special obstacle a made-of line and, when it has one, a saying that is in docs/sayings.md', () => {
    const sayings = readFileSync('docs/sayings.md', 'utf8');
    const specials = PARTS.filter((p) => p.group === 'special');
    expect(specials.length).toBeGreaterThanOrEqual(10);
    for (const p of specials) {
      expect(p.made, p.id).toBeTruthy();
      if (p.saying) expect(sayings, p.id).toContain(p.saying);
    }
    expect(specials.filter((p) => !p.saying).map((p) => p.id)).toEqual(['forks']); // the one special part with no saying yet (docs/parts-gallery.md flags it)
  });
  it('point live scenes at real course files, and a bot scene at a course with a stored plan', () => {
    for (const p of PARTS) {
      if (p.live.how === 'none') continue;
      const file = `public${p.live.course}`;
      expect(existsSync(file), `${p.id}: ${file}`).toBe(true);
      if (p.live.how === 'bot') expect(read(file).plan, `${p.id}: ${file} has no stored ideal run`).toBeTruthy();
      expect(frameSrc(p)).toContain(`course=${p.live.course}`);
    }
    expect(frameSrc(partById('gap')!)).toContain('bot=ideal');
    expect(frameSrc(partById('slide')!)).not.toContain('bot=ideal');
  });
  it('use recorded motion files that exist', () => {
    for (const p of PARTS) if (p.clip) expect(existsSync(`public/assets/motion/${p.clip}`), p.clip).toBe(true);
  });
  it('are all named in docs/parts-gallery.md', () => {
    const doc = readFileSync('docs/parts-gallery.md', 'utf8');
    for (const p of PARTS) expect(doc, p.id).toContain(`\`${p.id}\``);
  });
});

describe('the little courses made for the gallery', () => {
  const dir = 'public/assets/parts';
  it('each clears with its stored ideal run (npx tsx scripts/make-parts-courses.ts rewrites them)', () => {
    const files = readdirSync(dir).filter((f) => f.endsWith('.course.json'));
    expect(files.length).toBeGreaterThanOrEqual(9);
    for (const f of files) {
      const c = read(`${dir}/${f}`);
      expect(c.plan, f).toBeTruthy();
      expect(playPlan(c, c.plan!, 120 * 90).world.outcome, f).toBe('cleared');
    }
  });
});

describe('How a course is made', () => {
  it('cuts the Training course into its parts in order', () => {
    expect(partsOfCourse(read('public/assets/demo/training.course.json'))).toEqual(['gap', 'vaultbox', 'warped', 'tallwall', 'plank', 'lache', 'ropeswing', 'trampoline', 'drop']);
  });
  it('names only real cards for every shipped course, and finds a part in each machine course', () => {
    for (const f of DEMO_COURSE_FILES) for (const id of partsOfCourse(read(f))) expect(partById(id), `${f}: ${id}`).toBeTruthy();
    expect(partsOfCourse(read('public/assets/demo/cannon.course.json'))).toEqual(['cannon']);
    expect(partsOfCourse(read('public/assets/demo/recoil.course.json'))).toEqual(['recoil']);
    expect(partsOfCourse(read('public/assets/demo/band.course.json'))).toEqual(['band']);
    expect(partsOfCourse(read('public/assets/demo/launch-bar.course.json'))).toContain('trebuchet');
  });
});

describe('the Parts card in the World picker', () => {
  it('is on the list, opens ?mode=parts, and ?parts=0 hides it', () => {
    expect(DEMOS.some(([v, t]) => v === 'parts' && t === 'Parts: moves and obstacles')).toBe(true);
    expect(worldHref('parts')).toBe('?mode=parts&welcome=0');
    expect(currentWorld(new URLSearchParams('mode=parts')).value).toBe('parts');
    expect(partsCardOn(new URLSearchParams(''))).toBe(true);
    expect(partsCardOn(new URLSearchParams('parts=0'))).toBe(false);
  });
});
