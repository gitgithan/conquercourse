import type { CourseData } from '../course/course';
import { courseHash } from '../sim/replay';
import type { Plan, Route, Window } from '../sim/ideal';
import type { Shortcut } from '../sim/shortcuts';
import STORED from './preset-plans.json';

// CC-243: the ideal run of each ready-made editor course, found ahead of time (npm run plans:presets) so the editor shows its verdict at once and the Course gets the plan with the hand-off.
// The key is a hash of the lane's course; a change to a preset, an object or the physics changes it, and tests/preset-plans.test.ts then fails until the plans are made again.
export interface PresetPlan { key: string; cleared: boolean; plan?: Plan; windows?: Window[]; timingWindows?: Window[]; routes?: Route[]; shortcuts?: Shortcut[] }

/** The key of a course for the stored plans: what the search sees (the pieces' course), not where it was cut from. */
/** The course as the search sees it: where it was cut from, the floor choice and the designed shortcuts do not change the search. */
export const searchInput = (c: CourseData): CourseData => ({ ...c, source: undefined, designedShortcuts: undefined, hazard: undefined } as CourseData);
export const presetKey = (c: CourseData): string => courseHash(searchInput(c));

/** The stored result for this exact course, or null (an edited course gets a live search). */
export function storedPlanFor(c: CourseData, table: Record<string, PresetPlan> = STORED as unknown as Record<string, PresetPlan>): PresetPlan | null {
  const k = presetKey(c);
  return Object.values(table).find((p) => p.key === k) ?? null;
}

/** The course with its stored proof attached, the way a demo course carries its plan. */
export function withStoredPlan(c: CourseData, r: Pick<PresetPlan, 'cleared' | 'plan' | 'windows' | 'routes' | 'shortcuts'> | null): CourseData {
  if (!r?.cleared || !r.plan) return c;
  return { ...c, plan: r.plan, ...(r.windows ? { windows: r.windows } : {}), ...(r.routes ? { routes: r.routes } : {}), ...(r.shortcuts?.length ? { shortcuts: r.shortcuts } : {}) };
}
