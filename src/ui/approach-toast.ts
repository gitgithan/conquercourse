import type { CourseData } from '../course/course';
import type { Drum } from '../sim/drums';
import { APPROACH_LEAD, TOASTS, TRAMPOLINE_LEAD, type ToastKind, type ToastRow } from '../course/obstacles';

// CC-195: the plain-words toast for an obstacle must be on screen BEFORE the obstacle and BEFORE its key on the drum lane.
// One table: each drum kind has a text, and every text starts APPROACH_LEAD metres before its drum (about 1.4 s at running speed).
export { APPROACH_LEAD, TRAMPOLINE_LEAD };
export type { ToastKind };

const TOAST_ROWS = Object.entries(TOASTS) as [ToastKind, ToastRow][];

// Which obstacle a drum belongs to: the zone it sits in (or just after: a roll drum is found in the air), else what the course has.
export function toastKindOf(course: CourseData, d: Drum): ToastKind | null {
  const direct = TOAST_ROWS.find(([, r]) => r.drum === d.what);
  if (direct) return direct[0];
  if (d.what !== 'grab') return null;
  const z = (course.zones ?? []).find((q) => d.x >= q.x0 - 1 && d.x <= q.x1 + 1);
  const id = z?.id ?? '';
  for (const [k, r] of TOAST_ROWS) if (r.grab && (id === k || id.startsWith(k + '-'))) return k;
  if (course.climbPoles?.some((p) => Math.abs(p.x - d.x) < 1.5)) return 'pole'; // a standing pole: E closes on it (CC-133, the bulb lane)
  if (course.holds?.some((h) => Math.abs(h.x - d.x) < 3)) return 'lache';
  if (course.rope && Math.abs(course.rope.anchorX - d.x) < 6) return 'rope';
  if (course.wall && d.x >= course.wall.x0) return 'wall';
  return null;
}

export const leadOf = (k: ToastKind): number => ('lead' in TOASTS[k] ? (TOASTS[k] as ToastRow).lead! : APPROACH_LEAD);

export interface Toast { drum: Drum; kind: ToastKind; text: string; startX: number }

// Every toast of a course, in order of the drums. A Space drum just before an E drum is the take-off for that bar, rope or wall (not a gap): it carries the E text,
// so the toast says what is coming and the key that follows. A roll drum sits at the landing after a flight, so its toast starts before the take-off that leads to it.
export function toastsFor(course: CourseData, drums: Drum[]): Toast[] {
  const out: Toast[] = [];
  const merged = new Set<Drum>(); // the E drums whose take-off carries their toast
  drums.forEach((d, i) => {
    let k = toastKindOf(course, d);
    if (!k || merged.has(d)) return;
    const prev = drums.slice(0, i).filter((q) => !q.route || !d.route || q.route === d.route).pop(); // on a fork, the drums of the other way are not this way's neighbours
    if (d.what === 'grab' && prev && prev.what === 'release' && d.x - prev.x < 8) return; // the next bar of a chain: the first bar's toast covers it
    if (k === 'jump') {
      const nx = drums.slice(i + 1).find((q) => q.what !== 'jump');
      const nk = nx && nx.x - d.x < 14 ? toastKindOf(course, nx) : null; // a flight to the bar or the rope: up to 14 m
      if (nx && nx.route === d.route && (nk === 'lache' || nk === 'rope' || nk === 'climb')) { k = nk; merged.add(nx); }
    }
    let startX = d.x - leadOf(k);
    if (k === 'roll') { const before = drums.slice(0, i).filter((q) => q.x < d.x - 0.5 && q.what !== 'roll').pop(); if (before) startX = Math.min(startX, before.x - 4); }
    out.push({ drum: d, kind: k, text: TOASTS[k].text, startX });
  });
  return out;
}

// The toast to show with the runner at x: the first one that has started and whose key is not yet behind.
export function approachToast(course: CourseData, drums: Drum[], x: number): Toast | null {
  const on = toastsFor(course, drums).filter((t) => x >= t.startX && t.drum.x >= x - 0.3);
  return on.find((t) => t.kind !== 'jump') ?? on[0] ?? null; // a pole or a bar teaches more than a plain gap when both are close (the fork's two ways)
}
