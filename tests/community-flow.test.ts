import { editorSource } from './helpers/editor-source';
import { describe, expect, it } from 'vitest';
import { STEPS, TABS, canEnter, nextStep, prevStep, startState, tabFor, whyNot, type Box } from '../src/community/flow';

const q = (s: string) => new URLSearchParams(s);
const sug = (box: Box, label = 'bench') => ({ label, score: 0.9, box, cutout: '' });

describe('the stepper', () => {
  it('has the three steps in order: no box to draw, no upfront choice', () => {
    expect(STEPS.map((s) => s.id)).toEqual(['photo', 'segment', 'make']);
    expect(nextStep('photo')).toBe('segment'); expect(nextStep('make')).toBeNull(); expect(prevStep('photo')).toBeNull(); expect(prevStep('make')).toBe('segment');
  });
  it('walks forward only as each step is earned', () => {
    let s = startState();
    expect(canEnter('photo', s)).toBe(true); expect(canEnter('segment', s)).toBe(false);
    s = { ...s, hasPhoto: true }; expect(canEnter('segment', s)).toBe(true); expect(canEnter('make', s)).toBe(false);
    expect(whyNot('make', s)).toMatch(/click the thing you want/);
    s = { ...s, segmented: true }; expect(canEnter('make', s)).toBe(true);
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

// ---- CC-247: the found things, several at once, the prize, and finding your piece ----
import { COST_WORDS, LIFT_PARALLEL, MAX_PICKS, PRIZE_TURN_MS, allowedNow, buildFound, dailyLine, queueWarning, whyOff, editorHref, makeLabel, placeParam, runQueue, stableOrder, toggleTick, turnAngle } from '../src/community/flow';
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
  it('picks nothing by itself: the player clicks', () => {
    const items = buildFound(found);
    expect(items.map((i) => i.label)).toEqual(['wall', 'bench', 'box', 'pole']);
    expect(items.every((i) => !('yours' in i))).toBe(true);
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
});

describe('click to pick', () => {
  it('a click picks, a second click puts it back, and the queue keeps list order', () => {
    let t: number[] = [];
    t = toggleTick(t, 2); expect(t).toEqual([2]);
    t = toggleTick(t, 0); expect(t).toEqual([0, 2]);
    t = toggleTick(t, 2); expect(t).toEqual([0]);
  });
  it('the page has no box drawing left and every found thing can be reached with the keyboard', () => {
    const src = readFileSync('src/modes/community-flow.ts', 'utf8');
    expect(src).not.toMatch(/Skip the finder|pointerdown|setPointerCapture|ui\/regions|stepMark/);
    expect(src).toMatch(/b\.tabIndex = 0/); expect(src).toMatch(/e\.key === 'Enter'/); expect(src).toMatch(/b\.onclick = \(e\) => \{ e\.stopPropagation\(\); view\.click/);
    expect(src).toMatch(/Try again/); expect(src).toMatch(/Pick a different photo/);
  });
});

describe('the daily count of pieces (the numbers come from the server)', () => {
  const t = (perDay: number, left: number) => ({ perDay, left });
  it('the line next to the button says how many a day and how many are left, and that more cost more', () => {
    const w = dailyLine(t(5, 2));
    expect(w).toContain('5 pieces a day'); expect(w).toContain('2 left today'); expect(w).toMatch(/more pieces cost more/); expect(w).toContain(COST_WORDS);
    expect(dailyLine(t(5, 0))).toMatch(/None left today/);
  });
  it('a queue longer than what is left warns, and only the left count may start', () => {
    expect(allowedNow(4, t(5, 2))).toBe(2); expect(allowedNow(2, t(5, 2))).toBe(2); expect(allowedNow(3, t(5, 0))).toBe(0);
    expect(queueWarning(4, t(5, 2))).toMatch(/queued 4 but only 2 are left today/); expect(queueWarning(4, t(5, 1))).toMatch(/only 1 is left/);
    expect(queueWarning(2, t(5, 2))).toBe(''); expect(queueWarning(3, t(5, 0))).toMatch(/no pieces left/);
  });
  it('the extra ones are switched off with a plain reason, in queue order', () => {
    expect([0, 1, 2, 3].map((i) => whyOff(i, t(5, 2)) !== '')).toEqual([false, false, true, true]);
    expect(whyOff(2, t(5, 2))).toMatch(/Try again tomorrow/);
  });
  it('with no count from the server nothing is blocked here (the server still decides)', () => {
    expect(allowedNow(3, null)).toBe(3); expect(queueWarning(3, null)).toBe(''); expect(whyOff(5, null)).toBe('');
  });
  it('the page reads the count from the server and never types a number', () => {
    const src = readFileSync('src/modes/community-flow.ts', 'utf8');
    expect(src).toMatch(/piecesToday\(\)/); expect(src).toMatch(/id = 'daily-line'/); expect(src).toMatch(/id = 'queue-warning'/);
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
    const ed = editorSource(), pb = readFileSync('src/ui/piece-browser.ts', 'utf8');
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
    const ed = editorSource(), pb = readFileSync('src/ui/piece-browser.ts', 'utf8');
    expect(ed).toContain('data-shared-piece'.replace('data-shared-piece', 'dataset.sharedPiece'));
    expect(ed).toContain('isSharedSrc(q.src)');
    expect(pb).toContain('Shared pieces');
  });
});

describe('long lists in the editor (CC-247)', () => {
  it('the groups show a dozen at a time with Show more, and search asks the server', async () => {
    const { readFileSync } = await import('node:fs');
    const { GROUP_SHOWN } = await import('../src/community/flow');
    const pb = readFileSync('src/ui/piece-browser.ts', 'utf8');
    expect(GROUP_SHOWN).toBe(12);
    expect(pb).toContain('mine.slice(0, shownMine)');
    expect(pb).toContain('sharedP.slice(0, shownShared)');
    expect(pb).toContain("listSharedPage({ q, kind: 'piece', cursor })");
  });
});
