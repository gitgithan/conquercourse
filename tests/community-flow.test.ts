import { describe, expect, it } from 'vitest';
import { STEPS, TABS, afterMarksChanged, canEnter, iou, matchSuggestions, nextStep, prevStep, startState, tabFor, wallpaperCrop, whyNot, type Box } from '../src/community/flow';

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
    expect(whyNot('segment', s)).toMatch(/Mark the area/);
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

// ---- CC-247: the found things, several at once, the prize, and finding your piece ----
import { COST_WORDS, LIFT_PARALLEL, MAX_PICKS, PRIZE_TURN_MS, buildFound, editorHref, makeLabel, placeParam, runQueue, stableOrder, toggleTick, turnAngle } from '../src/community/flow';
import { readFileSync } from 'node:fs';

describe('the found things keep one fixed order', () => {
  const found = [sug([300, 10, 340, 50], 'pole'), sug([0, 100, 200, 220], 'wall'), sug([10, 10, 60, 60], 'bench'), sug([210, 10, 260, 60], 'box')];
  it('is biggest first, then top to bottom, left to right, then by name; and the same however the input is shuffled', () => {
    const a = stableOrder(found).map((f) => f.label);
    expect(a).toEqual(['wall', 'bench', 'box', 'pole']);
    for (let k = 0; k < 5; k++) expect(stableOrder([...found].sort(() => Math.random() - 0.5)).map((f) => f.label)).toEqual(a);
  });
  it('does not change with the score, so a re-run never reshuffles the buttons', () => {
    const hot = found.map((f, i) => ({ ...f, score: i / 10 })), cold = found.map((f, i) => ({ ...f, score: 1 - i / 10 }));
    expect(stableOrder(hot).map((f) => f.label)).toEqual(stableOrder(cold).map((f) => f.label));
  });
  it('puts your own box first and ticks it', () => {
    const r = buildFound({ box: [10, 10, 60, 60] }, found);
    expect(r.items[0].yours).toBe(true); expect(r.items[0].label).toBe('bench'); expect(r.ticked).toEqual([0]);
    expect(r.items.map((i) => i.label).slice(1)).toEqual(['wall', 'box', 'pole']);
  });
  it('calls an unmatched box "your box" and keeps every found thing', () => {
    const r = buildFound({ box: [500, 500, 520, 520] }, found);
    expect(r.items[0].label).toBe('your box'); expect(r.items.length).toBe(5);
  });
});

describe('ticking several after Segment Region', () => {
  it('ticks and unticks, keeps list order, and stops at the limit', () => {
    let t: number[] = [];
    t = toggleTick(t, 3); t = toggleTick(t, 1); expect(t).toEqual([1, 3]);
    t = toggleTick(t, 3); expect(t).toEqual([1]);
    for (let i = 0; i < 20; i++) t = toggleTick(t, i);
    expect(t.length).toBe(MAX_PICKS);
    expect(toggleTick(t, 19)).toEqual(t);
  });
  it('labels the make button for one or many', () => { expect(makeLabel(1)).toBe('Make 1 piece'); expect(makeLabel(3)).toBe('Make 3 pieces'); expect(COST_WORDS).toMatch(/cents/); });
  it('before segmentation there is still one box only', () => {
    expect(afterMarksChanged(startState(), 1).marks).toBe(1);
  });
});

describe('one lift per ticked item, never more than the allowed number at once', () => {
  it('runs each item exactly once, in order, and waits in line', async () => {
    let live = 0, peak = 0; const started: number[] = [], states: string[] = [];
    const out = await runQueue(['a', 'b', 'c'], async (_x, i) => { started.push(i); live++; peak = Math.max(peak, live); await new Promise((r) => setTimeout(r, 5)); live--; return i; }, LIFT_PARALLEL, (i, s) => states.push(`${i}:${s}`));
    expect(started).toEqual([0, 1, 2]); expect(peak).toBeLessThanOrEqual(LIFT_PARALLEL);
    expect(out.map((o) => o.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
    expect(states.slice(0, 3)).toEqual(['0:waiting', '1:waiting', '2:waiting']);
  });
  it('one failing item does not stop the others', async () => {
    const out = await runQueue([1, 2, 3], async (x) => { if (x === 2) throw new Error('no'); return x; }, 2);
    expect(out.map((o) => o.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
  });
  it('makes one lift call per item (the source calls liftObject once per piece slot)', () => {
    const src = readFileSync('src/modes/community-flow.ts', 'utf8');
    expect(src.match(/liftObject\(/g)?.length).toBe(1); // the one call lives in makeOne, which the queue runs once per item
    expect(src).toMatch(/runQueue\(todo, \(s\) => makeOne\(s\)/);
  });
});

describe('the prize turntable and finding your piece', () => {
  it('turns a full 360 degrees in the set time and starts again', () => {
    expect(turnAngle(0)).toBe(0); expect(turnAngle(PRIZE_TURN_MS / 2)).toBeCloseTo(Math.PI, 6);
    expect(turnAngle(PRIZE_TURN_MS - 1)).toBeLessThan(Math.PI * 2); expect(turnAngle(PRIZE_TURN_MS)).toBe(0);
    expect(PRIZE_TURN_MS).toBe(8000);
  });
  it('stays still when reduced motion is on', () => { expect(turnAngle(0, true)).toBe(turnAngle(5000, true)); });
  it('the editor link carries the piece id and the id comes back out', () => {
    const h = editorHref('u-abc_12'); expect(h).toContain('mode=editor'); expect(placeParam(h.slice(h.indexOf('?')))).toBe('u-abc_12');
    expect(placeParam('?place=../../x')).toBe(''); expect(placeParam('?mode=editor')).toBe('');
  });
  it('the editor lists your pieces without a switch, and the Add pieces browser gives them cards', () => {
    const ed = readFileSync('src/modes/editor.ts', 'utf8'), pb = readFileSync('src/ui/piece-browser.ts', 'utf8');
    const block = ed.slice(ed.indexOf('if (uploadObjOn()) {'), ed.indexOf('const mineIds'));
    expect(block).not.toMatch(/listUserObjects/); // listing is outside the switch
    expect(ed).toMatch(/dataset\.fromPhoto = '1'/); expect(pb).toMatch(/My pieces/); expect(pb).toMatch(/data-from-photo/);
  });
});

describe('shared pieces from other players (CC-247)', () => {
  it('only approved pieces are placeable; held, blocked and removed never', async () => {
    const { placeableShared } = await import('../src/community/flow');
    expect(placeableShared({ kind: 'piece', status: 'approved' })).toBe(true);
    expect(placeableShared({ kind: 'piece' })).toBe(true);
    for (const status of ['pending', 'held', 'blocked', 'removed']) expect(placeableShared({ kind: 'piece', status })).toBe(false);
    expect(placeableShared({ kind: 'wallpaper', status: 'approved' })).toBe(false);
  });
  it('the shared source id round-trips and the place link accepts it', async () => {
    const { sharedSrc, isSharedSrc, sharedGlbUrl, placeParam, editorHref } = await import('../src/community/flow');
    expect(isSharedSrc(sharedSrc('abc_12-x'))).toBe(true);
    expect(isSharedSrc('shared:../x')).toBe(false);
    expect(isSharedSrc('user:abc')).toBe(false);
    expect(sharedGlbUrl('abc')).toBe('/api/community-items?id=abc&file=glb');
    expect(placeParam(editorHref(sharedSrc('abc')))).toBe('shared:abc');
    expect(placeParam('?place=shared:../x')).toBe('');
  });
  it('a course with a shared piece carries the store url and a plain shape as a fallback', async () => {
    const { sceneFor } = await import('../src/slice/scene');
    const mesh = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), indices: new Uint32Array([0, 1, 2]) };
    const out = sceneFor([{ x: 0, z: 0, y: 0, yaw: 0, scale: 1, mesh, src: 'shared:abc' } as never], { angle: 0, offset: 0, level: 0 }, [{ u0: 0, u1: 5, x0: 0 }]);
    expect(out[0].url).toBe('/api/community-items?id=abc&file=glb');
    expect(out[0].mesh?.indices.length).toBe(3);
  });
  it('the editor lists shared pieces, places them and loads them back', async () => {
    const { readFileSync } = await import('node:fs');
    const ed = readFileSync('src/modes/editor.ts', 'utf8'), pb = readFileSync('src/ui/piece-browser.ts', 'utf8');
    expect(ed).toContain('data-shared-piece'.replace('data-shared-piece', 'dataset.sharedPiece'));
    expect(ed).toContain('isSharedSrc(q.src)');
    expect(pb).toContain('Shared pieces');
  });
});
