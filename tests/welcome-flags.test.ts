import { describe, expect, it } from 'vitest';
import { startHref, welcomeOn } from '../src/ui/welcome-flags';
import { TOUR_DONE, type Store } from '../src/ui/onboarding-flags';

const q = (s: string) => new URLSearchParams(s);
const store = (done: boolean): Store => ({ get: (k) => (done && k === TOUR_DONE ? '1' : null), set: () => {} });

describe('welcome screen routing (CC-246)', () => {
  it('opens on a bare visit', () => {
    expect(welcomeOn({ params: q(''), automated: false })).toBe(true);
  });
  it('a tagged link (?ref=, ?analytics=0) still opens it', () => {
    for (const s of ['?ref=friend_whatsapp', '?ref=x&analytics=0']) expect(welcomeOn({ params: q(s), automated: false }), s).toBe(true);
  });
  it('?welcome=0 skips it', () => {
    expect(welcomeOn({ params: q('?welcome=0'), automated: false })).toBe(false);
  });
  it('explicit links are left alone', () => {
    for (const s of ['?mode=course', '?mode=editor', '?mode=map', '?course=/assets/demo/x.course.json', '?demo=rookie', '?bot=1', '?nav=0', '?tour=1']) {
      expect(welcomeOn({ params: q(s), automated: false }), s).toBe(false);
    }
  });
  it('test runs and films bypass it unless they ask', () => {
    expect(welcomeOn({ params: q(''), automated: true })).toBe(false);
    expect(welcomeOn({ params: q('?welcome=1'), automated: true })).toBe(true);
  });
  it('the build switch turns it off', () => {
    expect(welcomeOn({ params: q(''), automated: false, build: false })).toBe(false);
  });
  it('a key or click starts the First Course, never the Training course', () => {
    expect(startHref(store(false))).toBe('?welcome=0&tour=1');
    expect(startHref(store(true))).toBe('?welcome=0');
    expect(startHref(store(false))).not.toContain('training');
  });
});
