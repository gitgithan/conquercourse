import type { CourseData } from '../../course/course';
import { newWorld, type GameEvent } from '../../sim/world';
import { shortcutLine, type Shortcut } from '../../sim/shortcuts';
import { workSeconds, xWindows, type Plan, type SearchResult, type Window } from '../../sim/ideal';
import type { RunSearch } from './search';
import type { ShortcutList } from './shortcuts';
import type { CourseState } from './state';

export interface IdealDeps {
  course: CourseData;
  st: CourseState;
  log: GameEvent[];
  frames: { x: number; y: number }[];
  botState: { next: number; caught: number | null; bedAt: number | null };
  panel: HTMLElement;
  runSearch: RunSearch;
  shortcutList: ShortcutList;
  idealCache: Map<number, Plan>; // shared with the ghost, which reads the plan of the start
  botMode: () => boolean;
  clearGuides: () => void;
  restart: () => void;
}

// The ideal run (I and Shift+I), the shortcuts and the line of the slowest-landing windows: the simulator's own best line, played on the screen.
export function createIdealRun(deps: IdealDeps) {
  const { course, st, log, frames, botState, panel, runSearch, shortcutList, idealCache } = deps;
  const botMode = deps.botMode();
  let idealToken = 0, idealPending = 0, idealSignal = { cancelled: false };
  let windows: Window[] | null = null;
  const cpFor = (zoneId: string) => course.checkpoints?.find((c) => c.id === zoneId)?.x ?? course.startX;
  const ensureShortcuts = shortcutList.ensure;
  function startShortcut(s: Shortcut) {
    deps.clearGuides();
    st.world = newWorld(course, course.startX);
    log.length = 0; frames.length = 0; st.replay = null; panel.style.display = 'none';
    st.plan = s.plan; botState.next = 0; botState.caught = null; botState.bedAt = null;
    st.idealWhole = true; st.demo = null; st.retryX = course.startX;
    st.idealNote = shortcutLine(s) + ' Watch it, press any key to take over.';
  }
  function shortcutRow(): HTMLElement | null {
    const s = shortcutList.list()?.[0];
    if (!s) return null;
    const box = document.createElement('div'); box.style.cssText = 'display:grid;gap:6px;margin-top:6px;padding-top:6px;border-top:1px solid #d6dcd9';
    const t = document.createElement('span'); t.textContent = `${s.designed ? 'The course keeps a shortcut on purpose' : 'A shortcut exists'}: ${s.how}. It saves ${s.secondsSaved.toFixed(1)} s.`; t.id = 'shortcutnote';
    const b = document.createElement('button'); b.textContent = 'Watch the shortcut'; b.id = 'watchshortcut';
    b.style.cssText = 'font:inherit;border:1px solid #17201d;background:#fff;color:#17201d;border-radius:8px;padding:6px 12px;cursor:pointer;font-weight:700;justify-self:start';
    b.onclick = () => startShortcut(s);
    box.append(t, b);
    return box;
  }
  // The search runs in a pool of workers (src/sim/ideal-pool.ts): the page keeps drawing, the line says which obstacle it is on, and any key cancels.
  // One search at a time (the workers hold one course); each waits for the one before. Nothing here runs a search on the page's thread unless there are no workers at all.
  function findPlan(c: CourseData): Promise<SearchResult> {
    const sig = idealSignal = { cancelled: false };
    return runSearch(c, sig, undefined, undefined, 'ideal'); // the progress panel (src/ui/search-panel.ts) shows the obstacle, the bar and the time left; any key cancels
  }
  let windowsAsk: Promise<Window[] | null> | null = null;
  function ensureWindows(): Promise<Window[] | null> {
    windowsAsk ??= runSearch(course, { cancelled: false }, undefined, workSeconds(60)).then((r) => (windows = xWindows(r.windows))).catch(() => null);
    return windowsAsk;
  }
  // CC-241: a standing start has to clear the rest of the course. When the one just before the obstacle cannot (a pair that needs a run-up),
  // the start moves back to the nearest earlier checkpoint that can, and the line says so.
  async function startIdeal(x0: number, zoneId: string | null) {
    const token = ++idealToken;
    const starts = [x0, ...(course.checkpoints ?? []).map((k) => k.x).filter((x) => x < x0).sort((m, n) => n - m), ...(x0 > course.startX ? [course.startX] : [])].filter((x, i, a) => a.indexOf(x) === i);
    let p: Plan | undefined, from = x0, first: Plan | undefined;
    for (const x of starts) {
      let q = idealCache.get(x) ?? (x === course.startX ? course.plan : undefined);
      if (!q) {
        st.idealNote = '';
        idealPending = token;
        const r = await findPlan({ ...course, startX: x }).catch(() => undefined);
        if (idealPending !== token || !r) return; // cancelled while the search ran
        idealPending = 0;
        first ??= r.plan;
        if (!r.cleared) continue;
        q = r.plan; idealCache.set(x, q);
      }
      p = q; from = x; break;
    }
    if (!p) { p = first; from = x0; } // nothing clears from a standing start: show the closest line from where it was asked
    if (!p) return;
    deps.clearGuides();
    st.world = newWorld(course, from);
    log.length = 0; frames.length = 0; st.replay = null; panel.style.display = 'none';
    st.plan = p; botState.next = 0; botState.caught = null; botState.bedAt = null;
    st.idealWhole = zoneId === null;
    st.demo = zoneId === null ? null : { x1: (course.zones?.find((z) => z.id === zoneId)?.x1 ?? 1e9) + 3 };
    st.idealNote = zoneId === null ? 'Ideal run through every obstacle: watch it, press any key to take over.' : 'Ideal run: watch how it is done, then press R to try it yourself.';
    if (from < x0) { const back = (course.checkpoints ?? []).filter((k) => k.x >= from && k.x < x0).length; st.idealNote += ` It starts ${back === 1 ? 'one obstacle' : `${back} obstacles`} back, to build up speed.`; }
    if (zoneId === null) void ensureShortcuts().then((list) => { if (list[0] && st.plan === p && st.idealWhole) st.idealNote += ' ' + shortcutLine(list[0]); });
  }
  function showIdeal(zoneId: string) { st.idealWhole = false; void startIdeal(cpFor(zoneId), zoneId); }
  // Shift+I: the whole course, always from the standing start (CC-241), so the first obstacle is in the film too
  function showWholeIdeal() { void startIdeal(course.startX, null); }
  function stopWholeIdeal() {
    st.idealWhole = false; idealPending = 0; idealToken++; idealSignal.cancelled = true;
    if (!botMode) st.plan = null;
    st.idealNote = 'Your turn.'; setTimeout(() => { if (st.idealNote === 'Your turn.') st.idealNote = ''; }, 2500);
  }
  function demoEnd() {
    const whole = st.idealWhole; st.idealNote = '';
    st.plan = botMode ? st.plan : null; st.demo = null; st.idealWhole = false;
    panel.innerHTML = ''; panel.style.display = 'grid';
    const h = document.createElement('strong'); h.textContent = whole ? 'That was the ideal run through every obstacle. Your turn.' : 'That was the ideal run. Your turn.';
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
    const b = document.createElement('button'); b.textContent = 'Try it myself (R)';
    b.style.cssText = 'font:inherit;border:1px solid #0f6b5c;background:#0f6b5c;color:#fff;border-radius:8px;padding:6px 12px;cursor:pointer;font-weight:700';
    b.onclick = () => deps.restart(); row.appendChild(b); panel.append(h, row); b.focus();
    if (whole) void ensureShortcuts().then(() => { const sr = shortcutRow(); if (sr && panel.contains(h)) panel.appendChild(sr); });
  }

  // after a clear: say a shortcut exists (a fact, never a grade)
  function clearedNote() {
    void ensureShortcuts().then(() => {
      if (st.world.outcome !== 'cleared' || !shortcutList.list()?.length) return;
      const sr = shortcutRow(); if (!sr) return;
      if (panel.style.display === 'none' || !panel.firstChild) { panel.innerHTML = ''; panel.style.display = 'grid'; const h = document.createElement('strong'); h.textContent = 'You made it!'; panel.append(h); }
      panel.appendChild(sr);
    });
  }
  return { startIdeal, showIdeal, showWholeIdeal, stopWholeIdeal, demoEnd, clearedNote, ensureWindows, cpFor, windows: () => windows, cancelPending: () => { idealPending = 0; } };
}
