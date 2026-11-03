import type { CourseData } from '../../course/course';
import { xWindows, type SearchResult } from '../../sim/ideal';
import { searchInput, storedPlanFor, withStoredPlan, type PresetPlan } from '../../slice/preset-plans';
import type { LaneProgress } from '../../slice/lane-check';

// CC-243: the lane check's search. A ready-made course is answered at once from its stored proof; an edited one is searched in a worker.
// Moved out of editor.ts unchanged except that the worker path and the progress callback are given (CC-133).
export function createSearch(env: { progress: (p: LaneProgress) => void; results?: Map<string, PresetPlan>; preview?: boolean }) {
  let searchVersion = 0;
  let searchWorker: Worker | null = null, finishSearch: ((cleared: PresetPlan | null) => void) | null = null;
  let activeSearch: { key: string; promise: Promise<PresetPlan | null> } | null = null;
  const results = env.results ?? new Map<string, PresetPlan>();
  const keyOf = (course: CourseData) => JSON.stringify(searchInput(course));
  const report = (kind: string) => { document.documentElement.dataset[env.preview ? 'previewProof' : 'laneProof'] = kind; };
  const proofFor = (course: CourseData): PresetPlan | null => {
    const stored = storedPlanFor(course), cached = results.get(keyOf(course));
    if (stored || cached) report(stored ? 'stored' : 'cached');
    return stored ?? cached ?? null;
  };
  // CC-243: the lane check. A ready-made course is answered at once from its stored proof (scripts/preset-plans.ts); an edited one is searched in a worker, and the plan it finds goes with the hand-off to the Course.
  function searchResult(course: CourseData): Promise<PresetPlan | null> {
    const stored = storedPlanFor(course);
    if (stored) { report('stored'); return Promise.resolve(stored); }
    const key = keyOf(course), cached = results.get(key);
    if (cached) { report('cached'); return Promise.resolve(cached); }
    report('search');
    if (activeSearch?.key === key) return activeSearch.promise;
    stopSearch();
    const id = ++searchVersion;
    let worker: Worker;
    try { worker = new Worker(new URL('../../sim/ideal-worker.ts', import.meta.url), { type: 'module' }); }
    catch { return Promise.resolve(null); }
    const promise = new Promise<PresetPlan | null>((resolve) => {
      searchWorker = worker; finishSearch = resolve;
      worker.onmessage = (e: MessageEvent<{ id: number; progress?: LaneProgress } & Pick<SearchResult, 'plan' | 'cleared' | 'windows' | 'routes'>>) => {
        if (e.data.id !== id || id !== searchVersion) return;
        if (e.data.progress) { env.progress(e.data.progress); return; }
        const result: PresetPlan = { key, cleared: e.data.cleared, ...(e.data.cleared ? { plan: e.data.plan, windows: xWindows(e.data.windows ?? []), ...(e.data.routes ? { routes: e.data.routes } : {}) } : {}) };
        // A positive verdict without its successful run cannot be handed to Play.
        if (result.cleared && !result.plan) { searchWorker = null; finishSearch = null; activeSearch = null; worker.terminate(); resolve(null); return; }
        results.delete(key); results.set(key, result);
        if (results.size > 24) results.delete(results.keys().next().value!);
        searchWorker = null; finishSearch = null; activeSearch = null; worker.terminate(); resolve(result);
      };
      worker.onerror = () => {
        if (id !== searchVersion) return;
        searchWorker = null; finishSearch = null; activeSearch = null; worker.terminate(); resolve(null);
      };
      worker.postMessage({ id, course });
    });
    activeSearch = { key, promise };
    return promise;
  }
  /** Ends the search that is running, if any, at once: its worker is terminated and whoever waits on it gets null. */
  function stopSearch() {
    searchVersion++;
    const done = finishSearch;
    finishSearch = null; activeSearch = null;
    searchWorker?.terminate(); searchWorker = null;
    done?.(null);
  }
  const searchClearable = async (course: CourseData): Promise<boolean | null> => (await searchResult(course))?.cleared ?? null;
  // the proof the lane check already holds for exactly this course, never a new search: the Course then does not search again
  const withProof = (course: CourseData): CourseData => {
    return withStoredPlan(course, proofFor(course));
  };
  return { searchResult, stopSearch, searchClearable, withProof, proofFor };
}
export type EditorSearch = ReturnType<typeof createSearch>;
