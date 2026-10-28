import type { CourseData } from '../course/course';
import { DT } from './units';
import { playPlan, searchIdealRun, type Plan } from './ideal';

// How forgiving is the release of a trebuchet course? The window of release times (ticks after the pin is pulled) that still win,
// measured from the simulator: for every release time near the best one, the player may hold on to the bar for as long as they like
// (the cue tells them when to let go), so a release time counts when any hang time clears. The window is the unbroken run around the best release.
export interface ReleaseWindow { best: number; lo: number; hi: number; ticks: number; widthMs: number }

export function releaseWindow(course: CourseData, found?: { plan: Plan; cleared: boolean }): ReleaseWindow | null {
  const r = found ?? searchIdealRun({ ...course, plan: undefined });
  if (!r.cleared || r.plan.launchRelease === undefined) return null;
  const plan = r.plan, best = plan.launchRelease!;
  const bars = (course.holds ?? []).length > 0;
  const hangs = bars ? Array.from({ length: 81 }, (_, i) => i * 6) : [0];
  const wins = (rel: number): boolean => {
    const base: Plan = { ...plan, launchRelease: rel };
    if (playPlan(course, base, 120 * 30).world.outcome === 'cleared') return true; // the stored hang time first: nearly always enough
    if (!bars) return false;
    return hangs.some((h) => playPlan(course, { ...base, hangTicks: plan.hangTicks!.map((t, i) => (i === 0 ? h : t)) }, 120 * 30).world.outcome === 'cleared');
  };
  let lo = best, hi = best;
  while (lo > 20 && wins(lo - 1)) lo--;
  while (hi < 600 && wins(hi + 1)) hi++;
  return { best, lo, hi, ticks: hi - lo + 1, widthMs: (hi - lo + 1) * DT * 1000 };
}
