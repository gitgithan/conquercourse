import type { CourseData } from '../course/course';
import { searchIdealRun } from '../sim/ideal';
import { bandParams } from '../sim/band';

// Fix it for a course with an elastic band: if the throw does not clear the lane, try softer bands (a softer band stretches farther and stores more, because the legs
// can only pull so hard) until the simulator's own search finds a line that clears. Returns the softest change that works, with what it means in plain words.
export interface BandFix { ok: boolean; k: number; steps: string[] }

export function fixBand(course: CourseData, minK = 20): BandFix {
  const p = bandParams(course);
  if (searchIdealRun(course).cleared) return { ok: true, k: p.k, steps: [] };
  for (let k = Math.floor(p.k * 0.85); k >= minK; k = Math.floor(k * 0.85)) {
    if (searchIdealRun({ ...course, band: { ...course.band!, k } }).cleared) {
      return { ok: true, k, steps: [`Use a softer band, ${k} N/m instead of ${Math.round(p.k)} N/m: it stretches farther, stores more, and throws you fast enough to clear the gap.`] };
    }
  }
  return { ok: false, k: p.k, steps: ['No band from ' + Math.round(p.k) + ' down to ' + minK + ' N/m throws you far enough. Make the gap shorter, or lower the far side.'] };
}
