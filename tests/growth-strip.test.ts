// CC-108: the growth chart always draws a visible dot for every day, and a line only between two or more.
// No browser here: a tiny stand-in for document.createElementNS records the SVG parts.
import { beforeAll, describe, expect, it } from 'vitest';
import { countText, dayText, drawChart, dotX, summaryText } from '../src/ui/growth-strip';
import type { DailyStats } from '../src/slice/daily-stats';

class El {
  children: El[] = []; attrs: Record<string, string> = {}; textContent = '';
  constructor(public tag: string) {}
  setAttribute(k: string, v: string) { this.attrs[k] = v; }
  append(...c: El[]) { this.children.push(...c); }
  all(tag: string): El[] { return [...this.children.filter((c) => c.tag === tag), ...this.children.flatMap((c) => c.all(tag))]; }
}
beforeAll(() => { (globalThis as unknown as { document: unknown }).document = { createElementNS: (_: string, t: string) => new El(t) }; });

const mk = (xs: number[]): DailyStats => ({ days: xs.map((_, i) => `2026-10-${String(20 + i).padStart(2, '0')}`), series: { players: xs, runs: xs, assets: xs, clears: xs } });
const draw = (xs: number[]) => drawChart(mk(xs), 'players', 720) as unknown as El;
const dots = (s: El) => s.all('circle').map((c) => ({ cx: Number(c.attrs.cx), cy: Number(c.attrs.cy), r: Number(c.attrs.r) }));
const inBox = (p: { cx: number; cy: number }) => Number.isFinite(p.cx) && Number.isFinite(p.cy) && p.cx >= 0 && p.cx <= 720 - 34 - 14 && p.cy >= 0 && p.cy <= 150 - 22 - 26;

describe('growth chart dots', () => {
  it('one day of data is one visible, centred dot with its value, and no line', () => {
    const s = draw([5]);
    const ds = dots(s);
    expect(ds).toHaveLength(1);
    expect(inBox(ds[0])).toBe(true);
    expect(ds[0].r).toBeGreaterThan(0);
    expect(ds[0].cx).toBeCloseTo(dotX(0, 1, 720 - 34 - 14), 0);
    expect(s.all('polyline')).toHaveLength(0);
    expect(s.all('text').map((t) => t.textContent)).toContain('5');
  });
  it('two or more days are a line plus a dot per day', () => {
    const s = draw([1, 4, 2, 5]);
    expect(s.all('polyline')).toHaveLength(1);
    expect(dots(s)).toHaveLength(4);
    expect(dots(s).every(inBox)).toBe(true);
  });
  it('no data is a dot sitting on zero', () => {
    const s = draw([0]);
    const [p] = dots(s);
    expect(inBox(p)).toBe(true);
    expect(p.cy).toBe(150 - 22 - 26);
    const none = drawChart({ days: [], series: { players: [], runs: [], assets: [], clears: [] } }, 'runs') as unknown as El;
    expect(dots(none)).toHaveLength(1);
  });
  it('a long series keeps one dot per day', () => {
    expect(dots(draw(Array.from({ length: 45 }, (_, i) => i)))).toHaveLength(45);
  });
  it('words: plain sentences', () => {
    expect(dayText('2026-10-31')).toBe('Oct 31');
    expect(countText('players', 1)).toBe('1 player');
    expect(summaryText(mk([5]), 'players')).toBe('5 players on Oct 20.');
    expect(summaryText(mk([1, 2, 3]), 'runs')).toBe('6 runs in the last 3 days.');
  });
});
