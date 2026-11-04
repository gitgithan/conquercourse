import type { CourseData } from "../../course/course";
import { prepare, runTiming, sweepSigma, type TimingConfig } from "./core";

// Runs a Statistics of timing job off the page's thread: measure the windows once per course, then the Monte Carlo, then a sweep over jitter for the curve.
const ctx = self as unknown as { onmessage: ((e: { data: { id: number; course: CourseData; courseKey: string; cfg: TimingConfig; sweep: number[] } }) => void) | null; postMessage(m: unknown): void };
let cached: { key: string; prep: ReturnType<typeof prepare> } | null = null;
ctx.onmessage = (e) => {
  const { id, course, courseKey, cfg, sweep } = e.data;
  const t0 = Date.now();
  if (!cached || cached.key !== courseKey) cached = { key: courseKey, prep: prepare(course) };
  const prep = cached.prep;
  const result = runTiming(course, cfg, (done) => ctx.postMessage({ id, progress: done }), prep);
  const curve = result ? sweepSigma(course, cfg, sweep, Math.max(100, Math.round(cfg.runs / 4)), prep) : [];
  ctx.postMessage({ id, done: true, result, curve, wallMs: Date.now() - t0 });
};
