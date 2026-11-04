import type { CourseData } from '../../course/course';
import type { EasierProof } from '../../slice/easier';

export interface SearchWorker {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: { data: EasierProof & { progress?: unknown } }) => void) | null;
  onerror: (() => void) | null;
}
// One complete candidate per worker. Never nest this with the timing-trial pool.
// Workers live only for a search session; cancelling rejects every pending request.
export function easierWorkers(size = 2, spawn: () => SearchWorker = () => new Worker(new URL('../../sim/ideal-worker.ts', import.meta.url), { type: 'module' }) as unknown as SearchWorker) {
  type Task = { course: CourseData; resolve: (p: EasierProof) => void; reject: (e: Error) => void };
  const queue: Task[] = [], slots: { worker: SearchWorker; task?: Task }[] = [];
  let stopped = false;
  function pump() {
    if (stopped) return;
    while (queue.length) {
      let slot = slots.find((s) => !s.task);
      if (!slot) {
        if (slots.length >= size) return;
        const worker = spawn(); slot = { worker }; slots.push(slot);
        const own = slot;
        worker.onmessage = ({ data }) => {
          if (data.progress || stopped) return;
          const task = own.task; own.task = undefined;
          if (data.cleared && !data.plan) task?.reject(new Error('Missing successful run'));
          else task?.resolve(data);
          pump();
        };
        worker.onerror = () => cancel('The simulator worker stopped. Try again.');
      }
      slot.task = queue.shift()!;
      slot.worker.postMessage({ id: 1, course: slot.task.course });
    }
  }
  function cancel(reason = 'cancelled') {
    stopped = true;
    for (const s of slots) { s.worker.terminate(); s.task?.reject(new Error(reason)); s.task = undefined; }
    for (const task of queue.splice(0)) task.reject(new Error(reason));
  }
  return {
    search(course: CourseData): Promise<EasierProof> {
      if (stopped) return Promise.reject(new Error('cancelled'));
      return new Promise((resolve, reject) => { queue.push({ course, resolve, reject }); try { pump(); } catch { cancel('Could not start the simulator worker.'); } });
    },
    cancel,
  };
}
