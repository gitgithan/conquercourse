// The board of the fastest verified runs on a course, and your own best time (CC-108). Tags are three letters the player chose; no name, no account.
// The server fills the board only from runs it played again with the simulator (functions/api/leaderboard.ts). See docs/challenge.md, Part 4.
import { secondsText } from './course-stats';

export interface BoardRow { nick: string; ticks: number }

/** Build switch for the board: ?board=1 shows it while it is new. */
export const boardOn = (params: URLSearchParams): boolean => params.get('board') === '1';

/** Your best time on one version of a course, kept only in this browser. Returns the best now and whether this run set a new one. */
export function rememberBest(key: string, hash: string, ticks: number, store: Pick<Storage, 'getItem' | 'setItem'> = localStorage): { best: number; isNew: boolean } {
  const k = `cc.best.${key}.${hash}`;
  let old = 0;
  try { old = Number(store.getItem(k)) || 0; } catch { /* keep going */ }
  if (old > 0 && old <= ticks) return { best: old, isNew: false };
  try { store.setItem(k, String(ticks)); } catch { /* keep going */ }
  return { best: ticks, isNew: true };
}
export function readBest(key: string, hash: string, store: Pick<Storage, 'getItem'> = localStorage): number | null {
  try { return Number(store.getItem(`cc.best.${key}.${hash}`)) || null; } catch { return null; }
}

/** One line per place: "1  ABC  41.2 s". A row with no tag shows three dots. */
export function boardLines(rows: BoardRow[]): string[] {
  return rows.map((r, i) => `${i + 1}  ${r.nick || '···'}  ${secondsText(r.ticks)}`);
}

export async function loadBoard(key: string, hash: string): Promise<BoardRow[]> {
  try {
    const res = await fetch(`/api/leaderboard?course=${encodeURIComponent(key)}&hash=${encodeURIComponent(hash)}`);
    if (!res.ok) return [];
    const d = await res.json() as { top?: BoardRow[] };
    return Array.isArray(d.top) ? d.top : [];
  } catch { return []; }
}

/** The box shown in the end report: the top times, then your best. Empty board: an invitation, never a made-up number. */
export function boardBox(key: string, hash: string): HTMLElement {
  const box = document.createElement('div'); box.id = 'report-board';
  box.style.cssText = 'margin:.6em 0;padding:.5em .8em;border:1px solid #556;border-radius:6px;font-size:.9em';
  const head = document.createElement('div'); head.textContent = 'Fastest runs'; head.style.fontWeight = '600'; box.appendChild(head);
  const list = document.createElement('div'); list.style.cssText = 'font-family:monospace;white-space:pre'; list.textContent = 'Loading…'; box.appendChild(list);
  const mine = readBest(key, hash);
  if (mine) { const m = document.createElement('div'); m.id = 'report-best'; m.textContent = `Your best: ${secondsText(mine)}`; box.appendChild(m); }
  void loadBoard(key, hash).then((rows) => { list.textContent = rows.length ? boardLines(rows).join('\n') : 'No time yet. Be the first.'; });
  return box;
}
