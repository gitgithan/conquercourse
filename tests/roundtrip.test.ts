import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData, CourseSource } from '../src/course/course';
import { searchIdealRun } from '../src/sim/ideal';
import { holdsOf, isHold } from '../src/slice/holds-world';
import { laneToCourse, sliceProfile } from '../src/slice/slice';
import { checkpointFor, copySourceFrom, EDIT_KEY, handoffCourse, piecesFromSource, readHandoff } from '../src/slice/roundtrip';
import { worldSamples } from '../src/slice/world';

// What the editor does to make a course from a source (the lane cut through the ground pieces, the bars hung in it).
function courseFrom(src: CourseSource): CourseData {
  const ps = piecesFromSource(src.pieces);
  const lane = { angle: src.angle, offset: src.offset, level: src.level };
  const pr = sliceProfile(worldSamples(ps.filter((p) => !isHold(p))), { x: 0, z: 0 }, lane);
  return { ...laneToCourse({ cells: [...pr.cells], length: pr.length, origin: pr.origin }, 'My world', holdsOf(ps, lane)), source: src };
}
const SOURCE: CourseSource = {
  kind: 'editor', angle: 0, offset: 0, level: 0, floor: 'lava',
  pieces: [
    { src: 'box:8:0.5:2', x: 0, z: 0, y: 0, yaw: 0, scale: 1 },
    { src: 'box:8:0.5:2', x: 17, z: 0, y: 0, yaw: 0, scale: 1 },
    { src: 'hold:bar', x: 6.5, z: 0, y: 2.86, yaw: 0, scale: 1 },
    { src: 'hold:bar', x: 10, z: 0, y: 2.86, yaw: 0, scale: 1 },
  ],
};
const demo = (name: string): CourseData => JSON.parse(readFileSync(`public/assets/demo/${name}.course.json`, 'utf8')) as CourseData;

describe('the round trip between the Course and the editor', () => {
  it('an unedited editor course comes back byte for byte (course -> handoff -> pieces -> course)', () => {
    const first = courseFrom(SOURCE);
    const handoff = handoffCourse(first);
    expect(handoff.source).toEqual(SOURCE);
    const again = courseFrom(handoff.source!);
    expect(JSON.stringify(again)).toBe(JSON.stringify(first));
  });
  it('the handoff leaves out the baked scene, the plan and the routes (the editor makes them again)', () => {
    const c = { ...courseFrom(SOURCE), scene: [{ x: 1, y: 0, z: 0, rotY: 0, scale: 1 }], plan: { jumpXs: [1] } as never, routes: [] };
    const h = handoffCourse(c);
    expect(h.scene).toBeUndefined();
    expect(h.plan).toBeUndefined();
    expect(h.routes).toBeUndefined();
    expect(h.terrain).toEqual(c.terrain);
  });
  it('a course without a source becomes an editable copy with boxes and bars', () => {
    const lache = demo('lache');
    const src = copySourceFrom(lache);
    expect(src.kind).toBe('copy');
    expect(src.pieces.filter((p) => p.src === 'hold:bar')).toHaveLength(lache.holds!.length);
    expect(src.pieces.filter((p) => p.src.startsWith('box:')).length).toBeGreaterThanOrEqual(2);
    expect(handoffCourse(lache).source?.kind).toBe('copy');
  });
  it('the copy of the lache demo is still a course the simulator can clear', () => {
    expect(searchIdealRun(courseFrom(copySourceFrom(demo('lache')))).cleared).toBe(true);
  }, 240000);
  it('a stepped top becomes columns of equal height (a copy of a cup stack keeps its steps, but the lane cuts steep faces into ramps, so it may not clear)', () => {
    const src = copySourceFrom(demo('stack'));
    const boxes = src.pieces.filter((p) => p.src.startsWith('box:'));
    expect(boxes.length).toBeGreaterThan(8);
    const heights = new Set(boxes.map((p) => p.src.split(':')[2]));
    expect(heights.size).toBeGreaterThan(4); // several step heights, not one flat box
  });
  it('the handoff is read back only when it is whole', () => {
    const store = (v: string | null) => ({ getItem: (k: string) => (k === EDIT_KEY ? v : null) });
    const h = { course: handoffCourse(courseFrom(SOURCE)), retryX: 3, zone: 'gap', x: 9, facing: 1, falls: 2, intent: 'easier' };
    expect(readHandoff(store(JSON.stringify(h)))).toEqual(h);
    expect(readHandoff(store(null))).toBeNull();
    expect(readHandoff(store('{"course":{}}'))).toBeNull();
    expect(readHandoff(store('not json'))).toBeNull();
  });
  it('the checkpoint for an obstacle is its own, or the start', () => {
    const c: CourseData = { ...courseFrom(SOURCE), checkpoints: [{ id: 'gap', x: 12 }] };
    expect(checkpointFor(c, 'gap')).toBe(12);
    expect(checkpointFor(c, 'rope')).toBe(c.startX);
    expect(checkpointFor(c, null)).toBe(c.startX);
  });
});
