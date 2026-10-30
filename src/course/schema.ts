import type { CourseData } from './course';
import { HAZARDS } from './hazard';

// One row per CourseData field: is it looks only (stays out of a link and is refused when one arrives with it), or what must be true of it.
// It is a Record over every field of CourseData, so adding a field to src/course/course.ts fails the type check until it has a row here.
// The checks are about shape, not size: the generic cleaning in src/share/made-course.ts already caps depth, length, numbers and text.
export interface FieldRule {
  looks?: true; // drawn or worked out again: none of it changes where a runner can stand
  check?: (v: unknown) => boolean;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === 'string';
const arr = (v: unknown, each: (x: unknown) => boolean, max = 400): boolean => Array.isArray(v) && v.length <= max && v.every(each);
const nums = (o: unknown, keys: string[]): boolean => isObj(o) && keys.every((k) => num(o[k]));
const opt = (o: Record<string, unknown>, keys: string[]): boolean => keys.every((k) => o[k] === undefined || num(o[k]));
const pair = (v: unknown): boolean => Array.isArray(v) && v.length === 2 && num(v[0]) && num(v[1]);
const range = (v: unknown, lo: number, hi: number): boolean => num(v) && v >= lo && v <= hi;
/** A machine or obstacle placed at x or over x0..x1: the rest of its numbers are optional tuning, but a number if present. */
const placed = (keys: string[]) => (v: unknown): boolean => nums(v, keys) && Object.values(v as object).every((x) => typeof x !== 'object' || x === null);

export const COURSE_FIELDS: Record<keyof CourseData, FieldRule> = {
  version: { check: (v) => v === 1 },
  name: { check: str },
  startX: { check: (v) => range(v, -1e4, 1e4) },
  finishX: { check: (v) => range(v, -1e4, 1e4) },
  jumpSpeed: { check: (v) => range(v, 1, 30) },
  terrain: { check: (v) => isObj(v) && arr(v.platforms, (p) => nums(p, ['x0', 'x1', 'top']), 60) && (v.platforms as unknown[]).length >= 1 && num(v.waterY) },
  checkpoints: { check: (v) => arr(v, (c) => isObj(c) && str(c.id) && num(c.x)) },
  zones: { check: (v) => arr(v, (z) => isObj(z) && str(z.id) && str(z.name) && num(z.x0) && num(z.x1)) },
  wall: { check: (v) => nums(v, ['x0']) },
  rope: { check: (v) => nums(v, ['anchorX', 'anchorY']) },
  jumpKeep: { check: (v) => range(v, 0.01, 1) },
  grabReach: { check: (v) => range(v, 0, 5) },
  holds: { check: (v) => arr(v, (h) => nums(h, ['x', 'y'])) },
  track: { check: (v) => isObj(v) && arr(v.pts, pair) && (v.pts as unknown[]).length >= 2 && (v.segments === undefined || arr(v.segments, (s) => arr(s, pair))) && opt(v, ['push']) },
  trebuchet: { check: placed(['x']) },
  recoil: { check: placed(['x0', 'x1']) },
  planks: { check: (v) => arr(v, (p) => nums(p, ['x0', 'x1', 'y', 'thickness', 'width']), 60) },
  band: { check: placed(['x']) },
  drone: { check: placed(['x0', 'x1']) },
  pole: { check: placed(['pickX', 'x0', 'x1', 'barX', 'barH']) },
  branches: { check: (v) => arr(v, (b) => isObj(b) && str(b.id) && str(b.name) && num(b.forkX) && num(b.joinX) && arr(b.routes, isObj, 3), 12) },
  shots: { check: (v) => arr(v, (b) => nums(b, ['x', 'y', 'vx', 'every', 'phase']) && (b as { every: number }).every > 0, 12) },
  keepDecks: { check: (v) => typeof v === 'boolean' },
  hazard: { check: (v) => str(v) && (HAZARDS as readonly string[]).includes(v) },
  // looks only, or worked out again from the platforms
  scene: { looks: true }, source: { looks: true }, uMap: { looks: true }, plan: { looks: true }, routes: { looks: true },
  windows: { looks: true }, shortcuts: { looks: true }, designedShortcuts: { looks: true }, off: { looks: true },
};

/** The fields a link leaves out, and refuses when it arrives with them. */
export const LOOKS_ONLY = (Object.keys(COURSE_FIELDS) as (keyof CourseData)[]).filter((k) => COURSE_FIELDS[k].looks);

/** True when every field the course has passes its check; a field this build does not know is left alone (an older link may carry one). */
export function fieldsOk(c: Record<string, unknown>): boolean {
  for (const k of Object.keys(c)) {
    const rule = (COURSE_FIELDS as Record<string, FieldRule | undefined>)[k];
    if (rule?.check && !rule.check(c[k])) return false;
  }
  return true;
}
