// CC-133 (owner 2026-11-04): a small chip on every page except Make that shows the waiting cut-out or 3D job.
import { pageQuery } from '../flags';
// It only asks the server how the job is going (the status call changes nothing); the finished piece is saved when the person opens Make again.
import { browserStore, readJobs, removeJob, type PendingJob } from '../community/job-store';

const API: Record<PendingJob['kind'], string> = { segment: '/api/segment', lift: '/api/object-lift' };
const WORDS: Record<PendingJob['kind'], string> = { segment: 'Finding things in your photo', lift: 'Making your 3D piece' };
export const MAKE_HREF = '?mode=communities&welcome=0&tab=make';

export type ChipState = 'running' | 'done' | 'failed';
export const chipText = (j: PendingJob, s: ChipState): string =>
  s === 'done' ? `Ready: ${j.kind === 'lift' ? 'your piece' : 'your cut-outs'}. Open it.` : s === 'failed' ? 'That job stopped. Open Make to try again.' : `${WORDS[j.kind]}…`;

async function ask(j: PendingJob, f: typeof fetch): Promise<ChipState> {
  try {
    const r = await f(API[j.kind], { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'status', id: j.id }) });
    if (!r.ok) return 'running';
    const d = (await r.json()) as { state?: string };
    return d.state === 'done' ? 'done' : d.state === 'failed' ? 'failed' : 'running';
  } catch { return 'running'; }
}

export function mountJobChip(root: HTMLElement, mode: string, f: typeof fetch = fetch): void {
  if (mode === 'communities' && pageQuery().get('tab') === 'make') return;
  const store = browserStore();
  if (!readJobs(store).length) return;
  const a = document.createElement('a');
  a.dataset.coursePersistent = ''; a.className = 'job-chip'; a.href = MAKE_HREF; a.dataset.testid = 'job-chip';
  a.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:60;background:#1c2a3a;color:#fff;padding:8px 14px;border-radius:999px;font:14px system-ui,sans-serif;text-decoration:none;box-shadow:0 2px 8px #0006';
  root.appendChild(a);
  const tick = async (): Promise<void> => {
    const jobs = readJobs(store);
    if (!jobs.length) { a.remove(); return; }
    const j = jobs[jobs.length - 1];
    const s = await ask(j, f);
    a.textContent = chipText(j, s);
    if (s === 'failed') removeJob(store, j.id);
    if (s !== 'done' && s !== 'failed') window.setTimeout(() => { void tick(); }, 4000);
  };
  void tick();
}
