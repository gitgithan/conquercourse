import { expect, it, vi } from 'vitest';
import { easierWorkers, type SearchWorker } from '../src/modes/editor/easier-workers';
import type { CourseData } from '../src/course/course';
import type { EasierProof } from '../src/slice/easier';

const course = { name: 'candidate' } as CourseData;
class ControlledWorker implements SearchWorker {
  onmessage: SearchWorker['onmessage'] = null;
  onerror: SearchWorker['onerror'] = null;
  postMessage = vi.fn(); terminate = vi.fn();
  answer(proof: EasierProof) { this.onmessage?.({ data: proof }); }
}
it('bounds active workers, queues requests and rejects all work when cancelled', async () => {
  const workers: ControlledWorker[] = [];
  const pool = easierWorkers(2, () => { const w = new ControlledWorker(); workers.push(w); return w; });
  const jobs = [pool.search(course), pool.search(course), pool.search(course)];
  const settled = Promise.allSettled(jobs);
  expect(workers).toHaveLength(2);
  workers[1].answer({ cleared: false });
  expect(workers[1].postMessage).toHaveBeenCalledTimes(2);
  pool.cancel();
  expect((await settled).map((r) => r.status)).toEqual(['rejected', 'fulfilled', 'rejected']);
  expect(workers.every((w) => w.terminate.mock.calls.length === 1)).toBe(true);
  await expect(pool.search(course)).rejects.toThrow('cancelled');
});
it('rejects a clearance verdict without the successful plan', async () => {
  const worker = new ControlledWorker(), pool = easierWorkers(1, () => worker);
  const job = pool.search(course); worker.answer({ cleared: true });
  await expect(job).rejects.toThrow('Missing successful run'); pool.cancel();
});
