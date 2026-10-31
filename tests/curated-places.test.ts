// CC-90: the place list is short and spread out: 12 to 16 places, at most 2 per country, each with a street-photo list that has photos.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
const idx = JSON.parse(readFileSync('public/assets/places/index.json', 'utf8'));
const entries: any[] = Array.isArray(idx) ? idx : (idx.places ?? idx.ready ?? []);
const listed = entries.filter((e) => e.listed === true);
describe('curated places (CC-90)', () => {
  it('lists 12 to 16 places', () => { expect(listed.length).toBeGreaterThanOrEqual(12); expect(listed.length).toBeLessThanOrEqual(16); });
  it('at most 2 per country', () => {
    const n: Record<string, number> = {}; for (const e of listed) n[e.country] = (n[e.country] ?? 0) + 1;
    for (const [c, k] of Object.entries(n)) expect(k, c).toBeLessThanOrEqual(2);
    expect(Object.keys(n).length).toBeGreaterThanOrEqual(10);
  });
  it('every listed place has a street-photo list with photos', () => {
    for (const e of listed) { const f = `public/assets/photos-live/${e.slug}.json`; expect(existsSync(f), e.slug).toBe(true); expect(JSON.parse(readFileSync(f, 'utf8')).photos.length, e.slug).toBeGreaterThan(0); }
  });
  it('the unlisted places keep their files', () => { expect(entries.length).toBeGreaterThan(listed.length); for (const e of entries) expect(existsSync(`public/assets/places/${e.slug}.json`), e.slug).toBe(true); });
});
