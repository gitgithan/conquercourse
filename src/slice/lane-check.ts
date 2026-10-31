// CC-243: what the World Editor's lane check is doing, as plain states the page can show (idle, searching, done, cancelled, timed out).
// No browser and no worker in here: the editor feeds it the clock and the worker's progress, and draws what it says.

export const LANE_CAP_MS = 180_000; // a search that runs this long is stopped and said so honestly

export interface LaneProgress { label: string; step: number; of: number }

export type LaneState =
  | { kind: 'idle' }
  | { kind: 'searching'; startedAt: number; progress: LaneProgress | null }
  | { kind: 'done'; cleared: boolean }
  | { kind: 'cancelled' }
  | { kind: 'timeout' };

export const IDLE: LaneState = { kind: 'idle' };

export const begin = (now: number): LaneState => ({ kind: 'searching', startedAt: now, progress: null });
export const withProgress = (s: LaneState, p: LaneProgress): LaneState => (s.kind === 'searching' ? { ...s, progress: p } : s);
export const finish = (s: LaneState, cleared: boolean): LaneState => (s.kind === 'searching' ? { kind: 'done', cleared } : s); // a late answer never overrides Stopped or Timed out
export const cancel = (s: LaneState): LaneState => (s.kind === 'searching' ? { kind: 'cancelled' } : s);
/** The clock moved on: a search past the cap becomes Timed out. */
export const tick = (s: LaneState, now: number): LaneState => (s.kind === 'searching' && now - s.startedAt >= LANE_CAP_MS ? { kind: 'timeout' } : s);
/** Any edit throws the old verdict away: a new check starts only after the edit pause. */
export const edited = (): LaneState => IDLE;

export const isSearching = (s: LaneState): boolean => s.kind === 'searching';
export const isStopped = (s: LaneState): boolean => s.kind === 'cancelled' || s.kind === 'timeout';

const seconds = (ms: number): number => Math.max(0, Math.floor(ms / 1000));

/** The one line under the bar while searching (plain words). */
export function progressText(s: LaneState, now: number): string {
  if (s.kind !== 'searching') return '';
  const secs = seconds(now - s.startedAt);
  const so = `${secs} ${secs === 1 ? 'second' : 'seconds'} so far`;
  const p = s.progress;
  return p ? `Searching for a way through: step ${p.step} of ${p.of}, ${so}` : `Searching for a way through: ${so}`;
}

/** How full the bar is, 0 to 1; null when the search has not reported a measure (the bar then just moves). */
export const barFraction = (s: LaneState): number | null => (s.kind === 'searching' && s.progress && s.progress.of > 0 ? Math.min(1, Math.max(0, s.progress.step / s.progress.of)) : null);

/** The final state in a word, and the sentence that goes with it. */
export function finalText(s: LaneState): { word: string; line: string } | null {
  switch (s.kind) {
    case 'done': return s.cleared ? { word: 'Clears', line: 'Clears: the simulator found a way through.' } : { word: "Can't clear", line: "Can't clear: the simulator found no way through. Widen a gap or lower a step." };
    case 'cancelled': return { word: 'Stopped', line: 'Stopped: this lane is not checked. Edit it, or press Check again.' };
    case 'timeout': return { word: 'Timed out', line: `Timed out after ${LANE_CAP_MS / 60000} minutes: this lane is not checked. It may still be clearable. You can play it anyway.` };
    default: return null;
  }
}
