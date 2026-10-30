// Days in a row you ran a course, kept only in this browser (CC-108). A day is the UTC date, the same day the server uses.
const KEY = 'cc.streak';
const day = (t: number): string => new Date(t).toISOString().slice(0, 10);
const before = (d: string): string => day(Date.parse(`${d}T00:00:00Z`) - 86_400_000);

export interface Streak { last: string; n: number }

/** Pure: the streak after a run on `today`. The same day changes nothing; the next day adds one; a gap starts again at one. */
export function nextStreak(s: Streak | null, today: string): Streak {
  if (s && s.last === today) return s;
  if (s && s.last === before(today)) return { last: today, n: s.n + 1 };
  return { last: today, n: 1 };
}

export function readStreak(now = Date.now(), store: Pick<Storage, 'getItem'> = localStorage): number {
  try {
    const s = JSON.parse(store.getItem(KEY) ?? 'null') as Streak | null;
    return s && (s.last === day(now) || s.last === before(day(now))) ? s.n : 0; // yesterday's streak is still alive until tonight ends
  } catch { return 0; }
}

export function touchStreak(now = Date.now(), store: Pick<Storage, 'getItem' | 'setItem'> = localStorage): void {
  try { store.setItem(KEY, JSON.stringify(nextStreak(JSON.parse(store.getItem(KEY) ?? 'null') as Streak | null, day(now)))); } catch { /* keep going */ }
}
