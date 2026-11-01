// Daily growth numbers (CC-108): one count per UTC day for each thing worth watching.
// Pure helpers, shared by the Pages Function that reads D1 and the strip on the course picker. Counts only: no person, name or address.

export const METRICS = ['players', 'runs', 'assets', 'clears'] as const;
export type Metric = (typeof METRICS)[number];
export const METRIC_WORDS: Record<Metric, { menu: string; chip: string; one: string }> = {
  players: { menu: 'Players', chip: 'players so far', one: 'player so far' },
  runs: { menu: 'Runs', chip: 'runs so far', one: 'run so far' },
  assets: { menu: 'Assets made', chip: 'assets made so far', one: 'asset made so far' },
  clears: { menu: 'Courses cleared', chip: 'cleared so far', one: 'cleared so far' },
};

export interface DailyStats { days: string[]; series: Record<Metric, number[]>; totals?: Partial<Record<Metric, number>> } // totals: all time, no start day (players = different browser codes, so a returning player counts once); every series has one number per day, oldest first
export type Range = '7' | '30' | 'all';
export const MAX_DAYS = 365;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
export const utcDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Every UTC day from `from` to `to`, both included (at most MAX_DAYS, the newest ones). */
export function dayList(from: string, to: string): string[] {
  const a = Date.parse(`${from}T00:00:00Z`), b = Date.parse(`${to}T00:00:00Z`);
  if (!DAY.test(from) || !DAY.test(to) || !(b >= a)) return [to];
  const n = Math.min(MAX_DAYS, Math.round((b - a) / DAY_MS) + 1);
  return Array.from({ length: n }, (_, i) => utcDay(b - (n - 1 - i) * DAY_MS));
}

/** Rows from D1 ({ d: '2026-10-31', n: 12 }) into one number per listed day; a day with no row is 0, a row outside the list or with a bad day is dropped. */
export function zeroFill(days: string[], rows: { d: unknown; n: unknown }[]): number[] {
  const at = new Map(days.map((d, i) => [d, i]));
  const out = days.map(() => 0);
  for (const r of rows) {
    const i = at.get(String(r.d));
    const n = Number(r.n);
    if (i !== undefined && Number.isFinite(n) && n > 0) out[i] += Math.round(n);
  }
  return out;
}

/** The last 7 or 30 days, or all of them. */
export function sliceRange(d: DailyStats, range: Range): DailyStats {
  const n = range === 'all' ? d.days.length : Math.min(d.days.length, Number(range));
  const cut = <T,>(xs: T[]): T[] => xs.slice(xs.length - n);
  return { days: cut(d.days), series: { players: cut(d.series.players), runs: cut(d.series.runs), assets: cut(d.series.assets), clears: cut(d.series.clears) } };
}

/** Nothing happened on any day yet. */
export const isEmpty = (d: DailyStats | null): boolean => !d || METRICS.every((m) => d.series[m].every((x) => x === 0));

/** The chart's y limit: a round number just above the biggest value, so the labels read "5", "10", "50", "100". */
export function niceMax(max: number): number {
  if (max <= 1) return 1;
  const p = 10 ** Math.floor(Math.log10(max)), f = max / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

/** Points for a polyline in a w x h box (y grows downwards); one day alone is drawn as a flat line. */
export function linePoints(xs: number[], w: number, h: number, top = niceMax(Math.max(...xs, 0))): string {
  const step = xs.length > 1 ? w / (xs.length - 1) : 0;
  return xs.map((x, i) => `${(i * step).toFixed(1)},${(h - (x / top) * h).toFixed(1)}`).join(' ');
}
