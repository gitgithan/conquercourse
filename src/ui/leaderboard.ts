// The board of the fastest verified runs on a course, and your own best time (CC-108). Tags are three letters the player chose; no name, no account.
// The server fills the board only from runs it played again with the simulator (functions/api/leaderboard.ts). See docs/challenge.md, Part 4.
import { secondsText } from './course-stats';

export interface BoardRow { nick: string; ticks: number }

/** Build switch for the board: on by default (the owner expects to see it on the Course); ?board=0 hides it. */
export const boardOn = (params: URLSearchParams): boolean => params.get('board') !== '0';

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

const MEDALS = ['🏆', '🥈', '🥉'], TINTS = ['#fff1b8', '#e9edf2', '#f5dcc4'], EDGES = ['#e0b000', '#9aa5b1', '#c27a3a'];
/** The podium: a trophy and a colour for the first three, a number for the rest, your own row outlined and marked. */
export function renderRows(list: HTMLElement, rows: BoardRow[], myRank: number | null = null): void {
  list.replaceChildren(...rows.map((r, i) => {
    const row = document.createElement('div'), podium = i < 3;
    row.className = 'board-row'; row.dataset.rank = String(i + 1);
    row.style.cssText = `display:flex;align-items:center;gap:8px;padding:${podium ? 5 : 3}px 8px;margin:3px 0;border-radius:8px;border:2px solid ${myRank === i + 1 ? '#1a6b3c' : podium ? EDGES[i] : 'transparent'};background:${podium ? TINTS[i] : '#f3f5f4'};font-weight:${podium ? 700 : 500}`;
    const badge = document.createElement('span'); badge.textContent = podium ? MEDALS[i] : String(i + 1); badge.style.cssText = `width:24px;text-align:center;font-size:${podium ? 20 : 12}px;color:#556`;
    const name = document.createElement('span'); name.textContent = (r.nick || 'Ninja') + (myRank === i + 1 ? ' (you)' : ''); name.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    const time = document.createElement('span'); time.textContent = secondsText(r.ticks); time.style.cssText = 'font-variant-numeric:tabular-nums;font-weight:800';
    row.append(badge, name, time);
    return row;
  }));
}

export interface BoardData { top: BoardRow[]; players: number; mine: { rank: number; ticks: number } | null; resetAt: number | null; previous: BoardRow | null }
export type Win = 'day' | 'week' | 'all';
export const WIN_NAMES: Record<Win, string> = { day: 'Today', week: 'This week', all: 'All time' };

export async function loadBoard(key: string, hash: string, win: Win = 'all', me = ''): Promise<BoardData> {
  const empty: BoardData = { top: [], players: 0, mine: null, resetAt: null, previous: null };
  try {
    const res = await fetch(`/api/leaderboard?course=${encodeURIComponent(key)}&hash=${encodeURIComponent(hash)}&window=${win}&me=${encodeURIComponent(me)}`);
    if (!res.ok) return empty;
    const d = await res.json() as Partial<BoardData>;
    return { ...empty, ...d, top: Array.isArray(d.top) ? d.top : [] };
  } catch { return empty; }
}

/** "You are #4 of 37 players", or an invitation when you have no time in this window. */
export const placeText = (d: BoardData): string => d.mine ? `You are #${d.mine.rank} of ${d.players} player${d.players === 1 ? '' : 's'}` : d.players ? `${d.players} player${d.players === 1 ? '' : 's'} so far. Run to get a place.` : 'No time yet. Be the first.';

/** "Resets in 5 h 12 m" (UTC midnight; Monday midnight for the week). All time never resets. */
export function resetText(resetAt: number | null, now = Date.now()): string {
  if (resetAt == null) return '';
  const m = Math.max(0, Math.round((resetAt - now) / 60_000));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
  return `Resets in ${d > 0 ? `${d} d ${h} h` : h > 0 ? `${h} h ${m % 60} m` : `${m} m`}`;
}

/** The box shown in the end report: tabs for the window, the top times, your place, the reset clock, and your best. Empty board: an invitation, never a made-up number. */
export function boardBox(key: string, hash: string, me = ''): HTMLElement {
  const box = document.createElement('div'); box.id = 'report-board';
  box.style.cssText = 'margin:.6em 0;padding:.5em .8em;border:1px solid #556;border-radius:6px;font-size:.9em';
  const tabs = document.createElement('div'); tabs.style.cssText = 'display:flex;gap:.4em;margin-bottom:.3em';
  const list = document.createElement('div'); list.textContent = 'Loading…';
  const place = document.createElement('div'); place.id = 'report-place'; place.style.cssText = 'font-weight:800;color:#fff;background:linear-gradient(90deg,#1a6b3c,#2e9a5a);border-radius:999px;padding:3px 10px;margin-top:4px;display:inline-block';
  const clock = document.createElement('div'); clock.id = 'report-reset'; clock.style.cssText = 'color:#8a5a00;font-size:.85em';
  const champ = document.createElement('div'); champ.id = 'report-champ'; champ.style.cssText = 'color:#555;font-size:.85em';
  const show = (win: Win): void => {
    for (const b of tabs.children) (b as HTMLElement).style.fontWeight = (b as HTMLElement).dataset.win === win ? '700' : '400';
    void loadBoard(key, hash, win, me).then((d) => {
      if (d.top.length) renderRows(list, d.top, d.mine?.rank ?? null); else list.textContent = ''; // the place line below already invites
      place.textContent = placeText(d); clock.textContent = resetText(d.resetAt);
      champ.textContent = d.previous ? `${win === 'day' ? 'Yesterday' : 'Last week'}'s champion: ${d.previous.nick || '···'} ${secondsText(d.previous.ticks)}` : '';
    });
  };
  for (const w of ['day', 'week', 'all'] as Win[]) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.win = w; b.textContent = WIN_NAMES[w]; b.onclick = () => show(w); tabs.appendChild(b);
  }
  const head = document.createElement('div'); head.textContent = 'Fastest runs'; head.style.fontWeight = '600';
  box.append(head, tabs, list, place, clock, champ);
  const mine = readBest(key, hash);
  if (mine) { const m = document.createElement('div'); m.id = 'report-best'; m.textContent = `⭐ Your best: ${secondsText(mine)}`; m.style.cssText = 'font-weight:800;color:#7a5a00;background:#fff1b8;border-radius:999px;padding:3px 10px;margin-top:4px;display:inline-block'; box.appendChild(m); }
  show('day');
  return box;
}

/** The board on the Course itself: a small card on the right, under the buttons, open from the start, that folds to a pill so it never covers the run. */
export function boardCorner(key: string, hash: string, me = ''): HTMLElement {
  const card = document.createElement('div'); card.id = 'board-corner';
  card.style.cssText = 'position:fixed;right:16px;top:284px;z-index:30;width:250px;background:#fffffff2;border:1px solid #cfd6d0;border-radius:12px;box-shadow:0 4px 16px #0003;font:500 13px system-ui,sans-serif;color:#17201d';
  const toggle = document.createElement('button'); toggle.type = 'button'; toggle.id = 'board-toggle';
  toggle.style.cssText = 'width:100%;text-align:left;border:0;background:transparent;font:700 14px system-ui,sans-serif;padding:8px 12px;cursor:pointer';
  const makeBody = (): HTMLElement => { const b = boardBox(key, hash, me); b.style.margin = '0'; b.style.border = '0'; b.style.padding = '0 12px 10px'; (b.firstElementChild as HTMLElement).style.display = 'none'; return b; }; // the pill is the title
  let body = makeBody();
  const fold = (open: boolean): void => { body.style.display = open ? '' : 'none'; toggle.textContent = `${open ? '▾' : '▸'} Fastest runs`; toggle.setAttribute('aria-expanded', String(open)); };
  toggle.onclick = () => fold(body.style.display === 'none');
  card.append(toggle, body); fold(true);
  // after a run is sent the server needs a moment to replay it: the card asks again, keeping its open or folded state
  card.addEventListener('board-refresh', () => { const open = body.style.display !== 'none'; const next = makeBody(); body.replaceWith(next); body = next; fold(open); });
  return card;
}
