import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { screenFor } from '../src/ui/music';
import { LAB_LIST, PIPELINES, labsOfPipeline } from '../src/ui/labs-series';
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
  it('puts every Lab in exactly one pipeline section, with a stage named by that section', () => {
    const ids = PIPELINES.map((p) => p.id);
    for (const l of LAB_LIST) {
      expect(ids, l.mode).toContain(l.pipeline);
      const p = PIPELINES.find((x) => x.id === l.pipeline)!;
      if (p.stages.length) expect(p.stages, l.mode).toContain(l.stage);
    }
    expect(PIPELINES.flatMap((p) => labsOfPipeline(p.id)).map((x) => x.n).sort((a, b) => a - b)).toEqual(LAB_LIST.map((_, i) => i + 1));
  });
  it('draws group headings in the bar and the picker', () => {
    expect(readFileSync('src/ui/labs-nav.ts', 'utf8')).toContain("h.className = 'group'");
    const picker = readFileSync('src/ui/world-picker.ts', 'utf8');
    expect(picker).toContain('labsOfPipeline');
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
