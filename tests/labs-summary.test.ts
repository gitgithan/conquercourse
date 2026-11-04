import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LAB_LIST } from '../src/ui/labs-series';
import { LAB_SUMMARY, summaryHtml } from '../src/ui/labs-summary';
import { mountLabFlow } from '../src/ui/lab-flow';

// Every Lab opens with a short box: what you can do, and what you take away. The data is in src/ui/labs-summary.ts, keyed by mode name.
describe('lab summaries', () => {
  it('every Lab has one, with 2 to 3 do lines and a learn sentence', () => {
    for (const l of LAB_LIST) {
      const s = LAB_SUMMARY[l.mode];
      expect(s, l.mode).toBeTruthy();
      expect(s.do.length, l.mode).toBeGreaterThanOrEqual(2);
      expect(s.do.length, l.mode).toBeLessThanOrEqual(3);
      expect(s.learn.length, l.mode).toBeGreaterThan(20);
    }
  });
  it('has no entry for an unknown mode', () => {
    const modes = new Set(LAB_LIST.map((l) => l.mode));
    for (const k of Object.keys(LAB_SUMMARY)) expect(modes.has(k), k).toBe(true);
  });
  it('keeps lines short and never names a Lab number', () => {
    for (const [k, s] of Object.entries(LAB_SUMMARY)) {
      for (const d of s.do) expect(d.length, `${k}: ${d}`).toBeLessThanOrEqual(110);
      expect(s.learn.length, k).toBeLessThanOrEqual(120);
      if (s.try) expect(s.try.length, k).toBeLessThanOrEqual(90);
      for (const t of [...s.do, s.learn, s.try ?? '']) expect(/\blabs?\s*\d/i.test(t), `${k}: ${t}`).toBe(false);
    }
  });
  it('lab-flow puts the box first in every Lab, with the learn sentence in it', () => {
    const g = globalThis as unknown as { document?: unknown };
    const old = g.document;
    try {
      for (const l of LAB_LIST) {
        const inserted: string[] = [];
        const wrap = { querySelector: () => null, insertAdjacentHTML: (_w: string, h: string) => inserted.push(h) };
        g.document = { getElementById: () => ({}), createElement: () => ({}), head: { appendChild() {} } };
        mountLabFlow({ querySelector: () => wrap } as unknown as HTMLElement, l.mode);
        const first = inserted[0] ?? '';
        expect(first.startsWith('<div class="lab-summary"'), l.mode).toBe(true);
        expect(first, l.mode).toContain(LAB_SUMMARY[l.mode].learn.replace(/&/g, '&amp;'));
        expect(summaryHtml(l.mode)).toContain('You take away');
      }
    } finally { g.document = old; }
  });
  it('the Labs index says where summaries live and that a new Lab must add one', () => {
    const readme = readFileSync('docs/labs/README.md', 'utf8');
    expect(readme).toContain('src/ui/labs-summary.ts');
    expect(readme).toMatch(/new Lab must add/i);
  });
});
