import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { shownReady, type ReadyIndexEntry } from '../src/world/places';

const DIR = 'public/assets/places';
const index = JSON.parse(readFileSync(`${DIR}/index.json`, 'utf8')) as ReadyIndexEntry[];
const thumbs = JSON.parse(readFileSync(`${DIR}/thumbs/index.json`, 'utf8')) as Record<string, { author: string; licence: string; source: string }>;

describe('place gallery pictures', () => {
  it('every thumbnail is a real place, under 40 KB, with a free licence and an author', () => {
    for (const [slug, c] of Object.entries(thumbs)) {
      expect(index.some((p) => p.slug === slug), slug).toBe(true);
      expect(statSync(`${DIR}/thumbs/${slug}.jpg`).size, slug).toBeLessThanOrEqual(40 * 1024);
      expect(c.licence).toMatch(/^(CC0|Public domain|CC BY(-SA)? [0-9]\.[0-9])$/);
      expect(c.author.length).toBeGreaterThan(0);
    }
  });
  it('every shown place has a picture: a photo or a clean tile, and tiles stay small', () => {
    for (const p of shownReady(index, true)) {
      expect(existsSync(`${DIR}/tiles/${p.slug}.svg`), p.slug).toBe(true);
      expect(statSync(`${DIR}/tiles/${p.slug}.svg`).size, p.slug).toBeLessThanOrEqual(40 * 1024);
    }
  });
  it('every listed place has a cover photo with a credit (CC-212)', () => {
    for (const p of shownReady(index, false)) {
      expect(thumbs[p.slug], p.slug).toBeDefined();
      expect(existsSync(`${DIR}/thumbs/${p.slug}.jpg`), p.slug).toBe(true);
    }
  });
  it('the default gallery shows only listed places', () => {
    expect(shownReady(index, false).every((p) => p.listed !== false)).toBe(true);
  });
});
