import { describe, expect, it } from 'vitest';
import { buildingLook, colourTag, landKind, roadLook, seeded, skinFromQuery } from '../src/world/skin';
import { shownReady, type ReadyIndexEntry } from '../src/world/places';

describe('skin rules from OpenStreetMap tags (CC-178)', () => {
  it('reads colour names and hex, ignores nonsense', () => {
    expect(colourTag('#ABC')).toBe('#aabbcc');
    expect(colourTag('Red')).toBe('#b5523f');
    expect(colourTag('sparkly')).toBeNull();
    expect(colourTag(undefined)).toBeNull();
  });
  it('a building tag colour beats material beats kind', () => {
    expect(buildingLook({ building: 'house', 'building:colour': '#112233' }).wall).toBe('#112233');
    expect(buildingLook({ building: 'house', 'building:material': 'brick' }).pattern).toBe('brick');
    expect(buildingLook({ building: 'church' }).wall).not.toBe(buildingLook({ building: 'garage' }).wall);
    expect(buildingLook({ building: 'yes', 'roof:colour': 'red' }).roof).toBe('#b5523f');
  });
  it('knows grass, water, wood and ignores plain buildings', () => {
    expect(landKind({ leisure: 'park' })).toBe('grass');
    expect(landKind({ natural: 'water' })).toBe('water');
    expect(landKind({ landuse: 'forest' })).toBe('wood');
    expect(landKind({ building: 'yes' })).toBeNull();
  });
  it('roads get a width and a colour; steps are light and narrow', () => {
    expect(roadLook({ highway: 'primary' })!.width).toBeGreaterThan(roadLook({ highway: 'footway' })!.width);
    expect(roadLook({ highway: 'steps' })!.colour).toBe('#efe9d6');
    expect(roadLook({ highway: 'residential', width: '12' })!.width).toBe(12);
    expect(roadLook({ building: 'yes' })).toBeNull();
  });
  it('the random numbers repeat, and ?skin= is read', () => {
    const a = seeded(3), b = seeded(3); expect([a(), a()]).toEqual([b(), b()]);
    expect(skinFromQuery(new URLSearchParams('skin=full'))).toBe('full');
    expect(skinFromQuery(new URLSearchParams('skin=wild'), 'tags')).toBe('tags');
  });
});

describe('ready list filter (CC-178)', () => {
  const e = (slug: string, listed?: boolean): ReadyIndexEntry => ({ slug, name: slug, lat: 0, lon: 0, radius: 120, hill_m: 0, buildings: 1, bytes: 1, blurb: '', ...(listed === undefined ? {} : { listed }) });
  const index = [e('a', true), e('b', false), e('c')];
  it('shows only listed places by default, everything with ?places=all', () => {
    expect(shownReady(index, false).map((p) => p.slug)).toEqual(['a', 'c']);
    expect(shownReady(index, true).map((p) => p.slug)).toEqual(['a', 'b', 'c']);
  });
});
