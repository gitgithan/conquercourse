import type { CourseData } from '../course/course';
import { evalJob, meter, type Job } from './ideal';

// The worker side of the ideal-run pool: it is told the course once, then asked to play lists of plans and answer with their scores.
// The same handler runs in a Web Worker (src/sim/ideal-eval-worker.ts) and in a Node worker thread (src/sim/ideal-eval-node.ts).
export type ToWorker = { t: 'init'; course: CourseData } | { t: 'eval'; jobs: Job[] };
export type FromWorker = { t: 'ready' } | { t: 'scores'; scores: number[]; ticks: number }; // ticks: the simulated ticks this answer cost

export function makeHandler(reply: (m: FromWorker) => void): (m: ToWorker) => void {
  let course: CourseData | null = null;
  return (m) => {
    if (m.t === 'init') { course = m.course; reply({ t: 'ready' }); return; }
    const m0 = meter.ticks;
    const scores = m.jobs.map((j) => evalJob(course!, j));
    reply({ t: 'scores', scores, ticks: meter.ticks - m0 });
  };
}
