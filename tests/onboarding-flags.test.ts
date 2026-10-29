import { describe, expect, it } from 'vitest';
import { FALL_SEEN, LAST_COURSE, NEXT_SEEN, TOUR_DONE, isReturning, rememberCourse, startRedirect, tourDecision, type Store } from '../src/ui/onboarding-flags';
import { movesFor } from '../src/ui/onboarding';
import { generateCourse } from '../src/slice/generator';
const defaultCourse = generateCourse(1);

const store = (init: Record<string, string> = {}): Store & { data: Record<string, string> } => { const data = { ...init }; return { data, get: (k) => data[k] ?? null, set: (k, v) => { data[k] = v; } }; };
const decide = (search: string, s = store(), o: { automated?: boolean; mode?: string | null; resume?: boolean; build?: boolean } = {}) => tourDecision({ params: new URLSearchParams(search), store: s, automated: !!o.automated, mode: o.mode ?? null, resume: o.resume, build: o.build });

describe('who gets the first-visit tour (CC-100)', () => {
  it('a first visit gets the tour', () => { expect(decide('')).toBe('tour'); });
  it('a returning player (tour done, or the old world chooser seen) does not', () => {
    expect(decide('', store({ [TOUR_DONE]: '1' }))).toBe('none');
    expect(decide('', store({ 'cc.worldWelcome.seen': '1' }))).toBe('none');
    expect(isReturning(store())).toBe(false);
  });
  it('?tour=1 forces it, even for a returning player and in automation', () => {
    expect(decide('?tour=1', store({ [TOUR_DONE]: '1' }))).toBe('tour');
    expect(decide('?tour=1', store(), { automated: true })).toBe('tour');
  });
  it('automation, films and explicit links keep today\'s behaviour', () => {
    expect(decide('', store(), { automated: true })).toBe('none');
    for (const q of ['?bot=ideal', '?welcome=0', '?course=/assets/demo/lache.course.json', '?generate=3', '?demo=rookie', '?startx=40', '?coaster=1,2']) expect(decide(q)).toBe('none');
    expect(decide('?bot=ideal&tour=1')).toBe('none');
  });
  it('other modes, a resumed run and the off switch never show it', () => {
    expect(decide('', store(), { mode: 'editor' })).toBe('none');
    expect(decide('', store(), { resume: true })).toBe('none');
    expect(decide('?onboarding=0')).toBe('none');
    expect(decide('', store(), { build: false })).toBe('none');
  });
  it('harmless words on the link (labs, cam, photos) do not stop the tour', () => { expect(decide('?labs=1&cam=first')).toBe('tour'); });
});

describe('where a bare visit goes', () => {
  it('a returning player goes to their last course, only if it is a safe course path', () => {
    const s = store({ [TOUR_DONE]: '1', [LAST_COURSE]: '/assets/demo/lache.course.json' });
    expect(startRedirect({ search: '', store: s, automated: false })).toBe('?course=/assets/demo/lache.course.json&welcome=0');
    s.data[LAST_COURSE] = 'https://evil.example/x.course.json';
    expect(startRedirect({ search: '', store: s, automated: false })).toBeNull();
  });
  it('explicit links, automation and the off switch are left alone', () => {
    const s = store({ [TOUR_DONE]: '1', [LAST_COURSE]: '/assets/demo/lache.course.json' });
    expect(startRedirect({ search: '?course=/assets/demo/drop.course.json', store: s, automated: false })).toBeNull();
    expect(startRedirect({ search: '', store: s, automated: true })).toBeNull();
    expect(startRedirect({ search: '?onboarding=0', store: s, automated: false })).toBeNull();
    expect(startRedirect({ search: '?mode=editor', store: s, automated: false })).toBeNull();
  });
  it('a first visit stays on the stock course while no first course is set', () => { expect(startRedirect({ search: '', store: store(), automated: false })).toBeNull(); });
  it('the last course is remembered only when it is a course file', () => {
    const s = store(); rememberCourse(s, new URLSearchParams('?course=/assets/demo/drop.course.json')); expect(s.data[LAST_COURSE]).toBe('/assets/demo/drop.course.json');
    const t = store(); rememberCourse(t, new URLSearchParams('?course=//evil.example/a.course.json')); expect(t.data[LAST_COURSE]).toBeUndefined();
  });
  it('the one-time flags have their own names', () => { expect(new Set([TOUR_DONE, NEXT_SEEN, FALL_SEEN, LAST_COURSE]).size).toBe(4); });
});

describe('the keys the tour shows for a course', () => {
  it('always run and jump', () => { expect(movesFor(defaultCourse).map((m) => m.label).slice(0, 2)).toEqual(['Run', 'Jump']); });
  it('a launcher adds Fire, bars add Hold on', () => {
    expect(movesFor({ ...defaultCourse, recoil: { x0: 1, x1: 3 } }).map((m) => m.label)).toContain('Fire');
    expect(movesFor({ ...defaultCourse, holds: [{ x: 5, y: 3 }] }).map((m) => m.label)).toContain('Hold on');
  });
});
