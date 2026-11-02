import { describe, expect, it } from 'vitest';
import { bandTip, buildDiag, cartTip, plankTip, windowTip } from '../src/modes/course/tips';
import type { CourseCtx } from '../src/modes/course/context';
import { OBSTACLES } from '../src/course/obstacles';
import base from '../src/course/default-course.json';
import type { CourseData } from '../src/course/course';
import type { GameEvent } from '../src/sim/world';

const course = base as unknown as CourseData;
const ev = (type: string, detail?: Record<string, unknown>) => ({ type, tick: 0, detail }) as unknown as GameEvent;
const made: unknown[] = [];
const ctxOf = (log: GameEvent[], c: CourseData = course): CourseCtx => ({ course: c, st: {} as CourseCtx['st'], log, guides: { add: (m: unknown) => made.push(m) } as unknown as CourseCtx['guides'], specs: [], wallNeed: 6, wallEntry: 5 });

describe('fall tips', () => {
  it('say early or late from where the runner was against the best press', () => {
    const ws = [{ obstacle: 'edge-1', best: 20 }] as never;
    expect(windowTip(ws, 18)).toMatch(/late/);
    expect(windowTip(ws, 22)).toMatch(/early/);
    expect(windowTip(ws, 40)).toBeUndefined();
  });
  it('give the stored plain tip when the plank or the band left no event', () => {
    expect(plankTip(ctxOf([]))).toBe(OBSTACLES.plank.tips.weak);
    expect(bandTip(ctxOf([]))).toBe(OBSTACLES.band.tips.noRelease);
  });
  it('name the numbers of a snapped band and a cart that left the rails', () => {
    expect(bandTip(ctxOf([ev('band-snap', { stretch: 31 })]))).toMatch(/snapped at 31 m/);
    expect(cartTip(ctxOf([ev('cart-off', { v: 7.25 })]), 'splash')).toMatch(/At 7\.3 m\/s|At 7\.2 m\/s/);
    expect(cartTip(ctxOf([]), 'splash')).toBe('Try again.');
    expect(cartTip(ctxOf([ev('cart-stall', { height: 3 })]), 'stall')).toMatch(/3\.0 m high/);
  });
  it('explain a rope let go while falling, and add no guide mesh for it', () => {
    made.length = 0;
    const lines = buildDiag(ctxOf([ev('rope-release', { vy: -1 })]), 'rope', 'splash');
    expect(lines[0]).toMatch(/earlier/);
    expect(made.length).toBe(0);
  });
});
