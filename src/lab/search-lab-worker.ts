import type { CourseData } from "../course/course";
import { pathOf, planFor, runLabSearch, type LabConfig } from "./search-lab";

// Runs a Search search off the page's thread, so the picture keeps drawing; sends the steps spent now and then, then the result with the two paths.
const ctx = self as unknown as { onmessage: ((e: { data: { id: number; course: CourseData; cfg: LabConfig } }) => void) | null; postMessage(m: unknown): void };
ctx.onmessage = (e) => {
  const { id, course, cfg } = e.data;
  const t0 = Date.now();
  const result = runLabSearch(course, cfg, (steps) => { if (steps % 50 === 0) ctx.postMessage({ id, steps }); });
  const found = result.line.length ? pathOf(course, planFor(result.line)) : [];
  const ours = course.plan ? pathOf(course, course.plan) : [];
  ctx.postMessage({ id, done: true, result, found, ours, wallMs: Date.now() - t0 });
};
