import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { sliceCardOn, DEMOS, DEMO_GROUPS, LEAVE_MESSAGE, WORD_VALUES, currentWorld, hasThumb, mayLeaveCourse, thumbSlug, thumbUrl, worldHref } from '../src/ui/world-picker';

describe('the world picker list (CC-89)', () => {
  it('the slicer card is on the list without ?labs=1 and ?slice2=old hides it again (CC-201)', () => {
    expect(DEMOS.some(([v, t]) => v === 'map' && t === 'World Slicer')).toBe(true);
    expect(DEMOS.some(([v, t]) => v === 'editor' && t === 'World Editor')).toBe(true);
    expect(sliceCardOn(new URLSearchParams(''))).toBe(true);
    expect(sliceCardOn(new URLSearchParams('slice2=old'))).toBe(false);
  });
  it('every course in the list is a file on disk', () => {
    for (const [value] of DEMOS) {
      if (WORD_VALUES.includes(value) || value === '') continue;
      expect(value, value).toMatch(/^\/assets\/[\w./-]+\.course\.json$/);
      expect(existsSync(`public${value}`), value).toBe(true);
    }
  });
  it('every course has a picture in public/assets/thumbs', () => {
    const files = new Set(existsSync('public/assets/thumbs') ? readdirSync('public/assets/thumbs') : []);
    for (const [value, label] of DEMOS) if (hasThumb(value)) expect(files.has(`${thumbSlug(value)}.webp`), `${label}: run npm run thumbs`).toBe(true);
  });
  it('the pictures are small', () => {
    for (const [value, label] of DEMOS) {
      if (!hasThumb(value) || !existsSync(`public${thumbUrl(value)}`)) continue;
      expect(readFileSync(`public${thumbUrl(value)}`).length, label).toBeLessThan(80 * 1024);
    }
  });
  it('the set of pictures is in ASSETS.md', () => {
    expect(readFileSync('docs/ASSETS.md', 'utf8')).toContain('public/assets/thumbs/');
  });
  it('titles are unique and every entry has a line about it', () => {
    const titles = DEMOS.map(([, t]) => t);
    expect(new Set(titles).size).toBe(titles.length);
    for (const [, ds] of DEMO_GROUPS) for (const [v, t, about] of ds) expect(about.length, `${v} ${t}`).toBeGreaterThan(10);
  });
  it('every choice leads somewhere', () => {
    expect(worldHref('editor')).toBe('?mode=editor&welcome=0');
    expect(worldHref('coaster-builder')).toBe('?mode=coaster&welcome=0');
    expect(worldHref('map')).toBe('?mode=map&welcome=0');
    expect(worldHref('generate', { pathname: '/', search: '' }, 7)).toBe('?generate=7&welcome=0');
    expect(worldHref('generate-same', { pathname: '/', search: '?generate=7' })).toBe('/?generate=7&welcome=0');
    expect(worldHref('/assets/demo/lache.course.json')).toBe('?course=/assets/demo/lache.course.json&welcome=0');
    expect(worldHref('')).toBe('?welcome=0');
  });
  it('the current world is found in every mode', () => {
    const at = (q: string, name?: string) => currentWorld(new URLSearchParams(q), name);
    expect(at('?course=/assets/demo/training.course.json').value).toBe('/assets/demo/training.course.json');
    expect(at('?course=/assets/demo/lache.course.json').value).toBe('stay'); // out of the menu, still playable: it gets a This course card
    expect(at('').value).toBe('stay'); // the stock course is no longer a card: it opens as This course
    expect(at('?generate=5').value).toBe('generate-same');
    expect(at('?course=/assets/demo/lane-1.course.json', 'Lane').value).toBe('stay');
    expect(at('?mode=editor').value).toBe('editor');
    expect(at('?mode=coaster').value).toBe('coaster-builder');
    expect(at('?mode=map').value).toBe('map');
    expect(at('?mode=dojo').value).toBeNull();
  });
  it('is mounted by every mode: main.ts for the others, the Course for itself', () => {
    expect(readFileSync('src/main.ts', 'utf8')).toMatch(/mountWorldGallery/);
    expect(readFileSync('src/main.ts', 'utf8')).toMatch(/installGalleryKeyGuard\(\)/);
    expect(readFileSync('src/modes/course.ts', 'utf8')).toMatch(/mountWorldGallery\(document\.body/);
  });
});

describe('leaving with unsaved editor work', () => {
  const g = globalThis as unknown as Record<string, unknown>;
  const realWindow = g.window;
  afterEach(() => { g.window = realWindow; });
  const stubWindow = (unsaved: (() => boolean) | undefined, answer: boolean): string[] => {
    const asked: string[] = [];
    g.window = { ccHasUnsavedChanges: unsaved, confirm: (msg: string) => { asked.push(msg); return answer; } };
    return asked;
  };
  it('other modes never ask: no hook, no question, just go', () => {
    const asked = stubWindow(undefined, true);
    expect(mayLeaveCourse()).toBe(true);
    expect(asked).toEqual([]);
  });
  it('a saved editor never asks', () => {
    const asked = stubWindow(() => false, true);
    expect(mayLeaveCourse()).toBe(true);
    expect(asked).toEqual([]);
  });
  it('an unsaved editor asks in plain words, and Cancel stays', () => {
    const asked = stubWindow(() => true, false);
    expect(mayLeaveCourse()).toBe(false);
    expect(asked).toEqual([LEAVE_MESSAGE]);
    expect(LEAVE_MESSAGE).toBe('You have changes you have not saved. Leave and lose them?');
  });
  it('an unsaved editor leaves when the player agrees', () => {
    const asked = stubWindow(() => true, true);
    expect(mayLeaveCourse()).toBe(true);
    expect(asked).toEqual([LEAVE_MESSAGE]);
  });
});

describe('the menu stays small (CC-97)', () => {
  const courses = DEMOS.filter(([v]) => !WORD_VALUES.includes(v) && v !== '');
  it('lists about fourteen courses, the Training course first', () => {
    expect(courses.length).toBeLessThanOrEqual(15);
    expect(courses[0][0]).toBe('/assets/demo/training.course.json');
  });
  it('every listed course has a stored plan or is a coaster, so it can be cleared and compared', () => {
    for (const [v, label] of courses) {
      const c = JSON.parse(readFileSync(`public${v}`, 'utf8')) as { plan?: unknown; track?: unknown };
      expect(Boolean(c.plan || c.track), label).toBe(true);
    }
  });
  it('every picture belongs to a listed course (no orphan pictures)', () => {
    const slugs = new Set(DEMOS.filter(([v]) => hasThumb(v)).map(([v]) => `${thumbSlug(v)}.webp`));
    for (const f of readdirSync('public/assets/thumbs')) expect(slugs.has(f), `${f}: delete it or list its course`).toBe(true);
  });
  it('courses taken out of the menu still open by their old links', () => {
    for (const f of ['lache', 'lache-wide', 'climb', 'drop', 'bench-and-stairs', 'skate-box-and-rail', 'coaster-low', 'launch', 'launch-bar-hard', 'recoil', 'plank-thin', 'plank', 'coaster', 'coaster-sharp', 'park-rail-run']) {
      expect(existsSync(`public/assets/demo/${f}.course.json`), f).toBe(true);
      expect(DEMOS.some(([v]) => v.endsWith(`/${f}.course.json`)), `${f} should be out of the menu`).toBe(false);
    }
  });
});
