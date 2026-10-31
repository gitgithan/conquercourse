import { describe, expect, it } from 'vitest';
import { FEATURES, editorTrialRunning, featureOf, navOn } from '../src/ui/site-nav';

// CC-246: the four features carry the same names on every page.
describe('site nav', () => {
  it('names the four features the way the product owner asked', () => {
    expect(FEATURES.map((f) => f.label)).toEqual(['Courses', 'World Editor', 'World Slicer', 'Community']);
  });
  it('marks the tab of the page you are on', () => {
    expect(featureOf(null)).toBe('courses');
    expect(featureOf('editor')).toBe('editor');
    expect(featureOf('map')).toBe('slicer');
    for (const m of ['communities', 'gallery', 'park']) expect(featureOf(m)).toBe('community');
    expect(featureOf('dojo')).toBeNull();
  });
  it('stays out of films, bots, demos and ?nav=0', () => {
    expect(navOn(new URLSearchParams(''))).toBe(true);
    expect(navOn(new URLSearchParams('mode=map'))).toBe(true);
    for (const q of ['nav=0', 'film=1', 'bot=1', 'demo=lache', 'mode=coaster']) expect(navOn(new URLSearchParams(q))).toBe(false);
  });
  it('knows the editor is hidden by a trial run (clicking World Editor then returns to editing)', () => {
    expect(editorTrialRunning({ querySelector: () => null })).toBe(true);
    expect(editorTrialRunning({ querySelector: () => ({}) as Element })).toBe(false);
  });
});
