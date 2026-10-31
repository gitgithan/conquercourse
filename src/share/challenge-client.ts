// The page side of challenge courses (CC-108): register a course after a clear, open one by its id, list the Community. The rules live on the server (src/share/challenge-course.ts).
import type { CourseData } from '../course/course';
import { waitFromReply, shareWaitText } from '../sim/slow-down';
import type { InputLog } from '../sim/replay';
import { cleanCourse, madeCourse, packCourse } from './made-course';
import { makeLinkInfo } from './challenge';
import { TTL_SECONDS } from './challenge-course';

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export interface Registered { ok: boolean; id?: string; boardHash?: string; duplicate?: boolean; promoted?: boolean; error?: string; retryAfter?: number }

/** One plain sentence for each reason the registration can be turned down. */
export function registerErrorText(status: number, reason?: string, wait?: number | null): string {
  switch (reason) {
    case 'slow_down': return shareWaitText(wait ?? 60);
    case 'creation-cap': return 'You made a lot of challenge courses today. Try again tomorrow.';
    case 'not-a-clear': return 'The server played your run on this course and it did not reach the finish, so the course cannot be published yet.';
    case 'not-possible': return 'The keys of this run do not look like a run a person could play, so this course cannot be published.';
    case 'bad-course': return 'This course has something a shared course cannot hold (too big, or a part that is not allowed), so it cannot be published.';
    case 'body-too-big': return 'This course is too big to publish.';
    case 'not-ready': return 'Challenge courses are not ready yet. Try again later.';
  }
  return status === 429 ? shareWaitText(wait ?? 60) : status === 503 ? 'Challenge courses are not ready yet. Try again later.' : 'The server could not take this course. Try again in a minute.';
}

/** Ask the server to register the course the player just cleared. The server plays the keys itself; the page sends no time. */
export async function registerCourse(course: CourseData, session: string, runId: string, keys: string, claimedTicks: number, f: Fetcher = (u, i) => fetch(u, i)): Promise<Registered> {
  const c = madeCourse(course);
  if (!c) return { ok: false, error: registerErrorText(422, 'bad-course') };
  try {
    const res = await f('/api/challenge-course', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ session, runId, made: await packCourse(c), keys, claimedTicks }) });
    const d = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) { const wait = waitFromReply(res.status, d, res.headers.get('retry-after')); return { ok: false, error: registerErrorText(res.status, String(d.reason ?? ''), wait), retryAfter: wait ?? undefined }; }
    return { ok: true, id: String(d.id), boardHash: String(d.boardHash), duplicate: d.duplicate === true, promoted: d.promoted === true };
  } catch { return { ok: false, error: registerErrorText(0) }; }
}

/** The link to send a friend: the short link when the server answers (it opens the author's run as a ghost on the course), the long link otherwise. */
export async function challengeLink(origin: string, id: string, course: CourseData, log: InputLog, nick = '', look: 'a' | 'b' = 'a'): Promise<string | null> {
  const c = madeCourse(course);
  return c ? (await makeLinkInfo(origin, `?cid=${id}`, c, log, nick, look)).url : null;
}

/** A challenge course by its id (the course the server holds, cleaned again here), or null with why. */
export async function openChallengeCourse(id: string, f: Fetcher = (u, i) => fetch(u, i)): Promise<{ course: CourseData } | { course: null; gone: boolean }> {
  try {
    const res = await f(`/api/challenge-course?id=${encodeURIComponent(id)}`);
    if (!res.ok) return { course: null, gone: res.status === 410 };
    const c = cleanCourse(((await res.json()) as { course?: unknown }).course);
    return c ? { course: c } : { course: null, gone: false };
  } catch { return { course: null, gone: false }; }
}

export interface CommunityCourse { id: string; name: string; players: number; bestTicks: number | null }
export async function loadCommunity(f: Fetcher = (u, i) => fetch(u, i)): Promise<CommunityCourse[]> {
  try {
    const res = await f('/api/challenge-course?list=1');
    return res.ok ? (((await res.json()) as { courses?: CommunityCourse[] }).courses ?? []).filter((c) => /^[a-z2-9]{10}$/.test(c.id)) : [];
  } catch { return []; }
}

export const EXPIRES_DAYS = TTL_SECONDS / 86400;
