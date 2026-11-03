// Waiting jobs that survive leaving the page (CC-133, owner 2026-11-04): the Make screen records each running outline or 3D job here,
// so a player can visit other pages and come back; the page then asks the server about the same job instead of starting a new one.
// Only a job id and a few labels are kept (never the photo); a job older than JOB_LIFE_MS is forgotten.
export type JobKind = 'segment' | 'lift';
export interface PendingJob { kind: JobKind; id: string; startedAt: number; photoSha: string; areaId?: number; label?: string }
export interface Store { getItem(k: string): string | null; setItem(k: string, v: string): void }

export const JOBS_KEY = 'cc.pendingJobs';
export const JOB_LIFE_MS = 40 * 60_000;
const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

/** Reads the list, dropping anything malformed or older than the job life. */
export function readJobs(s: Store | null, now = Date.now()): PendingJob[] {
  if (!s) return [];
  let raw: unknown;
  try { raw = JSON.parse(s.getItem(JOBS_KEY) ?? '[]'); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  const out: PendingJob[] = [];
  for (const j of raw as Record<string, unknown>[]) {
    if (!j || (j.kind !== 'segment' && j.kind !== 'lift') || typeof j.id !== 'string' || !ID_RE.test(j.id)) continue;
    if (typeof j.startedAt !== 'number' || !Number.isFinite(j.startedAt) || now - j.startedAt > JOB_LIFE_MS || j.startedAt > now + 60_000) continue;
    if (typeof j.photoSha !== 'string' || !/^[0-9a-f]{8,64}$/.test(j.photoSha)) continue;
    out.push({ kind: j.kind, id: j.id, startedAt: j.startedAt, photoSha: j.photoSha, ...(Number.isInteger(j.areaId) ? { areaId: j.areaId as number } : {}), ...(typeof j.label === 'string' ? { label: j.label.slice(0, 40) } : {}) });
  }
  return out.slice(-12);
}
const write = (s: Store | null, jobs: PendingJob[]): void => { try { s?.setItem(JOBS_KEY, JSON.stringify(jobs.slice(-12))); } catch { /* the job still runs; it just cannot be picked up after leaving */ } };

export function addJob(s: Store | null, j: PendingJob, now = Date.now()): void { write(s, [...readJobs(s, now).filter((x) => x.id !== j.id), j]); }
export function removeJob(s: Store | null, id: string, now = Date.now()): void { write(s, readJobs(s, now).filter((x) => x.id !== id)); }
/** The job still waiting for this photo (and this area, for a 3D piece). */
export function findJob(jobs: PendingJob[], kind: JobKind, photoSha: string, areaId?: number): PendingJob | undefined {
  return jobs.find((j) => j.kind === kind && j.photoSha === photoSha && (kind === 'segment' || j.areaId === areaId));
}
export const browserStore = (): Store | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };
