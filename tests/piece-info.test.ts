import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REAL_INFO, SECTION_ORDER, STATIC_PIECES, realInfo } from '../src/slice/piece-info';

const index = JSON.parse(readFileSync('public/assets/objects/index.json', 'utf8')) as { objects: { name: string; label: string; author: string; licence: string }[] };
const all = [...STATIC_PIECES, ...index.objects.map(realInfo)];

describe('the add browser knows every piece (CC-96)', () => {
  it('every piece has a name, words and a section', () => {
    for (const p of all) {
      expect(p.name.length, p.id).toBeGreaterThan(1);
      expect(p.does.length, p.id).toBeGreaterThan(20);
      expect(p.from.length, p.id).toBeGreaterThan(10);
      expect(SECTION_ORDER, p.id).toContain(p.section);
    }
  });
  it('ids are unique', () => { expect(new Set(all.map((p) => p.id)).size).toBe(all.length); });
  it('every real object in the index has its own words', () => {
    for (const o of index.objects) expect(REAL_INFO[o.name], o.name).toBeDefined();
  });
  it('every piece has a small and a large picture', () => {
    for (const p of all) {
      expect(existsSync(`public/assets/pieces/${p.id}.webp`), `${p.id} small`).toBe(true);
      expect(existsSync(`public/assets/pieces/${p.id}-large.webp`), `${p.id} large`).toBe(true);
    }
  });
  it('the words show no heights or sizes', () => {
    for (const p of all) expect(`${p.name} ${p.does}`, p.id).not.toMatch(/\b\d+(\.\d+)?\s?(m|cm|kg)\b/);
  });
});
