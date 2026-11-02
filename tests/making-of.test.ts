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
  it('has the four files', () => {
    expect(files.sort()).toEqual(['course-map.html', 'course-map.json', 'index.html', 'site-map.html']);
  });

  for (const f of ['index.html', 'site-map.html', 'course-map.html', 'course-map.json']) {
    it(`${f} holds nothing private`, () => {
      const t = read(f);
      for (const [name, re] of DENY) expect(t.match(re), `${f}: ${name}`).toBeNull();
    });
  }

  for (const f of ['index.html', 'site-map.html', 'course-map.html']) {
    it(`${f} has a download control and no external requests`, () => {
      const t = read(f);
      expect(t).toContain('Download this page (.html)');
      expect(t).toContain('new Blob');
      const urls = t.match(/https?:\/\/[^\s"'<>)]+/g) ?? [];
      for (const u of urls) expect(u, `${f} links ${u}`).toMatch(/openstreetmap\.org/);
      expect(t).not.toMatch(/<(script|link|img|iframe)[^>]+(src|href)=["']https?:/i);
    });
  }

  it('the index links to the live game page "How a course is made" with a relative link', () => {
    const t = read('index.html');
    expect(t).toContain('How a course is made');
    expect(t).toContain('href="../?mode=parts"');
  });

  it('the course map offers the data download too', () => {
    expect(read('course-map.html')).toContain('Download data (.json)');
  });

  it('the site map shows only Part 1: screens and journeys', () => {
    const t = read('site-map.html');
    expect(t).toContain('Play your first course');
    expect(t).not.toMatch(/Where things live|refactor safety net|known red/i);
  });

  it('the course map keeps ids, states, milestones and links, without URLs', () => {
    const d = JSON.parse(read('course-map.json'));
    expect(d.issues.length).toBeGreaterThan(100);
    const ids = new Set(d.issues.map((i: { id: string }) => i.id));
    for (const i of d.issues) {
      expect(i.id).toMatch(/^CC-\d+$/);
      expect(['Done', 'In Progress', 'Backlog', 'Canceled']).toContain(i.state);
      expect(i.milestone).toMatch(/^(M[0-5]|Later)$/);
      for (const r of [...i.dependsOn, ...i.affects]) expect(ids.has(r)).toBe(true);
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
