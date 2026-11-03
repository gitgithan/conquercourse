import type { CourseData } from '../../course/course';
import { IdealPool } from '../../sim/ideal-pool';
import { searchIdealRun, type SearchResult } from '../../sim/ideal';
import { openSearchPanel } from '../../ui/search-panel';

// kind: who asked. Only the ideal run (I, Shift+I) lets any key cancel; the ghost and the drums run while the player plays, so only the Cancel button stops them.
// No kind means a quiet background search (the take-off windows, the shortcut list): no panel.
export type SearchKind = 'ideal' | 'ghost' | 'drums';
export type RunSearch = (c: CourseData, sig: { cancelled: boolean }, onNote?: (label: string, step: number, of: number) => void, budget?: number, kind?: SearchKind) => Promise<SearchResult>;
const IGNORED = /^(Shift|Control|Alt|Meta|CapsLock)/;

// The search runs in a pool of workers (src/sim/ideal-pool.ts): the page keeps drawing, the line says which obstacle it is on, and any key cancels.
// One search at a time (the workers hold one course); each waits for the one before. Nothing here runs a search on the page's thread unless there are no workers at all.
export function createSearch(params?: URLSearchParams): RunSearch {
  const panelOn = !params || params.get('searchpanel') !== '0'; // CC-133: ?searchpanel=0 hides the progress panel
  let idealPool: IdealPool | null = null;
  let poolQueue: Promise<unknown> = Promise.resolve();
  return (c, sig, onNote, budget, kind) => {
    try {
      idealPool ??= new IdealPool(() => {
        const w = new Worker(new URL('../../sim/ideal-eval-worker.ts', import.meta.url), { type: 'module' });
        return { post: (m) => w.postMessage(m), listen: (cb) => w.addEventListener('message', (e) => cb((e as MessageEvent).data)), stop: () => w.terminate() };
      }, Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 4) - 1)));
      const pool = idealPool;
      const go = () => {
        const h = panelOn && kind ? openSearchPanel(() => { sig.cancelled = true; }) : null;
        const onKey = (e: KeyboardEvent) => { if (!e.repeat && !IGNORED.test(e.code) && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) sig.cancelled = true; };
        if (h && kind === 'ideal') window.addEventListener('keydown', onKey, true);
        return pool.search(c, (b) => { const step = Math.min(b.step + 1, b.of); onNote?.(b.label, step, b.of); h?.note(b.label, step, b.of); }, sig, { budget })
          .then((r) => { h?.done(r.cleared || !!budget); return r; }, (e) => { h?.close(); throw e; })
          .finally(() => window.removeEventListener('keydown', onKey, true));
      };
      const run = poolQueue.catch(() => undefined).then(() => (sig.cancelled ? Promise.reject(new Error('cancelled')) : go()));
      poolQueue = run;
      return run;
    } catch { return Promise.resolve(searchIdealRun(c)); } // no worker here: search on the page's thread
  };
}
