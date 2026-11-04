import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { welcomeOn } from '../src/ui/welcome-flags';

// CC-133: the README's play link goes straight into the Training course, with no front door.
const readme = readFileSync('README.md', 'utf8');
const link = /\((https:\/\/conquercourse\.pages\.dev\/\?course=[^)]+)\)/.exec(readme)?.[1];

describe('README play link', () => {
  it('is there and names the Training course', () => {
    expect(link).toBeTruthy();
    const params = new URL(link!).searchParams;
    expect(params.get('course')).toBe('/assets/demo/training.course.json');
    expect(existsSync(`public${params.get('course')}`)).toBe(true);
  });
  it('skips the welcome screen for a real visitor and passes the course loader rule', () => {
    const params = new URL(link!).searchParams;
    expect(welcomeOn({ params, automated: false })).toBe(false);
    expect(/^\/assets\/[\w./-]+\.json$/.test(params.get('course')!)).toBe(true);
  });
});
