import type { CourseData } from '../../course/course';
import { IdealPool } from '../../sim/ideal-pool';
import { searchIdealRun, type SearchResult } from '../../sim/ideal';

export type RunSearch = (c: CourseData, sig: { cancelled: boolean }, onNote?: (label: string, step: number, of: number) => void, budget?: number) => Promise<SearchResult>;

// The search runs in a pool of workers (src/sim/ideal-pool.ts): the page keeps drawing, the line says which obstacle it is on, and any key cancels.
// One search at a time (the workers hold one course); each waits for the one before. Nothing here runs a search on the page's thread unless there are no workers at all.
export function createSearch(): RunSearch {
  let idealPool: IdealPool | null = null;
  let poolQueue: Promise<unknown> = Promise.resolve();
  return (c, sig, onNote, budget) => {
    try {
      idealPool ??= new IdealPool(() => {
        const w = new Worker(new URL('../../sim/ideal-eval-worker.ts', import.meta.url), { type: 'module' });
        return { post: (m) => w.postMessage(m), listen: (cb) => w.addEventListener('message', (e) => cb((e as MessageEvent).data)), stop: () => w.terminate() };
      }, Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 4) - 1)));
      const pool = idealPool;
      const run = poolQueue.catch(() => undefined).then(() => (sig.cancelled ? Promise.reject(new Error('cancelled')) : pool.search(c, (b) => onNote?.(b.label, Math.min(b.step + 1, b.of), b.of), sig, { budget })));
      poolQueue = run;
      return run;
    } catch { return Promise.resolve(searchIdealRun(c)); } // no worker here: search on the page's thread
  };
}
