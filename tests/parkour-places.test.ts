// CC-133: parkour parks are pre-selected places of their own (kind: 'parkour'). Each one is tied to a real OpenStreetMap element, so nobody can add an invented park.
// The 12 to 20 street-place count, the 2-per-country cap and the cover-photo rule in the other tests are for street places and stay as they were.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { groupShown, REGIONS, shownReady, type ReadyIndexEntry } from '../src/world/places';

const DIR = 'public/assets/places';
const index = JSON.parse(readFileSync(`${DIR}/index.json`, 'utf8')) as ReadyIndexEntry[];
const parks = index.filter((p) => p.kind === 'parkour');
const MIN_AREA_M2 = 1500; // about 16 by 16 pixels at the editor's zoom 16 (2.4 m a pixel at the equator, less far north): the smallest area still seen as a patch of map
const ASSETS = readFileSync('docs/ASSETS.md', 'utf8');
const THUMBS = JSON.parse(readFileSync(`${DIR}/thumbs/index.json`, 'utf8')) as Record<string, { author: string; licence: string; source: string; shows?: string }>;

describe('parkour places (CC-133)', () => {
  it('there are at least five parks, and they are spread over regions', () => {
    expect(parks.length).toBeGreaterThanOrEqual(5);
    expect(new Set(parks.map((p) => p.region)).size).toBeGreaterThanOrEqual(2);
  });
  // Owner, 2026-11-04: a park with no free photo is removed, so seven of the twelve left; three of the five kept are big enough to see (was: at least five)
  it('at least three parks are big enough to see on the map (the small ones are flagged, not hidden)', () => { expect(parks.filter((p) => p.visible).length).toBeGreaterThanOrEqual(3); });
  it('no duplicates: slug, OpenStreetMap element and name are each used once', () => {
    for (const key of ['slug', 'osm', 'name'] as const) { const v = parks.map((p) => p[key]); expect(new Set(v).size, key).toBe(v.length); }
  });
  for (const p of parks) {
    describe(p.slug, () => {
      it('has a name, a country, a known region and an OpenStreetMap element', () => {
        expect(p.name.length).toBeGreaterThan(3); expect(p.country, 'country').toMatch(/^[A-Z][A-Za-z .'-]+$/);
        expect(REGIONS as readonly string[]).toContain(p.region);
        expect(p.osm, 'osm').toMatch(/^(way|relation)\/[0-9]+$/);
        expect(['parkour', 'enclosing']).toContain(p.mapped);
      });
      it('has a mapped area, and the visible flag says honestly whether it is big enough to see at the editor zoom', () => { expect(p.areaM2, 'areaM2').toBeGreaterThan(0); expect(p.visible).toBe(p.areaM2! >= MIN_AREA_M2); });
      it('has its place file, a clean tile and a row in docs/ASSETS.md', () => {
        expect(existsSync(`${DIR}/${p.slug}.json`)).toBe(true); expect(existsSync(`${DIR}/tiles/${p.slug}.svg`)).toBe(true);
        expect(ASSETS).toContain(p.osm!);
      });
      it('is listed, never hidden for lacking a lane; a missing lane is shown as such', () => {
        expect(shownReady(index, false, true).some((x) => x.slug === p.slug)).toBe(true);
        const file = JSON.parse(readFileSync(`${DIR}/${p.slug}.json`, 'utf8')) as { lane: { cleared?: boolean } | null };
        expect(p.path, 'index path matches the place file').toBe(file.lane?.cleared === true);
      });
      it('has a cover photo with a free licence, an author, a source link, what it shows and a row in docs/ASSETS.md (a park without a free photo is not kept)', () => {
        const th = THUMBS[p.slug];
        expect(th, 'a parkour park is kept only with a free photo').toBeDefined();
        expect(existsSync(`${DIR}/thumbs/${p.slug}.jpg`)).toBe(true);
        { expect(th.licence).toMatch(/^(CC0|CC BY(-SA)? [0-9]\.[0-9])$/); expect(th.author.length).toBeGreaterThan(0); expect(th.source).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/); expect(th.shows, 'says what the picture shows').toBeTruthy(); expect(ASSETS).toContain(p.slug + '.jpg'); }
        expect(existsSync(`public/assets/photos/${p.slug}.json`)).toBe(false);
      });
    });
  }
  it('the gallery groups street places first, then one heading per region in order, sorted by country', () => {
    const g = groupShown(shownReady(index, false, true));
    expect(g[0].items.every((p) => p.kind !== 'parkour')).toBe(true);
    const titles = g.slice(1).map((x) => x.title); expect(titles.every((t) => t.startsWith('Parkour parks: '))).toBe(true);
    const order = titles.map((t) => (REGIONS as readonly string[]).indexOf(t.slice('Parkour parks: '.length)));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const x of g.slice(1)) { const c = x.items.map((p) => p.country ?? ''); expect([...c].sort((a, b) => a.localeCompare(b))).toEqual(c); }
    expect(g.flatMap((x) => x.items).length).toBe(shownReady(index, false, true).length);
  });
  it('without parkour parks the gallery is one plain group', () => {
    const plain = groupShown(index.filter((p) => p.kind !== 'parkour'));
    expect(plain).toHaveLength(1); expect(plain[0].title).toBe('');
  });
});
