// A real SQLite database (node:sqlite) wearing D1's face, so the endpoints are tested against real SQL and the real migrations.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

/** upTo: the last migration to apply, e.g. '0003' for the database as it is live before CC-174's migration. */
export function localD1(upTo = '9999') {
  const sql = new DatabaseSync(':memory:');
  for (const f of readdirSync('migrations').sort().filter((f) => f.slice(0, 4) <= upTo)) sql.exec(readFileSync(`migrations/${f}`, 'utf8'));
  const db = {
    prepare: (q: string) => {
      const make = (v: unknown[]) => ({
        run: async () => { sql.prepare(q).run(...(v as never[])); return {}; },
        first: async <T>() => (sql.prepare(q).get(...(v as never[])) as T | undefined) ?? null,
        all: async () => ({ results: sql.prepare(q).all(...(v as never[])) as Record<string, unknown>[] }),
      });
      return { ...make([]), bind: (...v: unknown[]) => make(v) };
    },
  };
  return { db, sql };
}

/** The static files of the site, read from public/ the way env.ASSETS would answer. */
export const assets = { fetch: async (url: string) => {
  try { return new Response(readFileSync(`public${new URL(url).pathname}`, 'utf8')); } catch { return new Response('no', { status: 404 }); }
} };
