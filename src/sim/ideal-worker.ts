import type { CourseData } from '../course/course';
import { searchIdealRun } from './ideal';

// Runs the ideal-run search off the page's thread, so the Course keeps drawing while a long search works.
const ctx = self as unknown as { onmessage: ((e: { data: { id: number; course: CourseData } }) => void) | null; postMessage(m: unknown): void };
ctx.onmessage = (e) => {
  const { id, course } = e.data;
  const r = searchIdealRun(course);
  ctx.postMessage({ id, plan: r.plan, cleared: r.cleared });
};
