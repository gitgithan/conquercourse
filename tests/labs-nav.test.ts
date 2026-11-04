import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { screenFor } from '../src/ui/music';
import { LAB_GROUPS, LAB_LIST, TIERS } from '../src/ui/labs-series';
import { LABS, labHref, labNeighbours, labNumber } from '../src/ui/labs-nav';

// CC-118: the Labs bar lists all 12 Labs, knows which one is current, and every Lab page mounts it.
describe('labs bar', () => {
  it('lists 12 Labs in the picker order with the picker names', () => {
    expect(LABS.length).toBeGreaterThanOrEqual(12);
    const picker = readFileSync('src/ui/world-picker.ts', 'utf8');
    LABS.forEach((l, i) => expect(picker).toContain(`['${l.mode}', 'Lab ${i + 1}: ${l.name}'`));
  });
  it('keeps the first twelve numbers fixed (links in docs and films use them)', () => {
    expect(LABS.slice(0, 12).map((l) => l.mode)).toEqual(['lab-search', 'lab-optimization', 'lab-ik', 'lab-vision', 'lab-camera', 'lab-integration', 'lab-timing', 'lab-signal', 'lab-gentest', 'lab-detector', 'lab-hashing', 'lab-rl']);
  });
  it('puts every Lab in exactly one tier and one sub-header, numbers 1 to 18 fixed', () => {
    const all = LAB_GROUPS.flatMap((g) => g.modes);
    expect([...all].sort()).toEqual(LAB_LIST.map((l) => l.mode).sort());
    expect(new Set(all).size).toBe(all.length);
    expect(LAB_LIST).toHaveLength(18);
    for (const g of LAB_GROUPS) expect(TIERS.map((t) => t.id), g.id).toContain(g.tier);
    const names = (id: string) => LAB_GROUPS.find((g) => g.id === id)!.modes.map((m) => LAB_LIST.findIndex((l) => l.mode === m) + 1);
    expect(names('search-learn')).toEqual([1, 2, 12, 9]);
    expect(names('see-world')).toEqual([4, 5, 10]);
    expect(names('move-measure')).toEqual([3, 6, 7, 8]);
    expect(names('trust')).toEqual([11]);
    expect(names('photo')).toEqual([14, 15]);
    expect(names('video')).toEqual([13]);
    expect(names('idea')).toEqual([16]);
    expect(names('map')).toEqual([18]);
    expect(LAB_GROUPS.find((g) => g.id === 'run')!.modes).toEqual([]); // the honest gap
  });
  it('draws tier and sub-header headings in the bar and the picker', () => {
    expect(readFileSync('src/ui/labs-nav.ts', 'utf8')).toContain("th.className = 'group tier'");
    expect(readFileSync('src/ui/labs-nav.ts', 'utf8')).toContain("h.className = 'group sub'");
    expect(readFileSync('src/ui/world-picker.ts', 'utf8')).toContain('LAB_GROUPS');
  });
  it('numbers a Lab from 1 and gives 0 to anything else', () => {
    expect(labNumber('lab-search')).toBe(1);
    expect(labNumber('lab-rl')).toBe(12);
    expect(labNumber('dojo')).toBe(0);
  });
  it('gives previous and next, with no wrap at the ends', () => {
    expect(labNeighbours('lab-search')).toEqual({ prev: null, next: 'lab-optimization' });
    expect(labNeighbours('lab-ik')).toEqual({ prev: 'lab-optimization', next: 'lab-vision' });
    expect(labNeighbours('lab-rl').prev).toBe('lab-hashing');
    expect(labNeighbours('course')).toEqual({ prev: null, next: null });
  });
  it('has a Courses button that opens the gallery and a Sound button, and the Labs keep the Dojo music loop', () => {
    const nav = readFileSync('src/ui/labs-nav.ts', 'utf8');
    expect(nav).toContain("courses.id = 'labs-courses'");
    expect(nav).toContain('mountWorldGallery(host');
    expect(nav).toContain('soundButton()');
    expect(screenFor('lab-ik')).toBe(screenFor('dojo'));
  });
  it('links keep the labs switch on', () => expect(labHref('lab-ik')).toBe('?mode=lab-ik&labs=1&welcome=0'));
  it('every lab-* mode file mounts the bar with its own mode', () => {
    const files = readdirSync('src/modes').filter((f) => /^lab-.*\.ts$/.test(f));
    expect(files).toHaveLength(LAB_LIST.length);
    for (const f of files) {
      const mode = f.replace(/\.ts$/, '');
      expect(readFileSync(`src/modes/${f}`, 'utf8'), f).toContain(`mountLabsNav(host, "${mode}")`);
      expect(LABS.some((l) => l.mode === mode)).toBe(true);
    }
  });
});
