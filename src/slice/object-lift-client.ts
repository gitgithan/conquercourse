// Browser side of the photo -> 3D object path (CC-221): shrink the photo, send it, ask again until the job is done.
// The photo goes to /api/object-lift only; the server removes people (blur) before the lift, and nothing is stored there.
import { failWords, retryNote } from './object-lift';
import { LIFT_STEPS, progressOf, refusalWords, stageIndex, type Progress, type Refusal } from './stages';
import { creditLine, PIPELINE, PROVENANCE_VERSION, sha256Hex, type Provenance } from './provenance';
import { rememberReceipt } from '../community/share-client';
import { checkField } from '../ui/turnstile';

export interface Shrunk { image: string; thumb: string; width: number; height: number; sha256: string }
export interface LiftDone { glb: ArrayBuffer; prov: Provenance; notes: string[]; privacy: { people?: number; faces?: number; plates?: number }; seconds: number }

/** The photo at most 1280 px on its long side as a jpeg (this drops the camera's location data), plus a 640 px copy for the safety check. */
export async function shrinkPhoto(f: Blob): Promise<Shrunk> {
  const bmp = await createImageBitmap(f);
  const draw = (max: number, q: number) => {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext('2d')!.drawImage(bmp, 0, 0, cv.width, cv.height);
    return { url: cv.toDataURL('image/jpeg', q), w: cv.width, h: cv.height };
  };
  let q = 0.88, big = draw(1280, q);
  while (big.url.length > 1_200_000 && q > 0.4) { q -= 0.1; big = draw(1280, q); }
  const thumb = draw(640, 0.8);
  const bytes = Uint8Array.from(atob(big.url.slice(big.url.indexOf(',') + 1)), (c) => c.charCodeAt(0));
  return { image: big.url, thumb: thumb.url, width: big.w, height: big.h, sha256: await sha256Hex(bytes) };
}

export interface LiftInput { photo: Shrunk; box: [number, number, number, number]; label: string; height_m: number | null; padretry?: boolean; photoId?: string | null; resumeId?: string; startedAt?: number; onSubmitted?: (id: string) => void }
export type Reply = { ok: boolean; status: number; data: Record<string, unknown> };
/** One call to a job route. A dropped connection comes back as status 0 (never a throw), so the callers can ask again. */
export const postJson = async (url: string, body: unknown): Promise<Reply> => {
  let res: Response;
  try { res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); } catch { return { ok: false, status: 0, data: {} }; }
  let data: Record<string, unknown> = {};
  try { data = (await res.json()) as Record<string, unknown>; } catch { /* a broken reply is a failure below */ }
  return { ok: res.ok, status: res.status, data };
};
const post = (body: unknown): Promise<Reply> => postJson('/api/object-lift', body);

/** A failed answer that says nothing about why (a dropped connection, or a server error with no words): a cold or busy machine, worth asking again. A refusal with a reason is final for this try. */
export const transient = (r: Reply): boolean => !r.ok && (r.status === 0 || r.status >= 500) && !r.data.error && !r.data.message;
/** Ask again after a short wait when the answer was transient (twice at most, 3 s then 6 s), so a machine that is waking up is not reported as down. */
export async function withRetry(go: () => Promise<Reply>, signal?: AbortSignal, wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))): Promise<Reply> {
  let r = await go();
  for (const ms of [3000, 6000]) { if (!transient(r) || signal?.aborted) break; await wait(ms); r = await go(); }
  return r;
}

/** An Error whose message is already plain words. `final`: trying again cannot help. `retryAt`: the time (ms) it may work again, when the server said. */
export class JobError extends Error { constructor(message: string, readonly final = false, readonly retryAt: number | null = null, readonly stopped = false) { super(message); } }

/** What a refused submit says in plain words: the daily and busy limits come with a clock time in the player's own time. */
export function submitFailure(status: number, data: Record<string, unknown>, now = Date.now()): JobError {
  const err = String(data.error ?? ''), wait = typeof data.retryAfterSeconds === 'number' ? data.retryAfterSeconds : 0;
  const words = refusalWords({ error: err, message: typeof data.message === 'string' ? data.message : undefined, retryAfterSeconds: wait } as Refusal, now);
  if (!words && !err && status === 404) return new JobError('This copy of the game (the local one) has no photo service. Use the preview site for this step.', true);
  return new JobError(words || (typeof data.message === 'string' && data.message ? data.message : failWords(String(err || (status === 503 ? 'not allowed' : 'down')))), ['daily', 'budget', 'moderation'].includes(err), wait ? now + wait * 1000 : null);
}

/**
 * Run one lift. `progress` gets a plain sentence now and then; `onStage` gets the stepped progress (which step, the words, seconds so far) every time the job is asked about, about every 2 s.
 * Throws a JobError with a plain-words message.
 */
export async function liftObject(inp: LiftInput, progress: (s: string) => void, signal?: AbortSignal, onStage?: (p: Progress) => void): Promise<LiftDone> {
  const t0 = inp.startedAt ?? Date.now();
  const tell = (i: number) => onStage?.(progressOf(LIFT_STEPS, i, t0));
  progress(inp.resumeId ? 'Checking on your piece.' : 'Sending your photo. People in it are blurred before anything is looked at.'); tell(0);
  const sub = inp.resumeId ? { ok: true, status: 200, data: { id: inp.resumeId } as Record<string, unknown> } : await withRetry(async () => post({ action: 'submit', ...(await checkField(fetch, Date.now(), inp.photo.image)), image: inp.photo.image, thumb: inp.photo.thumb, label: inp.label, box: inp.box, width: inp.photo.width, height: inp.photo.height, height_m: inp.height_m, padretry: inp.padretry !== false }), signal);
  if (!sub.ok || typeof sub.data.id !== 'string') throw submitFailure(sub.status, sub.data);
  if (!inp.resumeId) inp.onSubmitted?.(sub.data.id);
  let at = 0, lost = 0;
  for (let i = 0; i < 600; i++) {
    if (signal?.aborted) throw new JobError('Stopped.', false, null, true);
    await new Promise((r) => setTimeout(r, 2000));
    if (signal?.aborted) throw new JobError('Stopped.', false, null, true);
    const s = await post({ action: 'status', id: sub.data.id });
    const d = s.data;
    if (!s.ok) { if (++lost > 8) throw new JobError(failWords('down')); progress('The 3D maker is waking up. Still trying. (' + Math.round((Date.now() - t0) / 1000) + ' s)'); continue; } // dropped answers are not a failure: a waking machine can miss a few asks in a row (about 16 s)
    lost = 0;
    if (d.state === 'running') { at = stageIndex(LIFT_STEPS, d.stage, at); tell(at); progress(`${LIFT_STEPS[at].words}. (${Math.round((Date.now() - t0) / 1000)} s)`); continue; }
    if (d.state === 'done' && typeof d.glb === 'string') {
      const mesh = d.mesh as { height_m: number; height_source?: string };
      const retry = d.retry as { note?: string; padded?: boolean } | undefined;
      const glb = Uint8Array.from(atob(d.glb), (c) => c.charCodeAt(0)).buffer;
      const id = `u${inp.photo.sha256.slice(0, 8)}-${Date.now().toString(36)}`;
      const prov: Provenance = {
        version: PROVENANCE_VERSION, id, glb: `user:${id}`, name: inp.label.replace(/^./, (c) => c.toUpperCase()), source: 'user',
        photo: { sha256: inp.photo.sha256, width: inp.photo.width, height: inp.photo.height, id: inp.photoId ?? null, url: null, stored: false },
        box: inp.box, label: inp.label, height_m: Math.round(mesh.height_m * 100) / 100, height_source: inp.height_m == null ? 'typical' : 'typed',
        pipeline: { ...PIPELINE, pad_retry: !!retry?.padded }, credit: { author: '', licence: '', source_url: null, line: creditLine({}, 'user') }, created: new Date().toISOString().slice(0, 10),
      };
      const note = retryNote(retry);
      tell(LIFT_STEPS.length - 1);
      if (typeof d.receipt === 'string') rememberReceipt(id, d.receipt);
      return { glb, prov, notes: note ? [note] : [], privacy: (d.privacy as LiftDone['privacy']) ?? {}, seconds: Math.round((Date.now() - t0) / 1000) };
    }
    throw new JobError(failWords(String(d.reason ?? '')));
  }
  throw new JobError('This is taking too long. Try again.');
}

/** How many 3D pieces a player can make a day and how many are left today, from the server; null when it cannot be read (the server still decides at the press). */
export async function piecesToday(): Promise<{ perDay: number; left: number } | null> {
  try {
    const res = await fetch('/api/object-lift', { cache: 'no-store' });
    const d = (await res.json()) as { perDay?: unknown; left?: unknown };
    return res.ok && Number.isInteger(d.perDay) && Number.isInteger(d.left) ? { perDay: d.perDay as number, left: d.left as number } : null;
  } catch { return null; }
}
