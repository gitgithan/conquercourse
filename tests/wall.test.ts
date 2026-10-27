import { describe, expect, it } from 'vitest';
import { DEFAULT_WALL, climbHeight, runWall } from '../src/sim/wall';

const near = (a: number, b: number, rel: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.abs(b));

describe('warped wall: speed becomes height', () => {
  it('feet rise to v² / (2 g (1 + loss)), within 1 %, when the wall is too high to grab', () => {
    const tall = { ...DEFAULT_WALL, height: 40 }; // so tall nobody grabs: we measure the pure climb
    for (const v of [3, 4, 5, 6]) near(runWall(v, tall).heightGained, climbHeight(v, tall), 0.01);
  });
  it('with no friction it is the energy law v² / 2g exactly', () => {
    const ideal = { ...DEFAULT_WALL, height: 40, loss: 0 };
    near(runWall(5, ideal).heightGained, (5 * 5) / (2 * 9.81), 0.005);
  });
  it('doubling the speed quadruples the height', () => {
    const tall = { ...DEFAULT_WALL, height: 40 };
    near(runWall(6, tall).heightGained, 4 * runWall(3, tall).heightGained, 0.01);
  });
  it('friction only ever lowers the height', () => {
    const tall = { ...DEFAULT_WALL, height: 40 };
    expect(runWall(5, { ...tall, loss: 0.2 }).heightGained).toBeLessThan(runWall(5, { ...tall, loss: 0.05 }).heightGained);
  });
});

describe('warped wall: the grab and the slide back', () => {
  const needed = DEFAULT_WALL.height - DEFAULT_WALL.hipHeight - DEFAULT_WALL.reach;
  const vJust = Math.sqrt(2 * 9.81 * (1 + DEFAULT_WALL.loss) * needed);
  it('grabs when the hands reach the top', () => {
    const r = runWall(vJust + 0.1);
    expect(r.grabbed).toBe(true);
    expect(r.margin).toBeGreaterThanOrEqual(0);
    expect(r.path.length).toBeGreaterThan(10);
  });
  it('slides back when 0.1 m/s short, and reports how close it was', () => {
    const r = runWall(vJust - 0.1);
    expect(r.grabbed).toBe(false);
    expect(r.margin).toBeLessThan(0);
    expect(r.margin).toBeGreaterThan(-0.3);
    expect(r.exitSpeed).toBeGreaterThan(0);
  });
  it('a slide back returns to the base slower than it came, by the friction on the way up and down', () => {
    const r = runWall(4);
    near(r.exitSpeed, 4 * Math.sqrt((1 - DEFAULT_WALL.loss) / (1 + DEFAULT_WALL.loss)), 0.02);
  });
  it('a taller wall needs more speed', () => {
    const high = { ...DEFAULT_WALL, height: 5 };
    expect(runWall(vJust + 0.1, high).grabbed).toBe(false);
  });
});

import { wallPath } from '../src/sim/world';

describe('no teleport at the wall top', () => {
  it('the hand-over from the grab to the deck never moves more than 8 cm in one tick', () => {
    const r = runWall(7);
    expect(r.grabbed).toBe(true);
    const p = wallPath(r, 0, DEFAULT_WALL.height);
    for (let i = 1; i < p.length; i++) expect(Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y)).toBeLessThan(0.08);
    expect(p[p.length - 1].y).toBeCloseTo(DEFAULT_WALL.height, 9);
  });
  it('the same speed reaches the same height whatever the wall height (energy only)', () => {
    const h = (H: number) => runWall(6, { ...DEFAULT_WALL, height: H, radius: 4.3, stopAtGrab: false }).heightGained;
    near(h(3), h(6), 0.005);
    near(h(4.3), h(9), 0.005);
  });
});
