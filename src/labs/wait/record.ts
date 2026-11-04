import type { CourseData } from "../../course/course";
import { CLEARED, evalJob, meter, searchGen } from "../../sim/ideal";

// Records the REAL ideal-run search (src/sim/ideal.ts, the generator the game uses): how many simulator ticks every job costs, batch by batch, and where a batch could stop early.
// The answer the search finds is fed back exactly as the game's one-thread driver feeds it (a batch that may stop at its first clear is cut there), so it is the game's answer.
// With `costAll` the jobs that early exit skipped are still played, only to learn what they would have cost (their score is never fed back).
export interface RecBatch { label: string; early: boolean; ticks: number[]; stopAt: number } // ticks: every job of the batch; stopAt: index of the first clear in an early-exit batch, else -1
export interface Recording { batches: RecBatch[]; cleared: boolean; planKey: string; jobsRun: number; ticksRun: number; dupJobs: number }

export function recordSearch(course: CourseData, costAll = true): Recording {
  const g = searchGen(course);
  let r = g.next();
  const batches: RecBatch[] = [];
  const seen = new Set<string>();
  let jobsRun = 0, ticksRun = 0, dupJobs = 0;
  while (!r.done) {
    const b = r.value;
    const ticks: number[] = [], out: number[] = [];
    let stopAt = -1;
    for (let i = 0; i < b.jobs.length; i++) {
      if (stopAt >= 0 && !costAll) break;
      const k0 = meter.ticks, j = b.jobs[i];
      const s = evalJob(course, j);
      const cost = meter.ticks - k0;
      ticks.push(cost);
      const key = JSON.stringify(j);
      if (stopAt < 0) { jobsRun++; ticksRun += cost; if (seen.has(key)) dupJobs++; seen.add(key); out.push(s); }
      if (b.stopOnClear && stopAt < 0 && s >= CLEARED) stopAt = i;
    }
    batches.push({ label: b.label, early: !!b.stopOnClear, ticks, stopAt });
    r = g.next(out);
  }
  const res = r.value;
  return { batches, cleared: res.cleared, planKey: JSON.stringify(res.plan), jobsRun, ticksRun, dupJobs };
}
