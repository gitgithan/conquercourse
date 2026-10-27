// Writes the ideal run and its windows for the default course: `npx tsx scripts/ideal-run.ts` (or via vitest's node).
import { writeFileSync } from 'node:fs';
import course from '../src/course/default-course.json';
import type { CourseData } from '../src/course/course';
import { searchIdealRun } from '../src/sim/ideal';

const found = searchIdealRun(course as unknown as CourseData);
const out = { version: 1, course: (course as { name: string }).name, cleared: found.cleared, plan: found.plan, windows: found.windows.map((w) => ({ ...w, widthMs: Math.round(w.widthMs) })) };
writeFileSync('src/course/default-course.ideal.json', JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${out.windows.length} windows`);
