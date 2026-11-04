import { expect, it, vi } from 'vitest';
import { shareSearches } from '../src/modes/course/search-share';
import type { CourseData } from '../src/course/course';
import data from '../src/course/default-course.json';
const course = data as CourseData;
it('teardown rejects all shared askers and closes the progress panel even if a worker never answers', async () => {
  const controller = new AbortController(), close = vi.fn();
  const search = shareSearches(() => new Promise(() => {}), { signal: controller.signal, openPanel: () => ({ note() {}, done() {}, close }) });
  const a = search(course, { cancelled: false }, undefined, undefined, 'ideal');
  const b = search(course, { cancelled: false }, undefined, undefined, 'ghost');
  const results = Promise.allSettled([a, b]); controller.abort();
  expect((await results).map((r) => r.status)).toEqual(['rejected', 'rejected']);
  expect(close).toHaveBeenCalled();
  await expect(search(course, { cancelled: false })).rejects.toThrow('cancelled');
});

it('closing the pool rejects in-flight worker requests', async () => {
  const { IdealPool } = await import('../src/sim/ideal-pool');
  const stop = vi.fn();
  const pool = new IdealPool(() => ({ post() {}, listen() {}, stop }), 2);
  const result = pool.search(course); pool.close();
  await expect(result).rejects.toThrow('cancelled'); expect(stop).toHaveBeenCalledTimes(2);
  await expect(pool.search(course)).rejects.toThrow('cancelled');
});
