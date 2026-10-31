import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LABS, labHref, labNeighbours, labNumber } from '../src/ui/labs-nav';

// CC-118: the Labs bar lists all 12 Labs, knows which one is current, and every Lab page mounts it.
describe('labs bar', () => {
  it('lists 12 Labs in the picker order with the picker names', () => {
    expect(LABS).toHaveLength(12);
    const picker = readFileSync('src/ui/world-picker.ts', 'utf8');
    LABS.forEach((l, i) => expect(picker).toContain(`['${l.mode}', 'Lab ${i + 1}: ${l.name}'`));
  });
  it('numbers a Lab from 1 and gives 0 to anything else', () => {
    expect(labNumber('lab-search')).toBe(1);
    expect(labNumber('lab-rl')).toBe(12);
    expect(labNumber('dojo')).toBe(0);
  });
  it('gives previous and next, with no wrap at the ends', () => {
    expect(labNeighbours('lab-search')).toEqual({ prev: null, next: 'lab-optimization' });
    expect(labNeighbours('lab-ik')).toEqual({ prev: 'lab-optimization', next: 'lab-vision' });
    expect(labNeighbours('lab-rl')).toEqual({ prev: 'lab-hashing', next: null });
    expect(labNeighbours('course')).toEqual({ prev: null, next: null });
  });
  it('links keep the labs switch on', () => expect(labHref('lab-ik')).toBe('?mode=lab-ik&labs=1&welcome=0'));
  it('every lab-* mode file mounts the bar with its own mode', () => {
    const files = readdirSync('src/modes').filter((f) => /^lab-.*\.ts$/.test(f));
    expect(files).toHaveLength(12);
    for (const f of files) {
      const mode = f.replace(/\.ts$/, '');
      expect(readFileSync(`src/modes/${f}`, 'utf8'), f).toContain(`mountLabsNav(host, "${mode}")`);
      expect(LABS.some((l) => l.mode === mode)).toBe(true);
    }
  });
});
