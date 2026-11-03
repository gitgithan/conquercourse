import { readFileSync } from 'node:fs';
import { parseClip, type Clip } from '../../src/motion/clip';

// Shared motion clip readers for tests (one copy, instead of a `load` in every test file). Paths are relative to the repo root, where vitest runs.
export const MOTION_DIR = 'public/assets/motion/';
/** The raw JSON of a shipped clip, typed by the caller: loadClipJson<SignalClip>('run'). */
export const loadClipJson = <T = unknown>(name: string): T => JSON.parse(readFileSync(`${MOTION_DIR}${name}.json`, 'utf8')) as T;
/** A shipped clip, parsed and checked: loadClip('run'). */
export const loadClip = (name: string): Clip => parseClip(loadClipJson(name));
