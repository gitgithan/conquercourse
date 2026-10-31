// CC-90: street photos along a lane: coverage words, the switch, and the spread of thumbnails.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { coverageLine, lanePhotos, spread, streetPhotosOn } from '../src/world/street-photos';
import type { AllowList } from '../src/world/live-photos';

const list = (s: string) => JSON.parse(readFileSync(`public/assets/photos-live/${s}.json`, 'utf8')) as AllowList;
const place = (s: string) => JSON.parse(readFileSync(`public/assets/places/${s}.json`, 'utf8')) as { lat: number; lon: number; lane: { line: [number, number, number, number] } };

describe('street photos', () => {
  it('?streetphotos=0 turns them off, anything else leaves them on', () => {
    expect(streetPhotosOn(new URLSearchParams('streetphotos=0'))).toBe(false);
    expect(streetPhotosOn(new URLSearchParams(''))).toBe(true);
  });
  it('the index names exactly the places that have an allow-list', () => {
    const idx = JSON.parse(readFileSync('public/assets/photos-live/index.json', 'utf8')) as { places: Record<string, number> };
    for (const [slug, n] of Object.entries(idx.places)) expect(list(slug).photos.length).toBe(n);
  });
  it('a line far from every photo has none, and says so in plain words', () => {
    const a = list('edinburgh-old-town'), p = place('edinburgh-old-town');
    const v = lanePhotos(a.photos, p, [5000, 5000, 5100, 5000]);
    expect(v.coverage).toBe('none'); expect(v.photos).toHaveLength(0);
    expect(coverageLine(v, true)).toMatch(/none here yet/);
  });
  it('a place without a list says so, and mentions custom places', () => {
    expect(coverageLine(null, false)).toMatch(/place you cut yourself has none/);
  });
  it('the stored lane of each place with photos gets photos, ordered along the lane', () => {
    for (const s of ['edinburgh-old-town', 'montmartre-paris', 'eixample-barcelona']) {
      const v = lanePhotos(list(s).photos, place(s), place(s).lane.line);
      expect(['whole', 'part', 'none']).toContain(v.coverage);
      for (let i = 1; i < v.photos.length; i++) expect(v.photos[i].alongM).toBeGreaterThanOrEqual(v.photos[i - 1].alongM);
    }
  });
  it('spread keeps the ends and never more than the limit', () => {
    const xs = Array.from({ length: 20 }, (_, i) => i), s = spread(xs, 6);
    expect(s).toHaveLength(6); expect(s[0]).toBe(0); expect(s[5]).toBe(19);
  });
});
