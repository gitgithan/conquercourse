import { describe, expect, it } from 'vitest';
import { buildCourse, findScale, fitPrimitives, kindOf, proveCourse, type ParkObject } from '../src/park/fit';
import { readFileSync } from 'node:fs';

const o = (id: number, phrase: string, box: [number, number, number, number], score = 0.9): ParkObject => ({ id, phrase, box, score });

describe('fit: scale', () => {
  it('a person 350 px tall means 200 px per metre', () => {
    const s = findScale([o(1, 'person', [0, 0, 100, 350])]);
    expect(s?.pxPerM).toBeCloseTo(200);
    expect(s?.source).toBe('body-height');
  });
  it('a bench 360 px wide means 200 px per metre, with a wider doubt', () => {
    const s = findScale([o(1, 'bench', [0, 0, 360, 100])]);
    expect(s?.pxPerM).toBeCloseTo(200);
    expect(s?.uncertainty).toBeGreaterThan(0.12);
  });
  it('no reference: typical sizes, and it says so', () => {
    expect(findScale([o(1, 'wall', [0, 0, 500, 100])])).toBeNull();
    const [p] = fitPrimitives([o(1, 'low wall', [0, 0, 500, 100])]);
    expect(p.height).toBe(0.9);
    expect(p.scale.source).toBe('typical-size');
    expect(p.scale.uncertainty).toBeGreaterThan(0.2);
  });
});

describe('fit: primitives', () => {
  it('maps synonyms and orders left to right', () => {
    expect(kindOf('stairs')).toBe('steps');
    expect(kindOf('handrail')).toBe('rail');
    expect(kindOf('xyz')).toBeNull();
    const ps = fitPrimitives([o(1, 'rail', [500, 0, 600, 50]), o(2, 'bench', [0, 0, 100, 50])]);
    expect(ps.map((p) => p.kind)).toEqual(['bench', 'rail']);
  });
  it('steps: risers from the box height at a known scale', () => {
    const ps = fitPrimitives([o(1, 'person', [0, 0, 50, 350]), o(2, 'steps', [200, 0, 800, 120])]);
    expect(ps[0].risers).toBe(4); // 120 px = 0.6 m = 4 risers of 0.17 m
    expect(ps[0].height).toBeCloseTo(0.68);
  });
});

describe('fit: course', () => {
  it('platforms are spaced about 7 m apart with water between', () => {
    const c = buildCourse(fitPrimitives([o(1, 'bench', [0, 0, 100, 50]), o(2, 'ledge', [300, 0, 400, 50])]));
    const ps = c.terrain.platforms;
    expect(ps.length).toBe(4);
    expect(ps[2].x0 - ps[1].x0).toBeCloseTo(7, 0);
    expect(c.terrain.platforms[1].top).toBe(0.45);
    expect(c.finishX).toBeGreaterThan(ps[3].x0);
  });
  it('a bench, a wall and a rail course is proved clearable by the simulator', () => {
    const p = proveCourse(fitPrimitives([o(1, 'bench', [0, 0, 100, 50]), o(2, 'wall', [200, 0, 300, 50]), o(3, 'rail', [400, 0, 500, 50])]));
    expect(p.cleared).toBe(true);
    expect(p.windows.length).toBe(4);
  });
  for (const photo of ['park01', 'park02', 'park03', 'park06', 'park07']) {
    it(`${photo}: the saved detections fit and clear`, () => {
      const data = JSON.parse(readFileSync(`public/assets/park/${photo}.objects.json`, 'utf8'));
      const p = proveCourse(fitPrimitives(data.objects));
      expect(p.cleared).toBe(true);
    });
  }
});

describe('photo skins', () => {
  const prims = fitPrimitives([o(1, 'wall', [100, 100, 300, 250]), o(2, 'bench', [400, 150, 600, 250])]);
  it('paint the part of the photo each obstacle was in, and only when a photo is given', () => {
    const withPhoto = buildCourse(prims, 'x', 1, '/p.jpg').terrain.platforms.filter((p) => p.skin);
    expect(withPhoto.map((p) => p.skin!.crop)).toEqual([[100, 100, 300, 250], [400, 150, 600, 250]]);
    expect(withPhoto.every((p) => p.skin!.image === '/p.jpg')).toBe(true);
    expect(buildCourse(prims, 'x').terrain.platforms.some((p) => p.skin)).toBe(false);
  });
  it('change looks only: the platforms are the same with or without skins', () => {
    const strip = (c: ReturnType<typeof buildCourse>) => c.terrain.platforms.map(({ x0, x1, top }) => [x0, x1, top]);
    expect(strip(buildCourse(prims, 'x', 1, '/p.jpg'))).toEqual(strip(buildCourse(prims, 'x', 1)));
  });
});
