import type { LaneSetting } from './advice';
import type { P } from './holds-world';
import type { MoveId, RoleProgress, RoleSuggestion } from './roles';

export type { RolesJob as RoleRequest, RolesReply as RoleMessage } from './roles-job';
import type { RolesJob as RoleRequest, RolesReply as RoleMessage } from './roles-job';
export interface RoleWorker { postMessage(data: RoleRequest): void; terminate(): void; onmessage: ((e: { data: RoleMessage }) => void) | null; onerror: ((event?: { preventDefault?(): void }) => void) | null; onmessageerror: (() => void) | null }
export interface RoleResult { items: RoleSuggestion[]; limited: boolean }

/** No synchronous fallback: a missing/broken worker must never freeze the editor. */
export function rolesInWorker(pieces: P[], lane: LaneSetting, options: { budgetMs?: number; only?: number; moves?: MoveId[]; progress?: (p: RoleProgress) => void } = {}, spawn: () => RoleWorker = () => new Worker(new URL('../sim/roles-worker.ts', import.meta.url), { type: 'module' }) as unknown as RoleWorker): { promise: Promise<RoleResult>; cancel(): void } {
  let worker: RoleWorker | undefined, timer: ReturnType<typeof setTimeout> | undefined, settled = false;
  let partial: RoleSuggestion[] = [], rejectTask: (e: Error) => void = () => undefined;
  const budgetMs = options.budgetMs ?? 40000;
  const cleanup = () => { if (timer !== undefined) clearTimeout(timer); worker?.terminate(); };
  const promise = new Promise<RoleResult>((resolve, reject) => {
    rejectTask = (e) => { if (settled) return; settled = true; cleanup(); reject(e); };
    const finish = (result: RoleResult) => { if (settled) return; settled = true; cleanup(); resolve({ ...result, items: result.items.filter((s) => s.proved === true) }); };
    try {
      worker = spawn();
      worker.onmessage = ({ data }) => {
        if (settled) return;
        if (data.id !== 1) return;
        if ('progress' in data) {
          const p = data.progress;
          if (p.candidate && p.verified) { partial = p.verified.filter((s) => s.proved === true); options.progress?.({ index: p.done + 1, total: p.of, candidate: p.candidate, verified: partial }); }
        } else if ('items' in data) finish({ items: data.items, limited: data.limited ?? false });
        else rejectTask(new Error(data.error));
      };
      worker.onerror = worker.onmessageerror = (event?: { preventDefault?(): void }) => { event?.preventDefault?.(); rejectTask(new Error('The simulator worker stopped. Try the search again.')); };
      // A single synchronous proof may exceed the candidate-loop budget: terminate it at the page-side deadline.
      timer = setTimeout(() => finish({ items: partial, limited: true }), Math.max(1, budgetMs));
      worker.postMessage({ id: 1, pieces, lane, opts: { budgetMs, ...(options.only !== undefined ? { only: options.only } : {}), ...(options.moves ? { moves: options.moves } : {}) } });
    } catch { rejectTask(new Error('Could not start the simulator worker. No search was run; try again in a browser with workers enabled.')); }
  });
  return { promise, cancel: () => rejectTask(new Error('cancelled')) };
}
