import { readFileSync } from 'node:fs';
import type { CourseData } from '../../src/course/course';

// Shared course readers for tests (one copy, instead of a `load` in every test file). Paths are relative to the repo root, where vitest runs.
export const DEMO_DIR = 'public/assets/demo/';
/** A course file in public/assets/demo/, name with its ending: loadDemo('training.course.json'). */
export const loadDemo = (file: string): CourseData => loadCourseFile(DEMO_DIR + file);
/** The same for the usual ending: loadDemoCourse('lane-1') reads lane-1.course.json. */
export const loadDemoCourse = (name: string): CourseData => loadDemo(`${name}.course.json`);
/** Any course JSON by path. */
export const loadCourseFile = (path: string): CourseData => JSON.parse(readFileSync(path, 'utf8')) as CourseData;
