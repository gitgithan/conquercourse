import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { changeWords, closeGap, dragHandle, editable, handlesOf, lockedPlatforms, MIN_BAR_GAP, MIN_WIDTH, splitDeck } from '../src/slice/ground-graph';

const course = (extra: Partial<CourseData> = {}): CourseData => ({
  version: 1, name: 't', startX: 0, finishX: 40, jumpSpeed: 4.5,
  terrain: { waterY: -2, platforms: [{ x0: -10, x1: 10, top: 0 }, { x0: 14, x1: 24, top: 0.5 }, { x0: 30, x1: 50, top: 0 }] },
  ...extra,
});
const find = (c: CourseData, id: string) => handlesOf(c).find((h) => h.id === id)!;

describe('ground graph handles', () => {
  it('gives every flat deck a top and two edges, and every bar a handle', () => {
    const c = course({ holds: [{ x: 20, y: 3 }, { x: 24, y: 3 }] });
    const ids = handlesOf(c).map((h) => h.id);
    expect(ids).toEqual(expect.arrayContaining(['top:0', 'edge-left:0', 'edge-right:0', 'top:2', 'bar:0', 'bar:1']));
    expect(ids.length).toBe(3 * 3 + 2);
  });
  it('leaves curved tops, trampoline beds, the wall, the machine and the rope anchor alone', () => {
    const c = course({ wall: { x0: 12 }, trebuchet: { x: 40 } });
    c.terrain.platforms.push({ x0: 60, x1: 70, top: 0, bouncy: true });
    const locked = lockedPlatforms(c);
    expect(locked.has(1)).toBe(true); // the wall stands on it
    expect(locked.has(2)).toBe(true); // the trebuchet stands on it
    expect(locked.has(3)).toBe(true); // a bed
    expect(locked.has(0)).toBe(false);
    expect(handlesOf(c).some((h) => h.index === 1)).toBe(false);
  });
  it('does not edit a coaster', () => {
    expect(editable(course({ track: { points: [] } as never }))).toBe(false);
  });
});

describe('dragging', () => {
  it('raising a deck snaps to a tenth of a metre and clamps', () => {
    const c = course();
    expect(dragHandle(c, find(c, 'top:1'), 19, 1.234).course.terrain.platforms[1].top).toBe(1.2);
    expect(dragHandle(c, find(c, 'top:1'), 19, 999).course.terrain.platforms[1].top).toBe(30);
    expect(dragHandle(c, find(c, 'top:1'), 19, -999).course.terrain.platforms[1].top).toBe(-10);
  });
  it('never changes the course it was given', () => {
    const c = course(), copy = JSON.stringify(c);
    dragHandle(c, find(c, 'top:1'), 19, 3);
    expect(JSON.stringify(c)).toBe(copy);
  });
  it('widening a gap moves one edge; decks never overlap and never get thinner than a person', () => {
    const c = course();
    const wide = dragHandle(c, find(c, 'edge-right:0'), 12, 0).course.terrain.platforms; // up to the next deck's edge at 14
    expect(wide[0].x1).toBe(12);
    expect(dragHandle(c, find(c, 'edge-right:0'), 99, 0).course.terrain.platforms[0].x1).toBe(14); // cannot pass the next deck
    expect(dragHandle(c, find(c, 'edge-left:1'), 2, 0).course.terrain.platforms[1].x0).toBe(10); // cannot cross the previous deck
    const thin = dragHandle(c, find(c, 'edge-left:1'), 99, 0).course.terrain.platforms[1];
    expect(thin.x1 - thin.x0).toBeGreaterThanOrEqual(MIN_WIDTH - 1e-9);
  });
  it('keeps the start and the finish on the ground', () => {
    const c = course();
    expect(dragHandle(c, find(c, 'edge-left:0'), 5, 0).course.terrain.platforms[0].x0).toBeLessThanOrEqual(c.startX - 0.5 + 1e-9);
    expect(dragHandle(c, find(c, 'edge-right:2'), 31, 0).course.terrain.platforms[2].x1).toBeGreaterThanOrEqual(c.finishX + 0.5 - 1e-9);
  });
  it('moves a bar in both directions, keeps bars apart and above the ground line', () => {
    const c = course({ holds: [{ x: 20, y: 3 }, { x: 24, y: 3 }] });
    const moved = dragHandle(c, find(c, 'bar:0'), 21.1, 4.04).course.holds!;
    expect(moved[0]).toEqual({ x: 21, y: 4 });
    expect(dragHandle(c, find(c, 'bar:0'), 99, 3).course.holds![0].x).toBe(24 - MIN_BAR_GAP);
    expect(dragHandle(c, find(c, 'bar:1'), 24, -5).course.holds![1].y).toBe(1);
  });
  it('drops a stored proof and the drawn real objects, and says so', () => {
    const c = course({ plan: { jumpXs: [], releaseAfter: 0, bouncePress: 0 }, scene: [{ url: '/a.glb', x: 0, y: 0, z: 0, rotY: 0, scale: 1 }] });
    const r = dragHandle(c, find(c, 'top:0'), 0, 1);
    expect(r.course.plan).toBeUndefined();
    expect(r.course.scene).toBeUndefined();
    expect(r.note).toMatch(/plain blocks/);
    expect(dragHandle(course(), find(course(), 'top:0'), 0, 1).note).toBeUndefined();
  });
});

describe('plain words', () => {
  it('says what moved, in metres', () => {
    const a = course({ holds: [{ x: 20, y: 3 }] });
    let b = dragHandle(a, find(a, 'top:1'), 19, 1.5).course;
    b = dragHandle(b, find(b, 'edge-right:0'), 12, 0).course;
    b = dragHandle(b, find(b, 'bar:0'), 19, 3).course;
    const w = changeWords(a, b).join(' ');
    expect(w).toMatch(/Deck 2: raise it 1 m/);
    expect(w).toMatch(/Gap 1: wider, 4\.0 m to 2\.0 m|Gap 1: narrower/);
    expect(w).toMatch(/Bar 1: 1 m closer to the start/);
    expect(changeWords(a, a)).toEqual([]);
  });
});

describe('double-click edits', () => {
  it('cuts a gap into a deck and keeps the rest', () => {
    const c = course();
    const r = splitDeck(c, 2, 45, 2)!;
    expect(r.course.terrain.platforms.length).toBe(4);
    const [a, b] = [r.course.terrain.platforms[2], r.course.terrain.platforms[3]];
    expect(a.x1).toBe(45); expect(b.x0).toBe(47); expect(b.x1).toBe(50); expect(b.top).toBe(0);
  });
  it('refuses a cut that would leave a sliver, or take the ground from under the finish', () => {
    const c = course();
    expect(splitDeck(c, 2, 30.2, 2)).toBeNull(); // sliver behind the cut
    expect(splitDeck(c, 2, 39.5, 2)).toBeNull(); // the finish is at 40
    expect(splitDeck(c, 0, -0.2, 2)).toBeNull(); // the start is at 0
    const w = course({ wall: { x0: 12 } });
    expect(splitDeck(w, 1, 18, 2)).toBeNull(); // a locked deck
  });
  it('closes a gap by taking the edge out to the neighbour, and does nothing when there is no gap', () => {
    const c = course();
    expect(closeGap(c, find(c, 'edge-right:0'))!.course.terrain.platforms[0].x1).toBe(14);
    expect(closeGap(c, find(c, 'edge-left:2'))!.course.terrain.platforms[2].x0).toBe(24);
    const touching = course(); touching.terrain.platforms[1].x0 = 10;
    expect(closeGap(touching, find(touching, 'edge-right:0'))).toBeNull();
    expect(closeGap(c, find(c, 'top:0'))).toBeNull();
  });
});
