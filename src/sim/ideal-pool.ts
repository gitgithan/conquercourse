import type { CourseData } from '../course/course';
import { driveAsync, searchGen, type Batch, type Job, type SearchResult } from './ideal';
import type { FromWorker, ToWorker } from './ideal-eval';

// A pool of workers that play plans for the ideal-run search. The search itself runs here (it is cheap); only the many simulated runs
// are sent out. Same plans, same order, same scores as `searchIdealRun`, so the answer is the same, found about as many times faster as there are workers.
export interface PoolWorker { post(m: ToWorker): void; listen(cb: (m: FromWorker) => void): void; stop(): void }

export class IdealPool {
  private workers: PoolWorker[];
  private waiting = new Map<PoolWorker, { resolve(m: FromWorker): void; reject(e: Error): void }>();
  private closed = false;
  private spent = 0; // simulated ticks the current search has used (every worker's answer says what it cost)
  constructor(spawn: () => PoolWorker, readonly size: number) {
    this.workers = Array.from({ length: Math.max(1, size) }, () => {
      const w = spawn();
      w.listen((m) => { const f = this.waiting.get(w); this.waiting.delete(w); f?.resolve(m); });
      return w;
    });
  }

  private call(w: PoolWorker, m: ToWorker): Promise<FromWorker> {
    if (this.closed) return Promise.reject(new Error('cancelled'));
    return new Promise((resolve, reject) => { this.waiting.set(w, { resolve, reject }); w.post(m); });
  }

  private async evaluate(jobs: Job[], signal?: { cancelled: boolean }, budget?: number): Promise<number[]> {
    if (signal?.cancelled) throw new Error('cancelled');
    if (budget !== undefined && this.spent > budget) throw new Error('budget'); // the search has used its work: stop (the caller keeps what it had)
    const out = new Array<number>(jobs.length);
    const chunk = Math.max(1, Math.ceil(jobs.length / (this.workers.length * 4))); // small chunks, handed out as workers become free
    let next = 0;
    await Promise.all(this.workers.map(async (w) => {
      while (next < jobs.length) {
        const from = next; next += chunk;
        const r = await this.call(w, { t: 'eval', jobs: jobs.slice(from, from + chunk) });
        if (r.t === 'scores') { this.spent += r.ticks; r.scores.forEach((s, i) => { out[from + i] = s; }); }
      }
    }));
    return out;
  }

  // `signal.cancelled = true` stops the search at the next batch (the promise rejects).
  async search(course: CourseData, onBatch?: (b: Batch) => void, signal?: { cancelled: boolean }, opts: { routes?: boolean; budget?: number } = {}): Promise<SearchResult> {
    this.spent = 0;
    await Promise.all(this.workers.map((w) => this.call(w, { t: 'init', course })));
    return driveAsync(searchGen(course, opts), (jobs) => this.evaluate(jobs, signal, opts.budget), this.workers.length * 6, onBatch);
  }

  close(): void {
    this.closed = true;
    this.workers.forEach((w) => w.stop());
    for (const pending of this.waiting.values()) pending.reject(new Error('cancelled'));
    this.waiting.clear();
  }
}
