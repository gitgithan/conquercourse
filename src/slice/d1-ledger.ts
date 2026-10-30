// The upload ledger on D1 (CC-221, CC-108): one row per day and player, plus one total row (player '*') for the whole game.
// A slot is taken by a conditional update, so two requests cannot both take the last one, whichever server answers.
import type { Ledger, Limits } from './upload-gates';

interface Stmt { bind(...v: unknown[]): { run(): Promise<{ meta?: { changes?: number } }> } }
interface Db { prepare(sql: string): Stmt }

const TAKE = 'INSERT INTO upload_days (day, player, n) VALUES (?, ?, 1) ON CONFLICT (day, player) DO UPDATE SET n = n + 1 WHERE n < ?';
const GIVE = 'UPDATE upload_days SET n = n - 1 WHERE day = ? AND player = ? AND n > 0';

export function d1Ledger(db: Db): Ledger {
  const took = async (day: string, player: string, max: number) => ((await db.prepare(TAKE).bind(day, player, max).run()).meta?.changes ?? 0) > 0;
  const give = (day: string, player: string) => db.prepare(GIVE).bind(day, player).run();
  return {
    async take(player, day, limits: Limits) {
      if (!(await took(day, '*', limits.perGame))) return { ok: false, limit: 'game' };
      if (!(await took(day, player, limits.perPlayer))) { await give(day, '*'); return { ok: false, limit: 'player' }; }
      return { ok: true };
    },
    async refund(player, day) { await give(day, player); await give(day, '*'); },
  };
}
