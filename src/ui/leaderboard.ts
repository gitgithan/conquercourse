// The board of the fastest verified runs on a course, and your own best time (CC-108). Tags are three letters the player chose; no name, no account.
// The server fills the board only from runs it played again with the simulator (functions/api/leaderboard.ts). See docs/challenge.md, Part 4.
import { secondsText } from './course-stats';
import { nickOk, tidyNick } from '../share/nick';

export interface BoardRow { id?: number; nick: string; ticks: number }

/** What the board card can do beyond showing times: open a row (View Run) and publish the run just finished (CC-108). */
export interface BoardHooks {
  onView?: (row: BoardRow) => void;
  publish?: { ticks: number; send: (nick: string) => Promise<{ published: boolean; rank?: number | null; players?: number; nick?: string; why?: string; error?: string }> };
}

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
export function renderRows(list: HTMLElement, rows: BoardRow[], myRank: number | null = null, onView?: (row: BoardRow) => void): void {
  list.replaceChildren(...rows.map((r, i) => {
    const row = document.createElement('div'), podium = i < 3;
    row.className = 'board-row'; row.dataset.rank = String(i + 1);
    row.style.cssText = `display:flex;align-items:center;gap:8px;padding:${podium ? 5 : 3}px 8px;margin:3px 0;border-radius:8px;border:2px solid ${myRank === i + 1 ? '#1a6b3c' : podium ? EDGES[i] : 'transparent'};background:${podium ? TINTS[i] : '#f3f5f4'};font-weight:${podium ? 700 : 500}`;
    const badge = document.createElement('span'); badge.textContent = podium ? MEDALS[i] : String(i + 1); badge.style.cssText = `width:24px;text-align:center;font-size:${podium ? 20 : 12}px;color:#556`;
    const name = document.createElement('span'); name.textContent = (r.nick || 'Ninja') + (myRank === i + 1 ? ' (you)' : ''); name.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    const time = document.createElement('span'); time.textContent = secondsText(r.ticks); time.style.cssText = 'font-variant-numeric:tabular-nums;font-weight:800';
    row.append(badge, name, time);
    if (onView && r.id) { const v = document.createElement('button'); v.type = 'button'; v.className = 'board-view'; v.textContent = 'View Run'; v.title = 'See where this run went, and race it'; v.style.cssText = 'font:600 11px system-ui,sans-serif;border:1px solid #556;border-radius:6px;background:#fff;padding:1px 6px;cursor:pointer'; v.onclick = () => onView(r); row.append(v); }
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

const pubKey = (key: string, hash: string): string => `cc.pub.${key}.${hash}`;
/** What the board boxes hear when a run was just published: the new row, shown at once; then each box asks the server again. */
export interface Published { nick: string; ticks: number; rank: number | null; players: number | null }
export const PUBLISHED_EVENT = 'board-published';

/** The name box and the Publish to Leaderboard button, one strip at the top of the end report next to the result. It is the only place the name is typed. A run goes on the board only when the button is clicked. */
export function publishStrip(spec: NonNullable<BoardHooks['publish']>, key: string, hash: string, blocked?: string): HTMLElement {
  const row = document.createElement('div'); row.id = 'report-publish'; row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:#e9f5f1;border-left:4px solid #0f6b5c;border-radius:8px;padding:8px 10px';
  const nick = document.createElement('input'); nick.id = 'publish-nick'; nick.maxLength = 12; nick.size = 12; nick.placeholder = 'NAME'; nick.autocomplete = 'off'; nick.spellcheck = false; nick.setAttribute('aria-label', 'Name for the leaderboard');
  nick.title = 'Up to 12 letters (any case), digits or symbols, no spaces. It shows on the leaderboard and in your challenge link. Not your real name.';
  nick.style.cssText = 'font:inherit;font-weight:700;border:1px solid #17201d;border-radius:8px;padding:6px 8px;width:9em;text-align:center';
  try { nick.value = tidyNick(localStorage.getItem('cc.nick') ?? ''); } catch { /* keep going */ }
  nick.oninput = () => { nick.value = tidyNick(nick.value); try { localStorage.setItem('cc.nick', nick.value); } catch { /* keep going */ } };
  const go = document.createElement('button'); go.type = 'button'; go.id = 'publish-board'; go.textContent = `Publish to Leaderboard (${secondsText(spec.ticks)})`;
  go.style.cssText = 'font:inherit;font-weight:800;border:1px solid #17201d;border-radius:8px;padding:6px 14px;background:#0f6b5c;color:#fff;cursor:pointer';
  const out = document.createElement('div'); out.id = 'publish-result'; out.style.cssText = 'font-weight:700;flex-basis:100%;font-size:.9em'; out.setAttribute('role', 'status');
  const note = document.createElement('div'); note.style.cssText = 'flex-basis:100%;font-size:.85em;color:#44504a'; note.textContent = 'Your name shows on the leaderboard next to this time. Not your real name.';
  const done = (as: string, r: { rank?: number | null; players?: number }): void => {
    go.textContent = `Published ✓ as ${as}${r.rank ? `, #${r.rank}${r.players ? ` of ${r.players}` : ''}` : ''}`; go.disabled = true; go.style.background = '#e6f4ee'; go.style.color = '#0f6b5c'; go.style.cursor = 'default';
    nick.disabled = true; out.textContent = ''; note.style.display = 'none';
  };
  if (blocked) { go.disabled = true; go.style.opacity = '.55'; go.style.cursor = 'not-allowed'; go.title = blocked; out.textContent = blocked; note.style.display = 'none'; row.append(nick, go, out); return row; } // the run cannot qualify: say why next to the button, up front
  let prior = 0; try { prior = Number(localStorage.getItem(pubKey(key, hash))) || 0; } catch { /* keep going */ }
  if (prior > 0 && prior <= spec.ticks) { go.style.display = 'none'; note.textContent = `Your published time is ${secondsText(prior)}. A faster run can replace it.`; row.append(nick, note); return row; }
  go.onclick = () => {
    if (!nickOk(nick.value)) { out.textContent = 'Pick another name.'; return; }
    go.disabled = true; out.textContent = 'Sending…';
    void spec.send(nick.value).then((r) => {
      if (r.published) {
        try { localStorage.setItem(pubKey(key, hash), String(spec.ticks)); } catch { /* keep going */ }
        const as = r.nick || 'Ninja';
        done(as, r);
        document.dispatchEvent(new CustomEvent<Published>(PUBLISHED_EVENT, { detail: { nick: r.nick ?? '', ticks: spec.ticks, rank: r.rank ?? null, players: r.players ?? null } }));
      } else { go.disabled = false; out.textContent = r.why === 'slower' ? 'You already have a faster time on the board.' : r.error ?? 'Not published.'; }
    });
  };
  row.append(nick, go, note, out);
  return row;
}

/** The box shown in the end report: tabs for the window, the top times, your place, the reset clock, and your best. Empty board: an invitation, never a made-up number. */
export function boardBox(key: string, hash: string, me = '', hooks: BoardHooks = {}): HTMLElement {
  const box = document.createElement('div'); box.id = 'report-board';
  box.style.cssText = 'margin:.6em 0;padding:.5em .8em;border:1px solid #556;border-radius:6px;font-size:.9em';
  const tabs = document.createElement('div'); tabs.style.cssText = 'display:flex;gap:.4em;margin-bottom:.3em';
  const list = document.createElement('div'); list.textContent = 'Loading…'; list.style.cssText = 'max-height:240px;overflow-y:auto'; // the top hundred scroll
  const place = document.createElement('div'); place.id = 'report-place'; place.style.cssText = 'font-weight:800;color:#fff;background:linear-gradient(90deg,#1a6b3c,#2e9a5a);border-radius:999px;padding:3px 10px;margin-top:4px;display:inline-block';
  const clock = document.createElement('div'); clock.id = 'report-reset'; clock.style.cssText = 'color:#8a5a00;font-size:.85em';
  const champ = document.createElement('div'); champ.id = 'report-champ'; champ.style.cssText = 'color:#555;font-size:.85em';
  let shown: Win = 'day', data: BoardData | null = null;
  const show = (win: Win): void => {
    shown = win;
    for (const b of tabs.children) (b as HTMLElement).style.fontWeight = (b as HTMLElement).dataset.win === win ? '700' : '400';
    void loadBoard(key, hash, win, me).then((d) => {
      data = d;
      if (d.top.length) renderRows(list, d.top, d.mine?.rank ?? null, hooks.onView); else list.textContent = ''; // the place line below already invites
      place.textContent = placeText(d); clock.textContent = resetText(d.resetAt);
      champ.textContent = d.previous ? `${win === 'day' ? 'Yesterday' : 'Last week'}'s champion: ${d.previous.nick || '···'} ${secondsText(d.previous.ticks)}` : '';
    });
  };
  for (const w of ['day', 'week', 'all'] as Win[]) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.win = w; b.textContent = WIN_NAMES[w]; b.onclick = () => show(w); tabs.appendChild(b);
  }
  const head = document.createElement('div'); head.textContent = 'Fastest runs'; head.style.fontWeight = '600';
  box.append(head, tabs, list, place, clock, champ);
  // a run was just published: put the new row in the list at once, then ask the server for the real board
  const onPublished = (e: Event): void => {
    if (!box.isConnected) { document.removeEventListener(PUBLISHED_EVENT, onPublished); return; }
    const p = (e as CustomEvent<Published>).detail, d = data ?? { top: [], players: 0, mine: null, resetAt: null, previous: null };
    const rest = d.top.filter((_, i) => i + 1 !== d.mine?.rank), top = [...rest, { nick: p.nick, ticks: p.ticks }].sort((x, y) => x.ticks - y.ticks).slice(0, 100);
    const rank = p.rank ?? top.findIndex((r) => r.ticks === p.ticks && r.nick === p.nick) + 1;
    renderRows(list, top, rank, hooks.onView); place.textContent = placeText({ ...d, mine: { rank, ticks: p.ticks }, players: p.players ?? d.players + (d.mine ? 0 : 1) });
    show(shown);
  };
  document.addEventListener(PUBLISHED_EVENT, onPublished);
  const mine = readBest(key, hash);
  if (mine) { const m = document.createElement('div'); m.id = 'report-best'; m.textContent = `⭐ Your best: ${secondsText(mine)}`; m.style.cssText = 'font-weight:800;color:#7a5a00;background:#fff1b8;border-radius:999px;padding:3px 10px;margin-top:4px;display:inline-block'; box.appendChild(m); }
  show('day');
  return box;
}

/** The board on the Course itself: a small card on the right, under the buttons, open from the start, that folds to a pill so it never covers the run. */
export function boardCorner(key: string, hash: string, me = '', hooks: BoardHooks = {}): HTMLElement {
  const card = document.createElement('div'); card.id = 'board-corner';
  card.style.cssText = 'position:fixed;right:16px;top:284px;z-index:30;width:250px;background:#fffffff2;border:1px solid #cfd6d0;border-radius:12px;box-shadow:0 4px 16px #0003;font:500 13px system-ui,sans-serif;color:#17201d';
  const toggle = document.createElement('button'); toggle.type = 'button'; toggle.id = 'board-toggle';
  toggle.style.cssText = 'width:100%;text-align:left;border:0;background:transparent;font:700 14px system-ui,sans-serif;padding:8px 12px;cursor:pointer';
  const makeBody = (): HTMLElement => { const b = boardBox(key, hash, me, hooks); b.style.margin = '0'; b.style.border = '0'; b.style.padding = '0 12px 10px'; (b.firstElementChild as HTMLElement).style.display = 'none'; return b; }; // the pill is the title
  let body = makeBody();
  const fold = (open: boolean): void => { body.style.display = open ? '' : 'none'; toggle.textContent = `${open ? '▾' : '▸'} Fastest runs`; toggle.setAttribute('aria-expanded', String(open)); };
  toggle.onclick = () => fold(body.style.display === 'none');
  card.append(toggle, body); fold(true);
  // after a run is sent the server needs a moment to replay it: the card asks again, keeping its open or folded state
  card.addEventListener('board-refresh', () => { const open = body.style.display !== 'none'; const next = makeBody(); body.replaceWith(next); body = next; fold(open); });
  return card;
}

const nameOfCourse = (key: string): string => key.split('/').pop()!.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
/** The news line: the newest published run on any course, one quiet line under the top bar. It fades by itself, can be closed, and asks the server rarely. */
export function newsStrip(): HTMLElement {
  const el = document.createElement('div'); el.id = 'board-news'; el.setAttribute('role', 'status');
  el.style.cssText = 'position:fixed;left:50%;top:46px;transform:translateX(-50%);z-index:25;display:none;align-items:center;gap:8px;max-width:80vw;padding:2px 10px;border-radius:999px;background:#fffdf7d9;border:1px solid #cfd6d0;font:500 12px system-ui,sans-serif;color:#17201d;transition:opacity .6s;white-space:nowrap';
  const text = document.createElement('span'); text.style.cssText = 'overflow:hidden;text-overflow:ellipsis';
  const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'Close'); x.style.cssText = 'border:0;background:none;cursor:pointer;font-size:14px;line-height:1;padding:0 2px';
  let seen = '', dismissed = false, hide = 0;
  x.onclick = () => { dismissed = true; el.style.display = 'none'; };
  el.append(text, x);
  const poll = async (): Promise<void> => {
    if (dismissed || document.hidden) return;
    try {
      const res = await fetch('/api/leaderboard?recent=1');
      const d = res.ok ? await res.json() as { run: { course: string; nick: string; ticks: number; ts: string } | null } : { run: null };
      const r = d.run;
      if (!r || `${r.ts}${r.course}${r.ticks}` === seen) return;
      seen = `${r.ts}${r.course}${r.ticks}`;
      text.textContent = `${r.nick || 'Ninja'} just set ${secondsText(r.ticks)} on ${nameOfCourse(r.course)}`;
      el.style.display = 'flex'; el.style.opacity = '1'; clearTimeout(hide);
      hide = window.setTimeout(() => { el.style.opacity = '0'; window.setTimeout(() => { if (el.style.opacity === '0') el.style.display = 'none'; }, 700); }, 12000);
    } catch { /* no news is fine */ }
  };
  void poll(); window.setInterval(() => void poll(), 60_000);
  return el;
}
