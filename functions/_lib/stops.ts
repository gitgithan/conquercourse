// The owner can see why a photo was stopped (CC-103): a row with the step, an anonymous player code, the verdict and the reason. No picture is kept.
// It never breaks a request: a missing table or database just means no row. Rows older than 14 days are dropped on each write.
interface Db { prepare(q: string): { bind(...v: unknown[]): { run(): Promise<unknown> } } }
export const STOP_DAYS = 14;
export async function recordStop(db: Db | undefined, route: string, owner: string, verdict: string, reason: string, now = Date.now()): Promise<void> {
  if (!db) return;
  try {
    await db.prepare('INSERT INTO moderation_stops (at, route, owner, verdict, reason) VALUES (?, ?, ?, ?, ?)').bind(Math.floor(now / 1000), route, owner, verdict, reason).run();
    await db.prepare('DELETE FROM moderation_stops WHERE at < ?').bind(Math.floor(now / 1000) - STOP_DAYS * 86400).run();
  } catch { /* a broken log never blocks a player */ }
}
