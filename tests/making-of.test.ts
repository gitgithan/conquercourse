import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs script
import { findings } from '../scripts/check-personal.mjs';
// @ts-expect-error plain .mjs script
import { buildAll } from '../scripts/making-of.mjs';

const DIR = 'public/making-of';
const files = readdirSync(DIR);
const read = (f: string) => readFileSync(join(DIR, f), 'utf8');

const DENY: [string, RegExp][] = [
  ['source path', /\b(src|server|functions|migrations|scripts|tests)\//],
  ['docs path', /\bdocs\//],
  ['home path', /\/home\/|\/Users\/|C:\\Users/],
  ['e-mail', /[\w.+-]+@[\w-]+\.[a-z]{2,}/i],
  ['IP address', /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/],
  ['tracker link', /linear\.app/i],
  ['private theme', /anti-?cheat|\badmin|\btoken|secret/i],
];

describe('The Making Of public files', () => {
  it('has the three pages and no data file', () => {
    expect([...files].sort()).toEqual(['code-map.html', 'course-map.html', 'index.html', 'site-map.html']);
    expect(files.some((f) => f.endsWith('.json'))).toBe(false);
  });

  for (const f of ['index.html', 'site-map.html', 'course-map.html']) {
    it(`${f} holds nothing private`, () => {
      const t = read(f);
      for (const [name, re] of DENY) expect(t.match(re), `${f}: ${name}`).toBeNull();
    });
  }

  for (const f of ['index.html', 'site-map.html', 'course-map.html']) {
    it(`${f} has no external requests`, () => {
      const t = read(f);
      const urls = t.match(/https?:\/\/[^\s"'<>)]+/g) ?? [];
      for (const u of urls) expect(u, `${f} links ${u}`).toMatch(/openstreetmap\.org/);
      expect(t).not.toMatch(/<(script|link|img|iframe)[^>]+(src|href)=["']https?:/i);
    });
  }

  it('the code map is the drill-down graph page and the index links to it', () => {
    const t = read('code-map.html');
    expect(t).toContain('community-panel:start');
    expect(read('index.html')).toContain('href="code-map.html"');
  });

  it('the index links to the live game page "How a course is made" with a relative link', () => {
    const t = read('index.html');
    expect(t).toContain('How a course is made');
    expect(t).toContain('href="../?mode=parts"');
  });

  for (const f of ['site-map.html', 'course-map.html']) {
    it(`${f} offers the page download and no data download`, () => {
      const t = read(f);
      expect(t).toContain('Download this page (.html)');
      expect(t).toContain('new Blob');
      expect(t).not.toMatch(/Download data|course-map\.json|\.json'/);
    });
  }

  it('the index needs no download control', () => {
    expect(read('index.html')).not.toContain('Download this page');
  });

  it('the course map has no URL at all, is lanes by theme only (no 3D toggle, no milestone lanes)', () => {
    const t = read('course-map.html');
    expect(t.match(/https?:\/\//)).toBeNull();
    expect(t).not.toMatch(/preserve-3d|id="v-3d"|id="v-lane"|rotateX|perspective/);
    expect(t).not.toMatch(/>3D</);
    expect(t).toContain('ConquerCourse issue map');
    expect(t).toContain('Kind of work');
    expect(t).toContain('NEXT');
  });

  it('the site map shows only Part 1: screens and journeys', () => {
    const t = read('site-map.html');
    expect(t).toContain('Play your first course');
    expect(t).not.toMatch(/Where things live|refactor safety net|known red/i);
  });

  it('the course map data is embedded: ids, states, milestones and links, without URLs', () => {
    const m = read('course-map.html').match(/var DATA=(\{.*?\});\n/);
    expect(m).not.toBeNull();
    const d = JSON.parse(m![1]);
    expect(d.issues.length).toBeGreaterThan(100);
    const ids = new Set(d.issues.map((i: { id: string }) => i.id));
    for (const i of d.issues) {
      expect(i.id).toMatch(/^CC-\d+$/);
      expect(['Done', 'In Progress', 'Backlog', 'Canceled']).toContain(i.state);
      expect(i.milestone).toMatch(/^(M[0-5]|Later)$/);
      for (const r of [...i.dependsOn, ...i.affects]) expect(ids.has(r)).toBe(true);
    }
    const byTheme: Record<string, number> = {};
    const byKind: Record<string, number> = {};
    for (const i of d.issues) {
      byTheme[i.theme] = (byTheme[i.theme] ?? 0) + 1;
      byKind[i.kind] = (byKind[i.kind] ?? 0) + 1;
      expect(i.col).toBeGreaterThanOrEqual(0);
      expect(i.col).toBeLessThan(d.phases.length);
    }
    const themes = Object.keys(byTheme);
    expect(themes.length).toBeGreaterThanOrEqual(10);
    expect(themes.length).toBeLessThanOrEqual(15);
    for (const [name, n] of Object.entries(byTheme)) expect(n, name).toBeLessThanOrEqual(30);
    expect(byTheme['Other'] ?? 0).toBeLessThan(d.issues.length * 0.08);
    expect(Object.keys(byKind).length).toBe(7);
    for (const dropped of ['CC-107', 'CC-108', 'CC-112', 'CC-120', 'CC-134', 'CC-169', 'CC-174', 'CC-218', 'CC-242', 'CC-33', 'CC-176']) {
      expect(ids.has(dropped), dropped).toBe(false);
    }
  });

  it('is up to date with the generator (run `node scripts/making-of.mjs`)', () => {
    const built = buildAll() as Record<string, string>;
    for (const [name, text] of Object.entries(built)) expect(read(name), name).toBe(text);
  });

  it('passes the personal-details check', () => {
    const paths = files.map((f) => join(DIR, f));
    expect(findings(paths)).toEqual([]);
  });
});
