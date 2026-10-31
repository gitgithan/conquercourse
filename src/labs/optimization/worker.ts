import type { CourseData } from "../../course/course";
import { PROBLEMS, runMethod, sampleAt, type Method, type Settings, type Trace } from "./core";

// Runs the chosen searches off the page's thread. Every score is a real simulator run (playPlan); the page only draws.
export interface Job { id: number; problem: string; course: CourseData; methods: Method[]; cfg: Settings }
const ctx = self as unknown as { onmessage: ((e: { data: Job }) => void) | null; postMessage(m: unknown): void };
ctx.onmessage = (e) => {
  const { id, problem, course, methods, cfg } = e.data;
  const p = PROBLEMS.find((q) => q.id === problem)!;
  const t0 = Date.now();
  const traces: Trace[] = [];
  for (const m of methods) {
    traces.push(runMethod(m, (i, j) => sampleAt(p, course, i, j).score, p.axes[0].count, p.axes[1].count, cfg, (n) => { if (n % 25 === 0) ctx.postMessage({ id, method: m, evals: n }); }));
  }
  ctx.postMessage({ id, done: true, traces, wallMs: Date.now() - t0 });
};
