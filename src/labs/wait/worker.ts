import type { CourseData } from "../../course/course";
import { recordSearch } from "./record";

// Plays the real search once on this machine (off the page's thread) and says how many simulator ticks it got through per millisecond.
const ctx = self as unknown as { onmessage: ((e: { data: { course: CourseData } }) => void) | null; postMessage(m: unknown): void };
ctx.onmessage = (e) => {
  const t0 = performance.now();
  const rec = recordSearch(e.data.course, false);
  const ms = performance.now() - t0;
  ctx.postMessage({ ticks: rec.ticksRun, ms, cleared: rec.cleared });
};
