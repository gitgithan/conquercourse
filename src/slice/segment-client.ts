import { turnstileToken, rememberPass } from '../ui/turnstile';
import { JobError, submitFailure, type Shrunk } from './object-lift-client';
import { SEGMENT_STEPS, progressOf, stageIndex, type Progress } from './stages';
import { cleanSuggestions, type Suggestion } from './segment';
import { cleanPeople, type Box } from './markbox';

// The page side of /api/segment (CC-248): send the shrunk photo, poll every 2 s, and get clickable suggestions back. Throws a JobError with a plain-words message.
const post = async (body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> => {
  const res = await fetch('/api/segment', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let data: Record<string, unknown> = {};
  try { data = (await res.json()) as Record<string, unknown>; } catch { /* a broken reply is a failure below */ }
  return { ok: res.ok, status: res.status, data };
};

/** `off` is true when the job is not switched on here (the page then uses the marked box itself as the outline). */
export class SegmentOff extends JobError {}

export async function suggestRegions(photo: Shrunk, progress: (s: string) => void, signal?: AbortSignal, onStage?: (p: Progress) => void, onPeople?: (people: Box[]) => void, box?: Box): Promise<Suggestion[]> {
  const t0 = Date.now();
  const tell = (i: number) => onStage?.(progressOf(SEGMENT_STEPS, i, t0));
  progress('Looking for the outline. People in the photo are blurred first.'); tell(0);
  const sub = await post({ action: 'submit', turnstile: await turnstileToken(), image: photo.image, thumb: photo.thumb, ...(box ? { box } : {}) });
  if (typeof sub.data.pass === 'string') rememberPass(sub.data.pass, photo.image);
  if (!sub.ok || typeof sub.data.id !== 'string') {
    if (sub.status === 503) throw new SegmentOff('The outline finder is switched off here, so nothing can be found right now.', true);
    const e = submitFailure(sub.status, sub.data);
    throw new JobError(e.message || 'The outline finder did not answer. Your box can be used as it is.', e.final, e.retryAt);
  }
  let at = 0, lost = 0;
  for (let i = 0; i < 150; i++) {
    if (signal?.aborted) throw new JobError('Stopped.', false, null, true);
    await new Promise((r) => setTimeout(r, 2000));
    if (signal?.aborted) throw new JobError('Stopped.', false, null, true);
    const r = await post({ action: 'status', id: sub.data.id });
    if (!r.ok) { if (++lost > 3) break; continue; }
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
