import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { searchIdealRun } from '../src/sim/ideal';
import { withTrebuchet } from '../src/slice/launch-lane';

const lane = (top: number): CourseData => ({
  version: 1, name: 'lane', startX: 0, finishX: 24, jumpSpeed: 4.5, uMap: [{ u0: 0, u1: 11, x0: 9 }],
  terrain: { waterY: -3, platforms: [{ x0: -10, x1: 6, top: 0 }, { x0: 9, x1: 20, top }, { x0: 23, x1: 31, top }] },
});

describe('a lane that starts in a trebuchet (editor)', () => {
  it('puts the machine on its own deck, moves the lane out to a throw away and keeps everything in step', () => {
    const c = withTrebuchet({ ...lane(4), holds: [{ x: 12, y: 6 }] }, 1200);
    expect(c.trebuchet).toEqual({ x: 0, counterweight: 1200 });
    expect(c.terrain.platforms[0]).toEqual({ x0: -14, x1: 3, top: 0 });
    expect(c.terrain.platforms[1].x0).toBe(14);
    expect(c.holds![0].x).toBe(17);
    expect(c.uMap![0].x0).toBe(14);
    expect(c.finishX).toBe(29);
    expect(c.startX).toBe(-12);
  });
  it('the proof knows the machine: a lane with a landing deck 4 m up is clearable with enough weight and not with too little', () => {
    const ok = searchIdealRun(withTrebuchet(lane(4), 1200));
    expect(ok.cleared).toBe(true);
    const light = searchIdealRun(withTrebuchet(lane(4), 500));
    expect(light.cleared).toBe(false);
  });
});
