import { describe, expect, it } from 'vitest';
import { createHint } from '../src/modes/course/hint';
import type { CourseCtx } from '../src/modes/course/context';
import base from '../src/course/default-course.json';
import type { CourseData } from '../src/course/course';
import { newWorld } from '../src/sim/world';

const course = base as unknown as CourseData;
const make = (everCleared: boolean) => {
  const st = { world: newWorld(course), falls: 0 } as unknown as CourseCtx['st'];
  const ctx: CourseCtx = { course, st, log: [], guides: {} as CourseCtx['guides'], specs: [], wallNeed: Infinity, everCleared, wallEntry: 0 };
  return { ctx, hint: createHint(ctx, { toastDrums: () => [], shotPreview: () => null }) };
};

describe('the hint line', () => {
  it('teaches the first key at the very start', () => {
    const { ctx, hint } = make(false);
    expect(hint(ctx.st.world)).toBe('Hold → to run');
  });
  it('goes quiet once the player has cleared a course before', () => {
    const { ctx, hint } = make(true);
    expect(hint(ctx.st.world)).toBe('');
  });
  it('goes quiet after a fall too', () => {
    const { ctx, hint } = make(false);
    ctx.st.falls = 1;
    expect(hint(ctx.st.world)).toBe('');
  });
});
