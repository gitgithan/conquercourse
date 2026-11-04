import type { LaneSetting } from './advice';
import type { P } from './holds-world';
import { suggestRoles, type MoveId, type RoleSuggestion } from './roles';

// CC-133: "Find ways to add the missing moves" runs the simulator once per candidate, which can take many seconds.
// The editor runs it in a worker (src/sim/roles-worker.ts) so the page keeps drawing. This is the worker's whole job, kept apart so a test can run it without a browser.
export interface RolesJob { id: number; pieces: P[]; lane: LaneSetting; opts: { budgetMs?: number; only?: number; moves?: MoveId[] } }
export type RolesReply = { id: number; progress: { done: number; of: number; candidate?: RoleSuggestion; verified?: RoleSuggestion[] } } | { id: number; items: RoleSuggestion[]; limited?: boolean } | { id: number; error: string };

export function runRolesJob(job: RolesJob, post: (m: RolesReply) => void): void {
  const items = suggestRoles(job.pieces, job.lane, { ...job.opts, onProgress: (p) => post({ id: job.id, progress: { done: p.index - 1, of: p.total, candidate: p.candidate, verified: p.verified } }) });
  post({ id: job.id, items, limited: items.some((s) => s.proved === null) });
}
