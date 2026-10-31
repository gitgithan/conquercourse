// The D1 side of challenge courses (CC-108): one store, used by /api/challenge-course and by /api/course-clear (which promotes a course). The rules are in src/share/challenge-course.ts.
import type { ChallengeRow, ChallengeStore } from '../../src/share/challenge-course';

interface Stmt { bind(...v: unknown[]): { run(): Promise<unknown>; first<T>(): Promise<T | null>; all?(): Promise<{ results: unknown[] }> } }
export interface Db { prepare(sql: string): Stmt }

const COLS = ['id', 'content_hash', 'board_hash', 'name', 'course', 'author', 'author_ticks', 'created_at', 'promoted_at', 'expires_at'] as const;

export function d1Challenges(db: Db): ChallengeStore {
  return {
    byContentHash: (h) => db.prepare('SELECT * FROM challenge_courses WHERE content_hash = ?').bind(h).first<ChallengeRow>(),
    get: (id) => db.prepare('SELECT * FROM challenge_courses WHERE id = ?').bind(id).first<ChallengeRow>(),
    insert: async (r) => {
      try { await db.prepare(`INSERT INTO challenge_courses (${COLS.join(', ')}) VALUES (${COLS.map(() => '?').join(', ')})`).bind(...COLS.map((c) => r[c])).run(); return true; }
      catch (e) { if (/UNIQUE|constraint/i.test(String(e)) && !/content_hash/.test(String(e))) return false; throw e; }
    },
    createdBySince: async (a, t) => (await db.prepare('SELECT COUNT(*) AS n FROM challenge_courses WHERE author = ? AND created_at > ?').bind(a, t).first<{ n: number }>())?.n ?? 0,
    liveUnpromoted: async (now) => (await db.prepare('SELECT COUNT(*) AS n FROM challenge_courses WHERE promoted_at IS NULL AND expires_at > ?').bind(now).first<{ n: number }>())?.n ?? 0,
    purgeExpired: async (now) => {
      await db.prepare("DELETE FROM course_clears WHERE course_key IN (SELECT 'challenge/' || id FROM challenge_courses WHERE promoted_at IS NULL AND expires_at <= ?)").bind(now).run();
      await db.prepare('DELETE FROM challenge_courses WHERE promoted_at IS NULL AND expires_at <= ?').bind(now).run();
    },
    promote: async (id, now) => { await db.prepare('UPDATE challenge_courses SET promoted_at = ?, expires_at = NULL WHERE id = ? AND promoted_at IS NULL').bind(now, id).run(); },
    addClear: async (id, boardHash, ticks, runId, logHash, player) => {
      await db.prepare("INSERT OR IGNORE INTO course_clears (ts, course_key, course_hash, ticks, run_id, log_hash, verified, player) VALUES (datetime('now'), ?, ?, ?, ?, ?, 1, ?)").bind(`challenge/${id}`, boardHash, ticks, runId, logHash, player).run();
    },
    community: async (_now, limit) => {
      const q = db.prepare(`SELECT c.id AS id, c.name AS name,
        (SELECT COUNT(DISTINCT NULLIF(k.player, '')) FROM course_clears k WHERE k.course_key = 'challenge/' || c.id AND k.verified = 1) AS players,
        (SELECT MIN(k.ticks) FROM course_clears k WHERE k.course_key = 'challenge/' || c.id AND k.verified = 1) AS bestTicks
        FROM challenge_courses c WHERE c.promoted_at IS NOT NULL ORDER BY c.promoted_at DESC LIMIT ?`).bind(limit);
      return ((await q.all?.())?.results ?? []) as { id: string; name: string; players: number; bestTicks: number | null }[];
    },
  };
}
