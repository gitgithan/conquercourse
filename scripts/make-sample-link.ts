// Makes ONE real short challenge link from a demo course's stored best run (a server write).
// Usage: npx tsx scripts/make-sample-link.ts https://conquercourse.pages.dev lane-1
import { readFileSync } from 'node:fs';
import { makeLinkInfo } from '../src/share/challenge';
import { recordPlan } from '../src/sim/replay';
import type { CourseData } from '../src/course/course';
const [origin, name = 'lane-1'] = process.argv.slice(2);
const course = JSON.parse(readFileSync(`public/assets/demo/${name}.course.json`, 'utf8')) as CourseData;
const { recorder, world } = recordPlan(course, course.plan!);
console.log('run', world.outcome, recorder.ticks, 'ticks');
const info = await makeLinkInfo(origin, `?course=/assets/demo/${name}.course.json`, course, recorder.snapshot(), 'Sample', 'a', 'done', (u, i) => fetch(u.startsWith('/') ? origin + u : u, i));
console.log(JSON.stringify(info));
