import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pageQuery, pageSearch } from '../src/flags';

// The page address is read in one place (src/flags.ts). Other files take params as an argument or call pageQuery()/pageSearch().
// LOCKED lists files that still read it directly; the list may only get shorter.
const LOCKED = ['src/render/actor.ts']; // clip playback is locked by the product owner
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []; });
const READS = /new URLSearchParams\(location\.search\)|location\.search(?!\s*=[^=])/;

describe('page address reads', () => {
  it('no source file except src/flags.ts reads location.search', () => {
    const bad = walk('src').filter((f) => f !== 'src/flags.ts' && !LOCKED.includes(f) && READS.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });
  it('every LOCKED file still reads it (remove it from the list when it stops)', () => {
    for (const f of LOCKED) expect(READS.test(readFileSync(f, 'utf8')), f).toBe(true);
  });
  it('outside a browser the address is empty', () => {
    expect(pageSearch()).toBe('');
    expect(pageQuery().get('mode')).toBeNull();
  });
});
