import { afterEach, expect, it, vi } from 'vitest';
import { CourseLifetime, activateCourse, courseListen, courseTimeout, courseInterval } from '../src/modes/course/lifetime';
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('course teardown removes old keys and timers without disturbing the next session', () => {
  vi.stubGlobal('window', globalThis); vi.useFakeTimers();
  const target = new EventTarget(), old = new CourseLifetime(), fresh = new CourseLifetime();
  const oldKey = vi.fn(), newKey = vi.fn(), delayed = vi.fn(), poll = vi.fn();
  activateCourse(old); courseListen(target, 'keydown', oldKey);
  courseTimeout(delayed, 100); courseInterval(poll, 100);
  old.close(); old.close();
  activateCourse(fresh); courseListen(target, 'keydown', newKey);
  target.dispatchEvent(new Event('keydown')); vi.advanceTimersByTime(200);
  expect(oldKey).not.toHaveBeenCalled(); expect(newKey).toHaveBeenCalledOnce();
  expect(delayed).not.toHaveBeenCalled(); expect(poll).not.toHaveBeenCalled();
  fresh.close();
});
it('late resources are disposed immediately after their course has closed', () => {
  const life = new CourseLifetime(), dispose = vi.fn(); life.close(); life.own(dispose);
  expect(dispose).toHaveBeenCalledOnce();
});
