import type { CourseData } from '../../course/course';
import { IdealPool } from '../../sim/ideal-pool';
import { searchIdealRun } from '../../sim/ideal';
import { openSearchPanel } from '../../ui/search-panel';
import { shareSearches, type RunSearch, type SearchStats } from './search-share';

export type { RunSearch, SearchKind } from './search-share';
const IGNORED = /^(Shift|Control|Alt|Meta|CapsLock)/;

// The search runs in a pool of workers (src/sim/ideal-pool.ts): the page keeps drawing, the line says which obstacle it is on, and any key cancels the ideal run.
// kind: who asked. Only the ideal run (I, Shift+I) lets any key cancel; the ghost and the drums run while the player plays, so only the Cancel button stops them.
// No kind means a quiet background search (the take-off windows, the shortcut list): no panel.
// CC-133: the asks share one cache per page visit (search-share.ts): a course with no stored plan is searched once, one panel shows, and the answer is reused.
// One search at a time (the workers hold one course); each waits for the one before. Nothing here runs a search on the page's thread unless there are no workers at all.
export function createSearch(params?: URLSearchParams): RunSearch {
  const panelOn = !params || params.get('searchpanel') !== '0'; // CC-133: ?searchpanel=0 hides the progress panel
  let idealPool: IdealPool | null = null;
  let poolQueue: Promise<unknown> = Promise.resolve();
  const stats: SearchStats = { started: 0, joined: 0, reused: 0, panels: 0 };
  (globalThis as { __searchStats?: SearchStats }).__searchStats = stats; // harmless counter the browser check reads
  const raw = (c: CourseData, sig: { cancelled: boolean }, onNote: (label: string, step: number, of: number) => void, budget?: number) => {
    try {
      idealPool ??= new IdealPool(() => {
        const w = new Worker(new URL('../../sim/ideal-eval-worker.ts', import.meta.url), { type: 'module' });
        return { post: (m) => w.postMessage(m), listen: (cb) => w.addEventListener('message', (e) => cb((e as MessageEvent).data)), stop: () => w.terminate() };
      }, Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 4) - 1)));
      const pool = idealPool;
      const run = poolQueue.catch(() => undefined).then(() => (sig.cancelled ? Promise.reject(new Error('cancelled')) : pool.search(c, (b) => onNote(b.label, Math.min(b.step + 1, b.of), b.of), sig, { budget })));
      poolQueue = run;
      return run;
    } catch { return Promise.resolve(searchIdealRun(c)); } // no worker here: search on the page's thread
  };
  return shareSearches(raw, {
    stats,
    openPanel: panelOn ? (onCancel) => openSearchPanel(onCancel) : undefined,
    onKeyCancel: (cancelIdeal) => {
      const onKey = (e: KeyboardEvent) => { if (!e.repeat && !IGNORED.test(e.code) && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) cancelIdeal(); };
      window.addEventListener('keydown', onKey, true);
      return () => window.removeEventListener('keydown', onKey, true);
    },
  });
}
