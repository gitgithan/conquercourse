import type { CourseData } from '../course/course';
import { findShortcuts } from './shortcuts';

// Works out the shortcuts off the page's thread (a few searches, about a minute for a long course).
const ctx = self as unknown as { onmessage: ((e: { data: { course: CourseData } }) => void) | null; postMessage(m: unknown): void };
ctx.onmessage = (e) => {
  const r = findShortcuts(e.data.course, { moveChoices: false });
  ctx.postMessage({ shortcuts: r.shortcuts, intendedSeconds: r.intendedSeconds });
};
