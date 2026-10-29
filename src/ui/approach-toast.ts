import type { CourseData } from '../course/course';
import type { Drum } from '../sim/drums';

// CC-195: the plain-words toast for an obstacle must be on screen BEFORE the obstacle and BEFORE its key on the drum lane.
// One table: each drum kind has a text, and every text starts APPROACH_LEAD metres before its drum (about 1.4 s at running speed).
export const APPROACH_LEAD = 12;
export const TRAMPOLINE_LEAD = 14; // the trampoline cue is older and longer (it stays four seconds); the drum for a bounce sits on the bed

export type ToastKind = 'vault' | 'wall' | 'climb' | 'lache' | 'rope' | 'roll' | 'jump' | 'bounce';

// Which obstacle a drum belongs to: the zone it sits in (or just after: a roll drum is found in the air), else what the course has.
export function toastKindOf(course: CourseData, d: Drum): ToastKind | null {
  if (d.what === 'vault') return 'vault';
  if (d.what === 'roll') return 'roll';
  if (d.what === 'jump') return 'jump';
  if (d.what === 'bounce') return 'bounce';
  if (d.what !== 'grab') return null;
  const z = (course.zones ?? []).find((q) => d.x >= q.x0 - 1 && d.x <= q.x1 + 1);
  const id = z?.id ?? '';
  for (const k of ['wall', 'climb', 'lache', 'rope'] as const) if (id === k || id.startsWith(k + '-')) return k;
  if (course.holds?.some((h) => Math.abs(h.x - d.x) < 3)) return 'lache';
  if (course.rope && Math.abs(course.rope.anchorX - d.x) < 6) return 'rope';
  if (course.wall && d.x >= course.wall.x0) return 'wall';
  return null;
}

const TEXT: Record<ToastKind, string> = {
  vault: 'A step is coming: press V as you reach it to vault over',
  wall: 'The warped wall is coming: run up it, then hold E near the top',
  climb: 'A tall wall is coming: hold E at the wall to grab the edge and climb',
  lache: 'A bar is coming: jump, then hold E to grab it',
  rope: 'A rope is coming: jump, then hold E to catch it',
  roll: 'A big drop is coming: hold X as you land to roll',
  jump: 'A gap is coming: press Space just before the edge',
  bounce: 'Trampoline ahead: press Space the moment you land on it for extra height',
};

export const leadOf = (k: ToastKind): number => (k === 'bounce' ? TRAMPOLINE_LEAD : APPROACH_LEAD);

export interface Toast { drum: Drum; kind: ToastKind; text: string; startX: number }

// Every toast of a course, in order of the drums. A Space drum just before an E drum is the take-off for that bar, rope or wall (not a gap): it carries the E text,
// so the toast says what is coming and the key that follows. A roll drum sits at the landing after a flight, so its toast starts before the take-off that leads to it.
export function toastsFor(course: CourseData, drums: Drum[]): Toast[] {
  const out: Toast[] = [];
  const merged = new Set<Drum>(); // the E drums whose take-off carries their toast
  drums.forEach((d, i) => {
    let k = toastKindOf(course, d);
    if (!k || merged.has(d)) return;
    if (d.what === 'grab' && i > 0 && drums[i - 1].what === 'release' && d.x - drums[i - 1].x < 8) return; // the next bar of a chain: the first bar's toast covers it
    if (k === 'jump') {
      const nx = drums.slice(i + 1).find((q) => q.what !== 'jump');
      const nk = nx && nx.x - d.x < 14 ? toastKindOf(course, nx) : null; // a flight to the bar or the rope: up to 14 m
      if (nx && (nk === 'lache' || nk === 'rope' || nk === 'climb')) { k = nk; merged.add(nx); }
    }
    let startX = d.x - leadOf(k);
    if (k === 'roll') { const before = drums.slice(0, i).filter((q) => q.x < d.x - 0.5 && q.what !== 'roll').pop(); if (before) startX = Math.min(startX, before.x - 4); }
    out.push({ drum: d, kind: k, text: TEXT[k], startX });
  });
  return out;
}

// The toast to show with the runner at x: the first one that has started and whose key is not yet behind.
export function approachToast(course: CourseData, drums: Drum[], x: number): Toast | null {
  return toastsFor(course, drums).find((t) => x >= t.startX && t.drum.x >= x - 0.3) ?? null;
}
