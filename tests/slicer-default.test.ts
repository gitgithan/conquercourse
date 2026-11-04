// CC-90: every prepared place opens in the World Slicer on a line and height that were proved offline on the real simulator.
// The stored answer is replayed here on the real sim; the Slicer's first state is that answer; the World Editor gets the same line and height and agrees.
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { setRoofStart, roofStartOn } from '../src/slice/slice';
import { handoverLane } from '../src/slice/slicer';
import { roleCourse } from '../src/slice/roles';
import { worldOf } from '../src/slice/slicer-core';
import { searchIdealRun } from '../src/sim/ideal';
import { CHECK_VERSION, openingFor, openingHeights, provenSummary, replayDefault, sameLine, stateAt, trusted, type DefaultsFile, type PlaceInput, type SlicerDefault } from '../src/slice/slicer-default';
import type { Ground } from '../src/world/terrain';

const file = JSON.parse(readFileSync('public/assets/places/slicer-defaults.json', 'utf8')) as DefaultsFile;
const index = JSON.parse(readFileSync('public/assets/places/index.json', 'utf8')) as { slug: string }[];
const input = (slug: string): PlaceInput => {
  const p = JSON.parse(readFileSync(`public/assets/places/${slug}.json`, 'utf8'));
  return { answer: p.answer, lat: p.lat, lon: p.lon, ground: p.ground ? ({ radius: p.radius, ...p.ground } as Ground) : null };
};
const clear = file.places.filter((d) => d.clear);
// a spread sample of at least 12 places; DEFAULTS_ALL=1 (the VM check) replays every stored clear place
const sample = process.env.DEFAULTS_ALL ? clear : clear.filter((_, i) => i % Math.max(1, Math.floor(clear.length / 12)) === 0).slice(0, 14);

// CC-200: the browser has roof start on, so the stored answers are proved under it; the same switch here makes "stored clear:true" mean what the live Slicer means.
let wasOn = false;
beforeAll(() => { wasOn = roofStartOn(); setRoofStart(true); });
afterAll(() => setRoofStart(wasOn));

describe('the stored Slicer defaults', () => {
  it('roof start is on while the stored answers are checked (the rule the live Slicer uses)', () => { expect(roofStartOn()).toBe(true); });
  it('cover every prepared place and carry the check version and a clear time', () => {
    expect(file.checkVersion).toBe(CHECK_VERSION);
    expect(file.places.map((d) => d.slug).sort()).toEqual(index.map((p) => p.slug).sort());
    for (const d of file.places) {
      expect(d.checkVersion).toBe(CHECK_VERSION);
      if (d.clear) { expect(d.clearS).toBeGreaterThan(0); expect(d.lengthM).toBeGreaterThanOrEqual(8); }
      else expect(d.note).toBeTruthy();
    }
    expect(sample.length).toBeGreaterThanOrEqual(12);
  });
  for (const d of sample) {
    it(`${d.slug}: the stored line and height replay clear on the real sim`, () => {
      const r = replayDefault(d, input(d.slug));
      expect(r.cleared).toBe(true);
      expect(Math.abs(r.lengthM - d.lengthM)).toBeLessThan(1);
    }, 120000);
    it(`${d.slug}: the Slicer opens on the stored default, and the editor gets the same line and height and agrees`, () => {
      const open = openingFor(d, { shrink: 0.2, range: 100 });
      expect(open.proven).toBe(true);
      expect(open.shrink).toBe(d.shrink);
      expect(open.cutM).toBe(d.cutM);
      expect(sameLine(open.line!, d.line)).toBe(true);
      const lane = handoverLane(provenSummary(d), open.cutM, open.shrink); // what "Open in editor" stores
      expect(lane.level).toBeCloseTo(d.cutM * d.shrink, 2);
      const { pieces } = stateAt(input(d.slug), d.shrink); // the editor builds the picked buildings at the same shrink
      const { course, length } = roleCourse(worldOf(pieces), lane, 'built');
      expect(length).toBeGreaterThanOrEqual(8);
      expect(searchIdealRun(course).cleared).toBe(true);
    }, 120000);
  }
  it('a place with no stored answer, or an untrusted one, opens on the plain start and is not called proven', () => {
    const none = openingFor(undefined, { shrink: 0.2, range: 100 });
    expect(none.proven).toBe(false); expect(none.line).toBeNull();
    const bad: SlicerDefault = { ...clear[0], checkVersion: CHECK_VERSION + 1 };
    expect(trusted(bad)).toBe(false);
  });
});

it('an adjusted height cannot reuse the stored clearance proof', () => {
  const d = { ...clear[0], cutM: 20 };
  expect(openingFor(d, { shrink: d.shrink, range: 10 }).proven).toBe(false);
});
it('the opening search covers every selectable height, including both ends, without repeats', () => {
  const heights = openingHeights(3.2, 2);
  expect(heights).toEqual([2, 1.5, 2.5, 1, 3, 0.5, 0]);
  expect(openingHeights(0, 5)).toEqual([0]);
});
