import { describe, expect, it } from 'vitest';
import { STEPS, TABS, afterMarksChanged, canEnter, flowOn, iou, matchSuggestions, nextStep, prevStep, startState, tabFor, wallpaperCrop, whyNot, type Box } from '../src/community/flow';

const q = (s: string) => new URLSearchParams(s);
const sug = (box: Box, label = 'bench') => ({ label, score: 0.9, box, cutout: '' });

describe('the stepper', () => {
  it('has the five steps in order, with no upfront wallpaper-or-object choice', () => {
    expect(STEPS.map((s) => s.id)).toEqual(['photo', 'mark', 'segment', 'choose', 'make']);
    expect(nextStep('photo')).toBe('mark'); expect(nextStep('make')).toBeNull(); expect(prevStep('photo')).toBeNull(); expect(prevStep('segment')).toBe('mark');
  });
  it('walks forward only as each step is earned', () => {
    let s = startState();
    expect(canEnter('photo', s)).toBe(true); expect(canEnter('mark', s)).toBe(false);
    s = { ...s, hasPhoto: true }; expect(canEnter('mark', s)).toBe(true); expect(canEnter('segment', s)).toBe(false);
    expect(whyNot('segment', s)).toMatch(/Mark at least one/);
    s = { ...s, marks: 2 }; expect(canEnter('segment', s)).toBe(true); expect(canEnter('choose', s)).toBe(false);
    expect(whyNot('choose', s)).toMatch(/Segment Region/);
    s = { ...s, segmented: true }; expect(canEnter('choose', s)).toBe(true); expect(canEnter('make', s)).toBe(false);
    s = { ...s, choices: { 1: 'piece' } }; expect(canEnter('make', s)).toBe(true);
  });
  it('changing the marks sends you back to segment again and drops the choices', () => {
    const s = afterMarksChanged({ hasPhoto: true, marks: 2, segmented: true, choices: { 1: 'wallpaper' } }, 3);
    expect(s.segmented).toBe(false); expect(s.choices).toEqual({}); expect(s.marks).toBe(3); expect(canEnter('choose', s)).toBe(false);
  });
});

describe('tabs and the feature switch', () => {
  it('opens Explore first, so finished work comes before the making flow', () => {
    expect(TABS.map((t) => t.id)).toEqual(['explore', 'make']);
    expect(tabFor('communities', q(''))).toBe('explore');
    expect(tabFor('gallery', q(''))).toBe('explore');
  });
  it('opens the making flow only when asked, and keeps the old tab names working', () => {
    expect(tabFor('communities', q('tab=make'))).toBe('make');
    expect(tabFor('communities', q('tab=photos'))).toBe('make');
    expect(tabFor('communities', q('tab=objects'))).toBe('explore');
    expect(tabFor('communities', q('tab=places'))).toBe('explore');
    expect(tabFor('communities', q('tab=nope'))).toBe('explore');
  });
  it('is on with flow=1, off with flow=0, and by default only on the preview address', () => {
    expect(flowOn(q('flow=1'), 'conquercourse.pages.dev')).toBe(true);
    expect(flowOn(q('flow=0'), 'preview.conquercourse.pages.dev')).toBe(false);
    expect(flowOn(q(''), 'preview.conquercourse.pages.dev')).toBe(true);
    expect(flowOn(q(''), 'conquercourse.pages.dev')).toBe(false);
    expect(flowOn(q(''), 'localhost')).toBe(false);
  });
});

describe('marks find their cut-outs', () => {
  it('overlap is symmetric and zero for apart boxes', () => {
    expect(iou([0, 0, 10, 10], [0, 0, 10, 10])).toBe(1); expect(iou([0, 0, 10, 10], [20, 20, 30, 30])).toBe(0);
    expect(iou([0, 0, 10, 10], [5, 0, 15, 10])).toBeCloseTo(1 / 3, 5);
  });
  it('gives each mark its best suggestion once, and offers the rest as extras', () => {
    const a = sug([10, 10, 100, 100], 'bench'), b = sug([300, 10, 400, 100], 'wall'), c = sug([600, 400, 700, 500], 'stairs');
    const { matched, extras } = matchSuggestions([{ id: 1, box: [20, 20, 110, 110] }, { id: 2, box: [310, 0, 410, 90] }], [a, b, c]);
    expect(matched.get(1)).toBe(a); expect(matched.get(2)).toBe(b); expect(extras).toEqual([c]);
  });
  it('leaves a mark with no near suggestion on its own box', () => {
    const { matched, extras } = matchSuggestions([{ id: 1, box: [0, 0, 50, 50] }], [sug([500, 500, 600, 600])]);
    expect(matched.size).toBe(0); expect(extras).toHaveLength(1);
  });
  it('two marks never share one suggestion', () => {
    const a = sug([10, 10, 100, 100]);
    const { matched } = matchSuggestions([{ id: 1, box: [10, 10, 100, 100] }, { id: 2, box: [20, 20, 90, 90] }], [a]);
    expect(matched.size).toBe(1); expect(matched.get(1)).toBe(a);
  });
});

describe('the wallpaper crop is the mark, widened to 16:9 and kept inside the photo', () => {
  it('widens a tall box and stays inside', () => {
    const c = wallpaperCrop([100, 100, 200, 300], 1000, 600);
    expect((c[2] - c[0]) / (c[3] - c[1])).toBeCloseTo(16 / 9, 1);
    expect(c[0]).toBeGreaterThanOrEqual(0); expect(c[2]).toBeLessThanOrEqual(1000); expect(c[1]).toBeGreaterThanOrEqual(0); expect(c[3]).toBeLessThanOrEqual(600);
  });
  it('shifts a box at the edge back inside', () => {
    const c = wallpaperCrop([0, 0, 50, 200], 800, 600);
    expect(c[0]).toBe(0); expect(c[1]).toBe(0);
  });
});
