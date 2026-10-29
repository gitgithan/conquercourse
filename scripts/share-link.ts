// Print a challenge link for the stored best line of a course (CC-128): npx tsx scripts/share-link.ts public/assets/demo/lache.course.json [origin]
import { readFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import { makeChallengeUrl } from '../src/share/challenge';
import { recordPlan } from '../src/sim/replay';

const [file, origin = 'https://conquercourse.pages.dev'] = process.argv.slice(2);
const course = JSON.parse(readFileSync(file, 'utf8')) as CourseData;
if (!course.plan) throw new Error('this course has no stored plan to record');
const { recorder } = recordPlan(course, course.plan, 120 * 120);
const search = process.env.MADE ? '' : `?course=/${file.replace(/^public\//, '')}`; // MADE=1: a course made in the editor, carried in the link (CC-136)
if (process.env.MADE) course.name = 'Made in the editor';
const url = await makeChallengeUrl(origin, search, course, recorder.snapshot());
if (!url) throw new Error('no link: the run does not clear, or it is too long');
console.log(url);
