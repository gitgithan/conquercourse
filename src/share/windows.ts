// Board windows (CC-108): non-overlapping, on UTC, so everyone in the world resets at the same moment.
//   day: 00:00 UTC to 00:00 UTC; week: Monday 00:00 UTC to the next Monday; all: never resets.
export type Window = 'day' | 'week' | 'all';
export const WINDOWS: readonly Window[] = ['day', 'week', 'all'];
export const isWindow = (w: string): w is Window => (WINDOWS as readonly string[]).includes(w);

const DAY = 86_400_000;
const midnight = (t: number): number => Math.floor(t / DAY) * DAY;

/** The first moment of the window that holds `now` (ms since 1970), or 0 for all time. */
export function windowStart(w: Window, now: number): number {
  if (w === 'all') return 0;
  const d = midnight(now);
  if (w === 'day') return d;
  const dow = (new Date(d).getUTCDay() + 6) % 7; // Monday = 0
  return d - dow * DAY;
}
/** The first moment of the window before this one (for "yesterday's champion"). */
export const previousStart = (w: Window, now: number): number => windowStart(w, windowStart(w, now) - 1);
/** When this window ends and the board starts again, or null for all time. */
export function nextReset(w: Window, now: number): number | null {
  if (w === 'all') return null;
  return windowStart(w, now) + (w === 'day' ? DAY : 7 * DAY);
}
/** SQLite's text time ("2026-10-30 12:00:00"), the way the tables store ts. */
export const sqlTime = (ms: number): string => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

/** "5 h 12 m", "12 m", "3 d 4 h": how long until the reset, in the two biggest parts. */
export function untilText(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${mm} m`;
  return `${mm} m`;
}
