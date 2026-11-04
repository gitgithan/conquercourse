// CC-133: the toasts are "N-back with N = 2": the message now in the main slot, the 2 before it dimmed above it.
import { describe, expect, it } from 'vitest';
import { nbackPush, nbackRows, nbackStart, NBACK_DIM, NBACK_LIFE_MS, NBACK_N } from '../src/ui/nback';

const feed = (texts: string[], at0 = 0, step = 1000) => texts.reduce((s, t, i) => nbackPush(s, t, at0 + i * step), nbackStart());

describe('N-back toasts (N = 2)', () => {
  it('N is 2', () => expect(NBACK_N).toBe(2));
  it('the first message sits in the main slot with nothing above it', () => {
    const s = feed(['A']);
    expect(s.current).toBe('A');
    expect(nbackRows(s, 0)).toEqual([]);
  });
  it('a new message dims the current one and moves it up a slot', () => {
    const s = feed(['A', 'B']);
    expect(s.current).toBe('B');
    expect(nbackRows(s, 1000).map((r) => [r.text, r.slot])).toEqual([['A', 1]]);
  });
  it('the previous 2 are kept, the oldest drops off, the new one takes the main slot', () => {
    const s = feed(['A', 'B', 'C', 'D']);
    expect(s.current).toBe('D');
    expect(nbackRows(s, 3000).map((r) => [r.text, r.slot])).toEqual([['B', 2], ['C', 1]]); // top to bottom: the older one first
  });
  it('never more than N rows above the main slot, whatever arrives', () => {
    const s = feed(Array.from({ length: 12 }, (_, i) => `m${i}`));
    expect(nbackRows(s, 11000).length).toBeLessThanOrEqual(NBACK_N);
  });
  it('the older, the dimmer, and both dimmer than the main message (opacity 1)', () => {
    const rows = nbackRows(feed(['A', 'B', 'C']), 2000);
    const o = (slot: number) => rows.find((r) => r.slot === slot)!.opacity;
    expect(o(2)).toBeLessThan(o(1));
    expect(o(1)).toBeLessThan(1);
    expect(NBACK_DIM[0]).toBeGreaterThan(NBACK_DIM[1]);
  });
  it('the same message again changes nothing, and a message that comes back is current, not also a dimmed copy', () => {
    const s = feed(['A', 'B']);
    expect(nbackPush(s, 'B', 5000)).toBe(s);
    const back = nbackPush(s, 'A', 2000);
    expect(back.current).toBe('A');
    expect(nbackRows(back, 2000).map((r) => r.text)).toEqual(['B']);
  });
  it('an empty screen keeps the last message dimmed, then it fades away', () => {
    const s = feed(['A', '']);
    expect(s.current).toBe('');
    expect(nbackRows(s, 1000).map((r) => r.text)).toEqual(['A']);
    expect(nbackRows(s, 1000 + NBACK_LIFE_MS)).toEqual([]);
  });
  it('rows keep their id as they move up, so the view can slide them', () => {
    const a = feed(['A', 'B']), b = nbackPush(a, 'C', 2000);
    expect(nbackRows(b, 2000).find((r) => r.text === 'A')!.id).toBe(nbackRows(a, 1000)[0].id);
    expect(nbackRows(b, 2000).find((r) => r.text === 'A')!.slot).toBe(2);
  });
});
