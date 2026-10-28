import { findShortcuts, type Shortcut } from '../sim/shortcuts';
import { searchIdealRun } from '../sim/ideal';
import { courseFor } from './fixbars';
import { holdsOf, isHold, type P } from './holds-world';

// "Close it" for a shortcut that skips a bar: push everything after the skipped bar further on, so the bar before it can no longer reach the
// far side in one flight, while the planned line (bar to bar) still clears. Each candidate is proved by the simulator, smallest push first.
type Lane = { angle: number; offset: number; level: number };
export interface Closed { ok: boolean; pieces: P[]; steps: string[] }

const skippedBars = (s: Pick<Shortcut, 'skipped'>): number[] => s.skipped.map((n) => /^Bar (\d+)$/.exec(n)).filter((m): m is RegExpExecArray => !!m).map((m) => Number(m[1]) - 1);

export function closeShortcut(pieces: P[], lane: Lane, s: Pick<Shortcut, 'id' | 'skipped'>, budgetMs = 120000): Closed {
  const t0 = performance.now();
  const idx = skippedBars(s);
  if (!idx.length) return { ok: false, pieces, steps: ['This shortcut skips something other than a bar. Change that obstacle by hand: make it wider, higher or further on.'] };
  const bars = pieces.filter(isHold).sort((a, b) => a.x * Math.cos(lane.angle) + a.z * Math.sin(lane.angle) - (b.x * Math.cos(lane.angle) + b.z * Math.sin(lane.angle)));
  const last = bars[Math.max(...idx)];
  if (!last) return { ok: false, pieces, steps: ['That bar is no longer in the lane.'] };
  const along = Math.cos(lane.angle), across = Math.sin(lane.angle), u = (p: P) => p.x * along + p.z * across, uLast = u(last);
  for (const dx of [0.5, 1, 1.5, 2, 3, 4]) {
    if (performance.now() - t0 > budgetMs) break;
    const next = pieces.map((p) => (u(p) > uLast + 1e-6 && p.id !== last.id ? { ...p, x: p.x + dx * along, z: p.z + dx * across } : p));
    const course = courseFor(next, lane);
    if (!course || !searchIdealRun(course).cleared) continue; // the planned line must still clear
    const r = findShortcuts(course, { onlyIds: [s.id], moveChoices: false });
    if (r.shortcuts.some((x) => x.id === s.id)) continue; // still there
    return { ok: true, pieces: next, steps: [`Moved everything after ${s.skipped.join(' and ')} ${dx} m further on, so the flight over ${s.skipped.length > 1 ? 'them' : 'it'} no longer reaches the far side.`] };
  }
  return { ok: false, pieces, steps: ['I could not find a push that closes it and keeps the planned line clearable. Try moving the bars or the far deck by hand.'] };
}
void holdsOf;
