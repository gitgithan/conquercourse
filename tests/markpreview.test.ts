import { describe, expect, it } from 'vitest';
import { awaitsConfirm, boxProblem, canTick, confirm, cutProblem, liftable, oneCut, type MarkedCut } from '../src/slice/markpreview';
import { segmentProblem } from '../src/slice/segment';
import { readFileSync } from 'node:fs';
import type { Box } from '../src/slice/markbox';

const drawn: Box = [500, 250, 1240, 410];
const cut = { box: [520, 260, 1200, 400] as Box, cutout: 'AAAA' };
describe('mark it yourself: the cut-out preview (CC-133)', () => {
  it('offers a cut-out that sits in the drawn box', () => { expect(cutProblem(drawn, cut, [])).toBe(''); });
  it('refuses an empty reply, a speck, and a cut-out somewhere else, in plain words', () => {
    expect(cutProblem(drawn, null, [])).toMatch(/could not outline/);
    expect(cutProblem(drawn, { box: cut.box, cutout: '' }, [])).toMatch(/could not outline/);
    expect(cutProblem(drawn, { box: [600, 300, 620, 310], cutout: 'AA' }, [])).toMatch(/something else/);
    expect(cutProblem(drawn, { box: [0, 0, 300, 200], cutout: 'AA' }, [])).toMatch(/something else/);
  });
  it('refuses a cut-out on a person', () => { expect(cutProblem(drawn, cut, [[540, 270, 700, 395]])).toMatch(/person/); });
  it('a marked thing waits for the player; a finder outline does not', () => {
    const m: MarkedCut = { label: 'bar', box: drawn, marked: true };
    expect(awaitsConfirm(m)).toBe(true); expect(canTick(m)).toBe(false);
    expect(canTick(confirm(m))).toBe(true);
    expect(canTick({ label: 'bench', box: drawn })).toBe(true);
  });
  it('the confirm gate: an unconfirmed marked thing never reaches the lift, even if ticked', () => {
    const cands: MarkedCut[] = [{ label: 'bench', box: drawn }, { label: 'bar', box: drawn, marked: true }, { label: 'pole', box: drawn, marked: true, confirmed: true }];
    expect(liftable(cands, [0, 1, 2])).toEqual([0, 2]);
    expect(liftable(cands, [1])).toEqual([]);
    expect(liftable(cands, [7])).toEqual([]);
  });
  it('oneCut takes the first item, or null', () => { expect(oneCut([])).toBeNull(); expect(oneCut([{ box: drawn, cutout: 'x' }])?.cutout).toBe('x'); });
  it('the server route checks the box', () => {
    expect(boxProblem(undefined)).toBe(''); expect(boxProblem([1, 2, 30, 40])).toBe('');
    expect(boxProblem([1, 2, 3])).toMatch(/not right/); expect(boxProblem([30, 2, 3, 40])).toMatch(/not right/); expect(boxProblem(['a', 1, 2, 3])).toMatch(/not right/);
  });
  it('the page lifts only through the gate, and the marked box is not ticked before Use this', () => {
    const src = readFileSync('src/modes/community-flow.ts', 'utf8');
    expect(src).toMatch(/liftable\(work\.cands, work\.ticked\)/);
    expect(src).toMatch(/maskBox\(/);
    expect(src).not.toMatch(/work\.cands = \[\.\.\.work\.cands, \{ label, box, marked: true \}\]/);
  });
  it('segment accepts a photo with a box, and refuses a bad one at the same door', () => {
    const J = 'data:image/jpeg;base64,AAAA';
    expect(segmentProblem({ image: J, thumb: J, box: [1, 2, 30, 40] })).toBe('');
    expect(segmentProblem({ image: J, thumb: J, box: [1, 2] })).toMatch(/box/);
  });
});
