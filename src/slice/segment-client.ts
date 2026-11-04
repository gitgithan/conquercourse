import { turnstileToken, rememberPass } from '../ui/turnstile';
import { JobError, postJson, submitFailure, transient, withRetry, type Reply, type Shrunk } from './object-lift-client';
import { SEGMENT_STEPS, progressOf, stageIndex, type Progress } from './stages';
import { cleanSuggestions, type Suggestion } from './segment';
import { cleanPeople, type Box } from './markbox';

// The page side of /api/segment (CC-248): send the shrunk photo, poll every 2 s, and get clickable suggestions back. Throws a JobError with a plain-words message.
const post = (body: unknown): Promise<Reply> => postJson('/api/segment', body);

/** `off` is true when the job is not switched on here (the page then uses the marked box itself as the outline). */
export class SegmentOff extends JobError {}

/** `resume`: pick up a job started before the player left the page (no new job, no new check); `onSubmitted` tells the caller the job id as soon as the server has it. */
export interface SegmentResume { resumeId?: string; startedAt?: number; onSubmitted?: (id: string) => void }

export async function suggestRegions(photo: Shrunk, progress: (s: string) => void, signal?: AbortSignal, onStage?: (p: Progress) => void, onPeople?: (people: Box[]) => void, box?: Box, resume?: SegmentResume): Promise<Suggestion[]> {
  const t0 = resume?.startedAt ?? Date.now();
  const tell = (i: number) => onStage?.(progressOf(SEGMENT_STEPS, i, t0));
  progress(resume?.resumeId ? 'Checking on the outlines.' : 'Looking for the outline. People in the photo are blurred first.'); tell(0);
  const sub = resume?.resumeId ? { ok: true, status: 200, data: { id: resume.resumeId } as Record<string, unknown> } : await (async () => { const turnstile = await turnstileToken(); return withRetry(() => post({ action: 'submit', turnstile, image: photo.image, thumb: photo.thumb, ...(box ? { box } : {}) }), signal); })();
  if (typeof sub.data.pass === 'string') rememberPass(sub.data.pass, photo.image);
  if (!resume?.resumeId && typeof sub.data.id === 'string') resume?.onSubmitted?.(sub.data.id);
  if (!sub.ok || typeof sub.data.id !== 'string') {
    if (sub.status === 503) throw new SegmentOff('The outline finder is switched off here, so nothing can be found right now.', true);
    if (transient(sub)) throw new JobError('The outline finder is not answering. Try again in a minute, or mark the thing yourself.');
    const e = submitFailure(sub.status, sub.data);
    throw new JobError(e.message || 'The outline finder did not answer. Your box can be used as it is.', e.final, e.retryAt);
  }
  let at = 0, lost = 0;
  for (let i = 0; i < 150; i++) {
    if (signal?.aborted) throw new JobError('Stopped.', false, null, true);
    await new Promise((r) => setTimeout(r, 2000));
    if (signal?.aborted) throw new JobError('Stopped.', false, null, true);
    const r = await post({ action: 'status', id: sub.data.id });
    if (!r.ok) { if (++lost > 8) break; progress(`The outline finder is waking up. Still trying. (${Math.round((Date.now() - t0) / 1000)} s)`); continue; }
    lost = 0;
    const s = r.data;
    if (s.state === 'running') { at = stageIndex(SEGMENT_STEPS, s.stage, at); tell(at); progress(`${SEGMENT_STEPS[at].words}. (${Math.round((Date.now() - t0) / 1000)} s)`); continue; }
    if (s.state === 'done') { tell(SEGMENT_STEPS.length - 1); onPeople?.(cleanPeople((s.privacy as { person_boxes?: unknown } | undefined)?.person_boxes, photo.width, photo.height)); return cleanSuggestions(s.items, photo.width, photo.height); }
    break;
  }
  throw new JobError('No outline this time. Your box can be used as it is.');
}

/** The cut-out of one box the player drew (CC-133): one cheap mask call on the blurred photo. Returns the cut-out, or null when the finder found no clear shape. */
export async function maskBox(photo: Shrunk, box: Box, signal?: AbortSignal, onPeople?: (people: Box[]) => void): Promise<Suggestion | null> {
  const found = await suggestRegions(photo, () => undefined, signal, undefined, onPeople, box);
  return found[0] ?? null;
}
