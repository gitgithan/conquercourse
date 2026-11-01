// Plain-words analytics (CC-108): where visits come from, a funnel, and how long the rented services took. Table: migrations/0019_analytics.sql.
// Nothing here stores an address, a name or a full link. Every function is best effort and never throws.
// The switch is the flag "analytics" (a missing row or an unreadable table means ON, the opposite of the paid routes, because this only counts).
interface Stmt { bind(...v: unknown[]): { run(): Promise<unknown>; first<T>(): Promise<T | null> } }
export interface AnalyticsDb { prepare(sql: string): Stmt }

export const STEPS = ['landed', 'start_run', 'cleared', 'used_slicer', 'used_editor', 'used_dojo', 'used_lab', 'shared_piece'] as const;
export type Step = (typeof STEPS)[number];
export const isStep = (s: unknown): s is Step => typeof s === 'string' && (STEPS as readonly string[]).includes(s);
export const SERVICES = ['segment', 'object-lift', 'character', 'safety-check'] as const;
export const COLD_AFTER_MS = 10 * 60_000;

/** A tag from ?ref=: lower case, letters, digits, dash and underscore, at most 24 characters; anything else is dropped. */
export const normRef = (raw: unknown): string => String(raw ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);

const HOSTS: [RegExp, string][] = [
  [/(^|\.)reddit\.com$|(^|\.)redd\.it$/, 'reddit'], [/(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/, 'linkedin'], [/(^|\.)(x|twitter)\.com$|(^|\.)t\.co$/, 'x'],
  [/(^|\.)google\.[a-z.]{2,6}$/, 'google'], [/(^|\.)ycombinator\.com$/, 'hn'], [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
];
/** The page that sent the visit, reduced to one word from its host only. Our own site and an empty referrer are "direct". */
export function refFromReferrer(referrer: string, ownHost = ''): string {
  let host = '';
  try { host = new URL(referrer).hostname.toLowerCase(); } catch { return 'direct'; }
  if (!host || host === ownHost || (host.endsWith('.pages.dev') && host.includes('conquercourse'))) return 'direct';
  return HOSTS.find(([re]) => re.test(host))?.[1] ?? 'other';
}
/** The tag for this visit: automation is "test", then ?ref=, then the referrer word. */
export function pickRef(search: string, referrer: string, webdriver: boolean, ownHost = ''): string {
  if (webdriver) return 'test';
  return normRef(new URLSearchParams(search).get('ref')) || refFromReferrer(referrer, ownHost);
}

export async function analyticsOn(db: AnalyticsDb | undefined): Promise<boolean> {
  if (!db) return false;
  try { const r = await db.prepare('SELECT on_ FROM flags WHERE name = ?').bind('analytics').first<{ on_: number }>(); return r ? Number(r.on_) !== 0 : true; } catch { return true; }
}

const day = (now: number) => new Date(now).toISOString().slice(0, 10);

/** One funnel step for one visitor code and day; a repeat the same day is ignored by the unique index. Returns false when nothing was written. */
export async function recordStep(db: AnalyticsDb | undefined, o: { session: string; step: unknown; ref?: unknown; country?: string; now?: number }): Promise<boolean> {
  try {
    if (!db || !isStep(o.step) || !/^[a-zA-Z0-9-]{8,64}$/.test(o.session) || !(await analyticsOn(db))) return false;
    const now = o.now ?? Date.now();
    await db.prepare("INSERT OR IGNORE INTO analytics_events (ts, day, kind, name, session, ref, country) VALUES (?, ?, 'step', ?, ?, ?, ?)")
      .bind(new Date(now).toISOString(), day(now), o.step, o.session, normRef(o.ref) || 'direct', String(o.country ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2)).run();
    return true;
  } catch { return false; }
}

/** Which service a call went to: by host, else the route's own default. */
export function classify(url: string, fallback: string): string {
  try { const h = new URL(url).hostname; if (h.endsWith('baseten.co')) return 'safety-check'; } catch { /* not a link */ }
  return fallback;
}

export interface Wait { service: string; ms: number; ok: boolean }
/** Wraps a fetcher and remembers how long each call took; call flush(db) after the answer is ready. No content, no ids, no link is kept. */
export function waitTimer(fallback: string, inner: typeof fetch = fetch, clock: () => number = Date.now) {
  const waits: Wait[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const t0 = clock(), service = classify(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, fallback);
    try { const res = await inner(input, init); waits.push({ service, ms: clock() - t0, ok: res.ok }); return res; }
    catch (e) { waits.push({ service, ms: clock() - t0, ok: false }); throw e; }
  }) as typeof fetch;
  /** Cold = no earlier row for the service, or the last one is older than ten minutes. */
  const flush = async (db: AnalyticsDb | undefined, now = Date.now()): Promise<number> => {
    let n = 0;
    try {
      if (!db || !waits.length || !(await analyticsOn(db))) return 0;
      for (const w of waits.splice(0)) {
        const last = await db.prepare("SELECT MAX(ts) AS ts FROM analytics_events WHERE kind = 'wait' AND name = ?").bind(w.service).first<{ ts: string | null }>();
        const cold = !last?.ts || now - Date.parse(last.ts) > COLD_AFTER_MS ? 1 : 0;
        await db.prepare("INSERT INTO analytics_events (ts, day, kind, name, ms, ok, cold) VALUES (?, ?, 'wait', ?, ?, ?, ?)").bind(new Date(now).toISOString(), day(now), w.service, Math.max(0, Math.round(w.ms)), w.ok ? 1 : 0, cold).run();
        n++;
      }
    } catch { /* counting must never break a request */ }
    return n;
  };
  return { fetcher, flush, waits };
}

/** Nearest-rank percentile of a list of numbers; null for an empty list. */
export function pct(values: number[], p: number): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))];
}
