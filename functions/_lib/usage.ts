// Usage counting and instant feature switches for the paid routes (CC-103, CC-118). Tables: migrations/0016_usage_and_flags.sql.
//   recordUsage: one upsert per successful paid call; best effort, never throws, never holds a request for long.
//   featureOn:   reads the switch on every request; FAILS CLOSED (false) when the table or the read fails.
// The database and the clock are passed in, so tests need no network.
interface Stmt { bind(...v: unknown[]): { run(): Promise<unknown>; first<T>(): Promise<T | null> } }
export interface UsageDb { prepare(sql: string): Stmt }

export const CATEGORIES = ['photo3d', 'segment', 'character', 'agent', 'tips', 'moderation', 'community_share'] as const;
export type Category = (typeof CATEGORIES)[number];
export const isCategory = (s: unknown): s is Category => typeof s === 'string' && (CATEGORIES as readonly string[]).includes(s);

/** ROUGH ESTIMATES of what one call costs, in US cents. Not billing: the real numbers are on each provider's own page. Edit when prices change. */
export const PRICE_CENTS: Record<Category, number> = {
  photo3d: 8, // one photo-to-3D job on a rented GPU
  segment: 2, // one outline-finder job on a rented GPU
  character: 10, // one character job
  agent: 1, // one Course Agent turn
  tips: 0.5, // one move tip
  moderation: 0.3, // one safety check
  community_share: 0.1, // one stored share (database only)
};

export const LABELS: Record<Category, string> = {
  photo3d: 'Photo to 3D object', segment: 'Outline finder', character: 'Character maker', agent: 'Course Agent',
  tips: 'Move tips', moderation: 'Safety check', community_share: 'Community shares and challenge courses',
};

export const utcDay = (now: number): string => new Date(now).toISOString().slice(0, 10);

const UPSERT = 'INSERT INTO usage_events (day, category, calls, created, est_cents) VALUES (?, ?, 1, ?, ?) ON CONFLICT (day, category) DO UPDATE SET calls = calls + 1, created = created + excluded.created, est_cents = est_cents + excluded.est_cents';
const WAIT_MS = 1500;

/** Count one successful paid call. Never throws; a slow or broken database costs the player nothing. */
export async function recordUsage(db: UsageDb | undefined, category: Category, o: { created?: number; now?: number } = {}): Promise<boolean> {
  if (!db) return false;
  try {
    const write = db.prepare(UPSERT).bind(utcDay(o.now ?? Date.now()), category, o.created ?? 0, PRICE_CENTS[category]).run();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<never>((_, no) => { timer = setTimeout(() => no(new Error('slow')), WAIT_MS); });
    try { await Promise.race([write, late]); } finally { clearTimeout(timer); }
    return true;
  } catch { return false; }
}

/** Is this switch on? A missing row means on, but only when the table can be read; any error, or no database, means off. */
export async function featureOn(db: UsageDb | undefined, name: string): Promise<boolean> {
  if (!db) return false;
  try {
    const row = await db.prepare('SELECT on_ FROM flags WHERE name = ?').bind(name).first<{ on_: number }>();
    return row ? Number(row.on_) !== 0 : true;
  } catch { return false; }
}

/** The plain words of a switched-off feature. */
export const offWords = (category: Category): string => `${LABELS[category]} is switched off for now. Please try again later.`;
