import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SWITCHES, SWITCH_NAMES, QUIET_WORDS } from '../src/switches';

// Every URL word the code reads must be registered with a doc line, and every registered word must be read (or be a listed link-only word).
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []; });
const READ = /(?:pageQuery\(\)|params|query|\bq|\bsp|search)\.(?:get|has|getAll)\('([A-Za-z0-9_-]+)'\)|\bflag\('([A-Za-z0-9_-]+)'\)/g;
const LINK_ONLY = new Set(['labs', 'bars']); // 'bars' is read by the editor tool in the next change; carried in a link, never read by name in src/
const read = new Set<string>();
for (const f of walk('src')) for (const m of readFileSync(f, 'utf8').matchAll(READ)) read.add((m[1] ?? m[2])!);

describe('URL switch registry', () => {
  it('every word read in src/ is registered', () => {
    expect([...read].filter((w) => !SWITCH_NAMES.has(w)).sort()).toEqual([]);
  });
  it('every registered word is read, or listed as link-only', () => {
    expect(SWITCHES.map((s) => s.name).filter((w) => !read.has(w) && !LINK_ONLY.has(w)).sort()).toEqual([]);
  });
  it('names are unique and every row has a default and a doc line', () => {
    expect(new Set(SWITCHES.map((s) => s.name)).size).toBe(SWITCHES.length);
    for (const s of SWITCHES) { expect(s.default, s.name).not.toBe(''); expect(s.doc.length, s.name).toBeGreaterThan(5); }
  });
  it('the quiet words are the seven a first visit may carry (pinned from onboarding-flags)', () => {
    expect([...QUIET_WORDS].sort()).toEqual(['cam', 'labs', 'next', 'onboarding', 'photos', 'tour', 'tourstep']);
  });
});
