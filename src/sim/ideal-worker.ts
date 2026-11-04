import type { CourseData } from '../course/course';
import { searchIdealRun } from './ideal';
import { proveEditorCourse } from './fork';

// Runs the ideal-run search off the page's thread, so the Course keeps drawing while a long search works.
// CC-243: it tells the page how far it is ("step N of M"), at most four times a second, so the lane check can show a progress line.
const ctx = self as unknown as { onmessage: ((e: { data: { id: number; course: CourseData } }) => void) | null; postMessage(m: unknown): void };
ctx.onmessage = (e) => {
  const { id, course } = e.data;
  if (course.climbPoles?.length) { const q = proveEditorCourse(course); ctx.postMessage({ id, plan: q.plan, cleared: q.cleared, windows: [], branches: q.branches }); return; } // CC-133: a course with a pole is proved lane by lane
  let last = 0;
  const r = searchIdealRun(course, { onBatch: (b) => { const now = Date.now(); if (now - last < 250) return; last = now; ctx.postMessage({ id, progress: { label: b.label, step: b.step, of: b.of } }); } });
  ctx.postMessage({ id, plan: r.plan, cleared: r.cleared, windows: r.windows, routes: r.routes });
};
