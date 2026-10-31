// View Run (CC-108): any row of the leaderboard opens a panel with the course, the winner's path and a button to race it.
// The keys are played at once with the simulator (no waiting for a thirty-second run); nothing here is a grade.
import type { CourseData } from '../course/course';
import { decodeLog, verifyLog, type GhostTrack, type InputLog } from '../sim/replay';
import { newLog, pathPicture } from './run-report';
import { secondsText } from './course-stats';

export interface RunHandle { id: number; nick: string; ticks: number }

/** The winner's path as the end-screen picture draws it: a point every four ticks. */
export function pathOf(track: GhostTrack): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= track.ticks; i += 4) out.push({ x: track.xs[i], y: track.ys[i] });
  return out;
}

/** How many times a key other than run or left went down: the moves of a run, counted from its keys (a count, never a grade). */
export function movesOf(log: InputLog): number {
  let prev = 0, n = 0;
  for (const [mask] of log) { const m = mask & ~0b11; n += countBits(m & ~prev); prev = m; } // bits 0 and 1 are run and left
  return n;
}
const countBits = (m: number): number => { let c = 0; for (; m; m &= m - 1) c++; return c; };

export async function loadRun(course: CourseData, id: number): Promise<{ track: GhostTrack; nick: string; ticks: number; moves: number } | null> {
  try {
    const res = await fetch(`/api/leaderboard-run?id=${id}`);
    if (!res.ok) return null;
    const d = await res.json() as { keys: string; nick: string; ticks: number };
    const log = await decodeLog(d.keys), v = verifyLog(course, log);
    return v.cleared ? { track: v.track, nick: d.nick, ticks: v.ticks, moves: movesOf(log) } : null;
  } catch { return null; }
}

/** Opens the panel for one row. `race` receives the track and the tag when the player picks Chase Ghost. */
export async function openRunView(course: CourseData, row: RunHandle, race: (track: GhostTrack, nick: string) => void): Promise<void> {
  document.getElementById('run-view')?.remove();
  const panel = document.createElement('div'); panel.id = 'run-view'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Run on the leaderboard');
  panel.style.cssText = 'position:fixed;left:50%;top:90px;transform:translateX(-50%);z-index:40;width:min(640px,92vw);background:#fffffff7;color:#17201d;border:2px solid #17201d;border-radius:14px;padding:12px 16px;box-shadow:0 8px 30px #0005;font:500 14px system-ui,sans-serif';
  const head = document.createElement('div'); head.style.cssText = 'font-weight:800;font-size:16px;margin-bottom:6px';
  head.textContent = `${row.nick || 'Ninja'} · ${secondsText(row.ticks)}`;
  const body = document.createElement('div'); body.textContent = 'Playing the run…';
  const bar = document.createElement('div'); bar.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:8px';
  const btn = (label: string, id: string, go: () => void, main = false): HTMLButtonElement => {
    const b = document.createElement('button'); b.type = 'button'; b.id = id; b.textContent = label; b.onclick = go;
    b.style.cssText = `font:inherit;font-weight:700;border:1px solid #17201d;border-radius:8px;padding:6px 12px;cursor:pointer;${main ? 'background:#0f6b5c;color:#fff' : 'background:#fff;color:#17201d'}`;
    return b;
  };
  bar.append(btn('Close', 'run-view-close', () => panel.remove()));
  panel.append(head, body, bar);
  document.body.append(panel);
  const run = await loadRun(course, row.id);
  if (!panel.isConnected) return;
  if (!run) { body.textContent = 'This run could not be opened.'; return; }
  const log = newLog(); log.path = pathOf(run.track);
  body.replaceChildren(pathPicture(course, log, null, null));
  bar.prepend(btn('Chase Ghost', 'run-view-race', () => { race(run.track, run.nick); panel.remove(); }, true));
}

/** Chase Ghost straight from a board row: play the run and hand its track to the race, no panel. */
export async function chaseRun(course: CourseData, row: RunHandle, race: (track: GhostTrack, nick: string) => void): Promise<boolean> {
  const run = await loadRun(course, row.id);
  if (run) race(run.track, run.nick);
  return !!run;
}
