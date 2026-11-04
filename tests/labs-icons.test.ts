import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LAB_ICONS, labIconSvg } from '../src/ui/labs-icons';
import { LAB_LIST } from '../src/ui/labs-series';

// CC-133: every Lab has its own square picture, keyed by mode (never by number).
describe('Lab icons', () => {
  it('every Lab has an icon, and no icon is left over', () => {
    for (const l of LAB_LIST) expect(LAB_ICONS[l.mode], l.mode).toBeTruthy();
    expect(Object.keys(LAB_ICONS).sort()).toEqual(LAB_LIST.map((l) => l.mode).sort());
  });
  it('every icon is its own drawing, square, with balanced tags and no outside pictures', () => {
    expect(new Set(Object.values(LAB_ICONS)).size).toBe(LAB_LIST.length);
    for (const l of LAB_LIST) {
      const svg = labIconSvg(l.mode);
      expect(svg, l.mode).toMatch(/viewBox="0 0 48 48" width="56" height="56"/);
      expect(svg).not.toMatch(/<image|href=|http(?!:\/\/www\.w3\.org)/);
      expect((svg.match(/<svg/g) ?? []).length).toBe(1);
      const opens = (svg.match(/<(path|rect|circle)\b/g) ?? []).length;
      expect(opens, l.mode).toBeGreaterThanOrEqual(4);
    }
  });
  it('is documented in ASSETS.md and holds no Lab numbers', () => {
    expect(readFileSync('docs/ASSETS.md', 'utf8')).toContain('src/ui/labs-icons.ts');
    expect(readFileSync('src/ui/labs-icons.ts', 'utf8')).not.toMatch(/'lab-\w+'\s*:\s*\/\/.*\b\d+\b|Lab \d+/);
  });
});
