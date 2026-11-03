import type { CourseData } from '../../course/course';
import { courseHash } from '../../sim/replay';
import type { SearchResult } from '../../sim/ideal';

// CC-133 step 1: one shared result cache for the ideal-run search, per page visit.
// The ghost, the drum lane, the I key and the take-off windows all ask for the same answer; a course with no stored plan is searched once and every asker waits for or reuses it.

export type SearchKind = 'ideal' | 'ghost' | 'drums';
export type Sig = { cancelled: boolean };
export type NoteFn = (label: string, step: number, of: number) => void;
export type RunSearch = (c: CourseData, sig: Sig, onNote?: NoteFn, budget?: number, kind?: SearchKind) => Promise<SearchResult>;
export interface PanelHandle { note(label: string, step: number, of: number): void; done(cleared: boolean): void; close(): void }
export interface ShareOptions {
  openPanel?: (onCancel: () => void) => PanelHandle; // omitted: no panel
  onKeyCancel?: (cancelIdeal: () => void) => () => void; // adds the "any key cancels" listener for an ideal asker, returns its remover
  stats?: SearchStats;
}
export interface SearchStats { started: number; joined: number; reused: number; panels: number }

/** The key of a search answer: the fingerprint of everything the search reads (the start x is part of it) and nothing it only produces (plan, windows, routes, shortcuts).
 * Not in the key: the budget (a search that runs out of budget gives no answer and is never stored) and the routes option (these callers never ask for it). */
export const searchKey = (c: CourseData): string => courseHash({ ...c, source: undefined, designedShortcuts: undefined, hazard: undefined } as CourseData);

interface Asker { sig: Sig; kind?: SearchKind; onNote?: NoteFn; budget?: number; reject(e: Error): void }
interface Flight { key: string; budget?: number; sig: Sig; askers: Set<Asker>; promise: Promise<SearchResult>; last?: { label: string; step: number; of: number }; panel: PanelHandle | null; open: boolean }

const cancelled = () => new Error('cancelled');
// a joiner that wants more work than the search it joined has: if that search runs out, it goes again with its own budget
const needsMore = (a: number | undefined, f: number | undefined): boolean => f !== undefined && (a === undefined || a > f);

/** Wraps a plain search (no panel, no queue of its own) so that equal asks share one run and one answer.
 * - A finished answer is kept for the visit; an ask for it is answered at once (the same object, so identical to the fresh one).
 * - An ask while the same search is running waits for it; the panel (if any) shows once.
 * - Cancelling one asker (its signal) only cancels that asker; the search stops, and is dropped from the cache, only when nobody is left who needs it.
 * - A search that fails or is cancelled is never stored. */
export function shareSearches(raw: (c: CourseData, sig: Sig, onNote: NoteFn, budget?: number) => Promise<SearchResult>, opts: ShareOptions = {}): RunSearch {
  const done = new Map<string, SearchResult>();
  const flying = new Map<string, Flight>();
  const stats = opts.stats;

  const run: RunSearch = (c, sig, onNote, budget, kind) => {
    if (sig.cancelled) return Promise.reject(cancelled());
    const key = searchKey(c);
    const hit = done.get(key);
    if (hit) { if (stats) stats.reused++; return Promise.resolve(hit); }
    let f = flying.get(key);
    const asker: Asker = { sig, kind, onNote, budget, reject: () => undefined };
    if (f) { if (stats) stats.joined++; }
    else {
      f = start(c, key, budget);
    }
    const flight = f;
    flight.askers.add(asker);
    if (kind && opts.openPanel && !flight.panel && flight.open) openPanelFor(flight);
    if (flight.last) onNote?.(flight.last.label, flight.last.step, flight.last.of);

    return new Promise<SearchResult>((resolve, reject) => {
      let settled = false, timer: ReturnType<typeof setInterval> | undefined, unkey: (() => void) | undefined;
      const finish = () => { settled = true; if (timer !== undefined) clearInterval(timer); unkey?.(); flight.askers.delete(asker); };
      const leave = () => { // this asker gave up: the search goes on only if someone else still needs it
        if (settled) return;
        finish(); reject(cancelled());
        if (flight.askers.size === 0 && flight.open) { flight.open = false; flight.sig.cancelled = true; if (flying.get(key) === flight) flying.delete(key); flight.panel?.close(); }
      };
      asker.reject = leave;
      const check = () => { if (sig.cancelled) leave(); };
      timer = setInterval(check, 100);
      if (kind === 'ideal' && opts.onKeyCancel) unkey = opts.onKeyCancel(() => { sig.cancelled = true; leave(); });
      flight.promise.then((r) => { if (!settled) { finish(); resolve(r); } }, (e: Error) => {
        if (settled) return;
        finish();
        if (!sig.cancelled && needsMore(budget, flight.budget) && e.message !== 'cancelled') run(c, sig, onNote, budget, kind).then(resolve, reject);
        else reject(e);
      });
    });
  };

  function start(c: CourseData, key: string, budget?: number): Flight {
    if (stats) stats.started++;
    const f: Flight = { key, budget, sig: { cancelled: false }, askers: new Set(), promise: null as unknown as Promise<SearchResult>, panel: null, open: true };
    flying.set(key, f);
    const note: NoteFn = (label, step, of) => {
      f.last = { label, step, of };
      for (const a of [...f.askers]) { if (a.sig.cancelled) a.reject(cancelled()); else a.onNote?.(label, step, of); }
      f.panel?.note(label, step, of);
    };
    f.promise = Promise.resolve().then(() => raw(c, f.sig, note, budget)).then((r) => {
      f.open = false;
      if (flying.get(key) === f) { flying.delete(key); done.set(key, r); } // only a finished answer is kept
      f.panel?.done(r.cleared || f.budget !== undefined);
      return r;
    }, (e) => {
      f.open = false;
      if (flying.get(key) === f) flying.delete(key);
      f.panel?.close();
      throw e;
    });
    f.promise.catch(() => undefined); // askers handle it; this keeps an abandoned search from being an unhandled rejection
    return f;
  }

  function openPanelFor(f: Flight) {
    if (stats) stats.panels++;
    // the Cancel button stops the asks that show the panel; a quiet asker (the take-off windows) keeps the search alive
    f.panel = opts.openPanel!(() => { for (const a of [...f.askers]) if (a.kind) { a.sig.cancelled = true; a.reject(cancelled()); } });
    if (f.last) f.panel.note(f.last.label, f.last.step, f.last.of);
  }

  return run;
}
