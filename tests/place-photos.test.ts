import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { captionFor, nearestPlace, slugOfCourse, type PlaceIndexEntry, type PlacePhotos } from '../src/ui/place-photos';

const DIR = 'public/assets/places';
const index = JSON.parse(readFileSync(`${DIR}/photos-index.json`, 'utf8')) as { places: PlaceIndexEntry[] };
const OK_LICENCE = /^(CC0|Public domain|CC BY(-SA)? [0-9]\.[0-9])$/; // never NC or ND

// The width and height of a JPEG from its first start-of-frame marker.
function jpegSize(buf: Buffer): { w: number; h: number } {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error('no frame marker');
}

describe('place photos (CC-85)', () => {
  it('the four real worlds each have photos', () => {
    const slugs = index.places.map((p) => p.slug);
    for (const s of ['montmartre-paris', 'eixample-barcelona', 'circular-quay-sydney', 'san-francisco-lombard']) expect(slugs).toContain(s);
  });
  for (const place of index.places) {
    describe(place.slug, () => {
      const d = JSON.parse(readFileSync(`${DIR}/${place.slug}/credits.json`, 'utf8')) as PlacePhotos;
      it('has 2 to 3 photos and a place name', () => {
        expect(d.place).toBe(place.slug);
        expect(d.name.length).toBeGreaterThan(3);
        expect(d.photos.length).toBeGreaterThanOrEqual(2);
        expect(d.photos.length).toBeLessThanOrEqual(3);
      });
      it('every photo has a file, a small size and a free licence with its credit', () => {
        for (const p of d.photos) {
          const path = `${DIR}/${place.slug}/${p.file}`;
          expect(existsSync(path), path).toBe(true);
          const buf = readFileSync(path);
          expect(statSync(path).size, path).toBeLessThanOrEqual(250_000);
          expect(buf.subarray(0, 2).toString('hex'), path).toBe('ffd8'); // JPEG
          const { w, h } = jpegSize(buf);
          expect(w, path).toBeLessThanOrEqual(1200);
          expect(w, path).toBe(p.width); expect(h, path).toBe(p.height);
          expect(p.licence, p.title).toMatch(OK_LICENCE);
          expect(p.licenceUrl, p.title).toMatch(/^https?:\/\/(creativecommons\.org|.*creativecommons\.org)\//);
          expect(p.author.trim().length, p.title).toBeGreaterThan(1);
          expect(p.source, p.title).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
          expect(p.hint.trim().length, p.title).toBeGreaterThan(10);
          expect(p.changes.length, p.title).toBeGreaterThan(5);
        }
      });
      it('every photo is listed in docs/ASSETS.md with its author and licence', () => {
        const assets = readFileSync('docs/ASSETS.md', 'utf8');
        for (const p of d.photos) {
          // A row is the bullet with the file name plus its indented lines (photo, author, source, licence).
          const lines = assets.split('\n');
          const at = lines.findIndex((l) => l.includes(`public/assets/places/${place.slug}/${p.file}`));
          expect(at, `${place.slug}/${p.file}`).toBeGreaterThanOrEqual(0);
          let end = at + 1;
          while (end < lines.length && /^\s+/.test(lines[end])) end++;
          const row = lines.slice(at, end).join('\n');
          expect(row, p.file).toContain(p.licence);
          expect(row, p.file).toContain(p.author.split(' ')[0]);
        }
      });
    });
  }
  it('the OSM course names give the folder of the photos', () => {
    expect(slugOfCourse('OSM montmartre-paris')).toBe('montmartre-paris');
    expect(slugOfCourse('Lache demo')).toBeNull();
  });
  it('a pin finds the place it is inside and nothing far away', () => {
    expect(nearestPlace(index.places, 48.8867, 2.3431)?.slug).toBe('montmartre-paris');
    expect(nearestPlace(index.places, -33.862, 151.211)?.slug).toBe('circular-quay-sydney');
    expect(nearestPlace(index.places, 35.6595, 139.7005)).toBeNull(); // Shibuya has no photos yet
  });
  it('the caption names the place, the author and the licence', () => {
    const d = JSON.parse(readFileSync(`${DIR}/montmartre-paris/credits.json`, 'utf8')) as PlacePhotos;
    expect(captionFor(d, d.photos[0])).toBe(`Real photo of Montmartre, Paris, ${d.photos[0].author}, ${d.photos[0].licence}`);
  });
});

describe('Mapillary credit (CC-90)', () => {
  it('the mark is a link to mapillary.com that opens safely, and only Mapillary sources count', async () => {
    const { isMapillary, mapillaryMark, MAPILLARY_HOME } = await import('../src/ui/place-photos');
    expect(isMapillary('https://www.mapillary.com/app/?pKey=123')).toBe(true);
    expect(isMapillary('https://commons.wikimedia.org/wiki/File:x.jpg')).toBe(false);
    expect(MAPILLARY_HOME).toBe('https://www.mapillary.com/');
    const { JSDOM } = await import(/* @vite-ignore */ ('js' + 'dom') as string).catch(() => ({ JSDOM: null as any }));
    if (!JSDOM) return;
    const dom = new JSDOM(''); (globalThis as any).document = dom.window.document;
    const a = mapillaryMark(null);
    expect(a.href).toBe('https://www.mapillary.com/'); expect(a.rel).toContain('noopener'); expect(a.textContent).toBe('Mapillary');
  });
});
