import { describe, expect, it } from 'vitest';
import { MAX_SHARE, markOn, boxFromCorners, clampBox, cleanPeople, coversPerson, markProblem, minSide, nudge, photoToScreen, screenToPhoto, sizeProblem, startBox, type Box } from '../src/slice/markbox';
import { SWITCHES } from '../src/switches';
import { readFileSync } from 'node:fs';

const W = 1280, H = 960;
describe('mark it yourself: box math (CC-133)', () => {
  it('maps a screen point to photo pixels and back', () => {
    const rect = { left: 100, top: 50, width: 640, height: 480 }; // the photo shown at half size
    expect(screenToPhoto({ x: 420, y: 290 }, rect, W, H)).toEqual({ x: 640, y: 480 });
    expect(screenToPhoto({ x: 0, y: 9999 }, rect, W, H)).toEqual({ x: 0, y: H }); // held inside the photo
    const s = photoToScreen([320, 240, 640, 480], rect, W, H);
    expect(s).toEqual({ left: 160, top: 120, width: 160, height: 120 });
  });
  it('makes a box from two corners in any order and clamps it', () => {
    expect(boxFromCorners({ x: 500, y: 400 }, { x: 100.4, y: 50.6 }, W, H)).toEqual([100, 51, 500, 400]);
    expect(boxFromCorners({ x: -20, y: -5 }, { x: W + 30, y: H + 9 }, W, H)).toEqual([0, 0, W, H]);
  });
  it('clampBox keeps size and moves it inside; a too-big box is cut to the photo', () => {
    expect(clampBox([1200, 900, 1400, 1000], W, H)).toEqual([1080, 860, 1280, 960]);
    expect(clampBox([-50, -50, 100, 100], W, H)).toEqual([0, 0, 150, 150]);
    expect(clampBox([-10, -10, 3000, 3000], W, H)).toEqual([0, 0, W, H]);
  });
  it('has a minimum size: 24 px, or 3 percent of the shorter side', () => {
    expect(minSide(1280, 960)).toBe(29); expect(minSide(400, 300)).toBe(24);
    expect(sizeProblem([10, 10, 30, 200], W, H)).toMatch(/too small/);
    expect(sizeProblem([10, 10, 100, 100], W, H)).toBe('');
  });
  it('has a maximum share of the photo', () => {
    const big: Box = [0, 0, W, Math.ceil(MAX_SHARE * H) + 5];
    expect(sizeProblem(big, W, H)).toMatch(/almost the whole photo/);
    expect(sizeProblem([0, 0, W, Math.floor(MAX_SHARE * H) - 5], W, H)).toBe('');
  });
  it('arrow keys move the box, shift resizes, and neither leaves the photo or goes below the minimum', () => {
    const b = startBox(W, H);
    const moved = nudge(b, 'ArrowRight', false, W, H);
    expect(moved[0]).toBeGreaterThan(b[0]); expect(moved[2] - moved[0]).toBe(b[2] - b[0]);
    expect(nudge([0, 0, 100, 100], 'ArrowLeft', false, W, H)).toEqual([0, 0, 100, 100]);
    let r: Box = [0, 0, 40, 40];
    for (let i = 0; i < 20; i++) r = nudge(r, 'ArrowLeft', true, W, H);
    expect(r[2] - r[0]).toBe(minSide(W, H));
    for (let i = 0; i < 200; i++) r = nudge(r, 'ArrowDown', true, W, H);
    expect(r[3]).toBe(H);
  });
  it('rejects a box that covers a person or a face, and passes one that does not', () => {
    const person: Box = [500, 100, 600, 400];
    expect(coversPerson([480, 90, 620, 420], [person])).toBe(true); // person fully inside
    expect(coversPerson([0, 0, 1000, 1000], [person])).toBe(true); // box round a person
    expect(coversPerson([550, 300, 560, 310], [person])).toBe(true); // a box inside a person is mostly person
    expect(coversPerson([100, 100, 400, 300], [person])).toBe(false); // apart
    expect(coversPerson([590, 100, 900, 400], [person])).toBe(false); // grazes the edge (10 percent of the person)
    expect(markProblem([480, 90, 620, 420], W, H, [person], 'bar')).toMatch(/person/);
    expect(markProblem([100, 100, 400, 300], W, H, [person], 'bar')).toBe('');
    expect(markProblem([100, 100, 400, 300], W, H, [], 'Bar<')).toMatch(/few letters/);
    expect(markProblem([100, 100, 400, 300], W, H, [], 'other')).toBe('');
  });
  it('cleans person boxes from the finder', () => {
    expect(cleanPeople([[1, 2, 30, 40], [5, 5, 5, 9], 'x', [0, 0, 'a', 1], [-5, -5, 20, 20]], 100, 100)).toEqual([[1, 2, 30, 40], [0, 0, 25, 25]]);
    expect(cleanPeople(undefined, 100, 100)).toEqual([]);
  });
  it('the markbox switch is registered and on by default; a stale rule is gone from the guide', () => {
    expect(SWITCHES.find((s) => s.name === 'markbox')?.default).toBe('on');
    const g = readFileSync('docs/community-flow-guide.md', 'utf8');
    expect(markOn(new URLSearchParams(''))).toBe(true); expect(markOn(new URLSearchParams('markbox=0'))).toBe(false);
    expect(g).not.toMatch(/You never draw a box|no hand-drawn fallback/i);
    expect(g).toMatch(/2026-11-03/);
  });
});
