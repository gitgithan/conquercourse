// Daily slots for photo -> 3D object (CC-221, CC-108): how many lifts one player and the whole game may start in a day.
// Pure and small. The Ledger is an interface so the same gates run on an in-memory counter (tests, preview) and later on D1
// (one row per day, one conditional update; see docs/object-catalogue.md "Budgets") without changing the gate order.
export interface Limits { perPlayer: number; perGame: number }
export const DEFAULT_LIMITS: Limits = { perPlayer: 3, perGame: 100 };

export interface Ledger {
  /** Take one slot for `player` on `day` ("YYYY-MM-DD"). Reports which limit stopped it, or ok. All-or-nothing. */
  take(player: string, day: string, limits: Limits): Promise<{ ok: true } | { ok: false; limit: 'player' | 'game' }>;
  /** Give a slot back when the job never started. */
  refund(player: string, day: string): Promise<void>;
}

export function memoryLedger(): Ledger {
  const players = new Map<string, number>();
  const games = new Map<string, number>();
  return {
    async take(player, day, limits) {
      const k = `${day}|${player}`;
      if ((games.get(day) ?? 0) >= limits.perGame) return { ok: false, limit: 'game' };
      if ((players.get(k) ?? 0) >= limits.perPlayer) return { ok: false, limit: 'player' };
      players.set(k, (players.get(k) ?? 0) + 1); games.set(day, (games.get(day) ?? 0) + 1);
      return { ok: true };
    },
    async refund(player, day) {
      const k = `${day}|${player}`;
      players.set(k, Math.max(0, (players.get(k) ?? 0) - 1)); games.set(day, Math.max(0, (games.get(day) ?? 0) - 1));
    },
  };
}

export const utcDay = (now: number): string => new Date(now).toISOString().slice(0, 10);

// the plain sentences the page shows come from src/slice/stages.ts (refusalWords), which adds the clock time; these are the fallback in the body
export const LIMIT_WORDS = {
  player: 'You have used all of your 3D pieces for today.',
  game: "Everyone together has used up today's 3D pieces.",
} as const;
