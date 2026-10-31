// Share a run as a link (CC-128). The link carries the keys of the run, never a time: the time is what the simulator says when it plays them.
import type { CourseData } from '../course/course';
import { nickOk, shownNick } from './nick';
import { waitFromReply } from '../sim/slow-down';
import courseJson from '../course/default-course.json';
import { madeCourse, MAX_MADE_CHARS, packCourse, SHARE_MAX_MADE_CHARS } from './made-course';
import { courseHash, makeChallengeParam, readChallengeParam, startXOf, verifyLog, type ChallengeKind, type GhostTrack, type InputLog } from '../sim/replay';

export const SHARE_ON = true; // the build switch; ?share=0 turns it off for one visit
export const shareOn = (params: URLSearchParams, build = SHARE_ON): boolean => build && params.get('share') !== '0';
export const MAX_PARAM_CHARS = 2000; // a link a chat app or a post will not cut

// Only these words of the address are kept in a link: the course, and the seed of a made course. No name, no time, no account.
const KEEP = ['course', 'seed', 'generate'];

export type OpenedChallenge = { ok: true; kind: ChallengeKind; track: GhostTrack; ticks: number; log: InputLog; nick: string; start: number } | { ok: false; why: 'version' | 'changed' | 'broken' | 'not-cleared' | 'too-big' };

/** Play the keys of a link on this course. The ghost and the time come from the simulator. */
export async function openChallenge(course: CourseData, param: string): Promise<OpenedChallenge> {
  const read = await readChallengeParam(param);
  if (!read.ok) return { ok: false, why: read.why };
  if (read.challenge.hash !== courseHash(course)) return { ok: false, why: 'changed' };
  const start = read.challenge.start, v = verifyLog(course, read.challenge.log, undefined, startXOf(course, start));
  if (read.challenge.kind === 'fell') { // a try that ended in a fall (CC-181): it must really end in a fall here; a run that clears, or never ends, is not what the link says
    if (v.cleared || v.world.outcome === 'running' || v.ticks < 1) return { ok: false, why: 'broken' };
    return { ok: true, kind: 'fell', track: v.track, ticks: v.ticks, log: read.challenge.log, nick: shownNick(read.challenge.nick), start };
  }
  if (!v.cleared) return { ok: false, why: 'not-cleared' };
  return { ok: true, kind: 'done', track: v.track, ticks: v.ticks, log: read.challenge.log, nick: shownNick(read.challenge.nick), start };
}

/** What a link is made of: the kept words of the address, the packed made course (or ''), and the challenge text. Null when the keys do not do what the link says, the tag is not allowed, or (with limits) the course is too big to carry. */
async function linkParts(search: string, course: CourseData, log: InputLog, nick: string, kind: ChallengeKind, limits: boolean, start = 0): Promise<{ keep: URLSearchParams; made: string; param: string } | null> {
  const fits = (c: CourseData): boolean => { const v = verifyLog(c, log, undefined, startXOf(c, start)); return kind === 'fell' ? !v.cleared && v.world.outcome !== 'running' && v.ticks >= 1 : v.cleared; };
  if (!nickOk(nick) || !fits(course)) return null;
  const from = new URLSearchParams(search), keep = new URLSearchParams();
  for (const k of KEEP) { const v = from.get(k); if (v) keep.set(k, v); }
  let played = course, made = '';
  if (carriesCourse(from, course)) { // a course made in the editor: the link carries it (CC-136)
    const c = madeCourse(course);
    if (!c || !fits(c)) return null;
    made = await packCourse(c);
    if (made.length > (limits ? MAX_MADE_CHARS : SHARE_MAX_MADE_CHARS)) return null;
    played = c;
  }
  return { keep, made, param: await makeChallengeParam(played, log, nick, kind, start) };
}

/** The long link for a cleared run (or, with kind 'fell', for a try that ended in a fall), or null when the keys do not do that on this course, the nickname is not allowed or the link would be too long. */
export async function makeChallengeUrl(origin: string, search: string, course: CourseData, log: InputLog, nick = '', look: 'a' | 'b' = 'a', kind: ChallengeKind = 'done', start = 0): Promise<string | null> {
  const p = await linkParts(search, course, log, nick, kind, true, start);
  if (!p) return null;
  const to = p.keep;
  if (p.made) to.set('made', p.made);
  if (p.param.length + p.made.length > MAX_PARAM_CHARS) return null;
  to.set('challenge', p.param);
  if (look === 'b') to.set('rk', 'b'); // CC-167: which Rookie the ghost wears; the first Rookie adds nothing, the second 5 characters
  return `${origin}/?${to.toString()}`;
}

// ---- the short link (CC-219): the server keeps the run, the address keeps ten characters ----
export const SHORT_ON = true; // the build switch; ?short=0 turns it off for one visit (the long link is then used)
export const shortOn = (params: URLSearchParams, build = SHORT_ON): boolean => build && params.get('short') !== '0';
type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
const within = async (f: Fetcher, url: string, init: RequestInit | undefined, ms = 4000): Promise<Response | null> => {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try { return await f(url, { ...init, signal: ctl.signal }); } catch { return null; } finally { clearTimeout(t); }
};

/** The short link for a run, or null when the server cannot keep it now (not reachable, switched off, table missing, course not supported). The caller then falls back to the long link.
 *  `wait` is set when the server asked the player to pause (too many shares): the seconds until the short link works again (CC-219). */
export async function tryShortUrl(origin: string, search: string, course: CourseData, log: InputLog, nick = '', look: 'a' | 'b' = 'a', kind: ChallengeKind = 'done', f: Fetcher = (u, i) => fetch(u, i), start = 0): Promise<{ url: string | null; wait: number | null }> {
  const p = await linkParts(search, course, log, nick, kind, false, start);
  if (!p) return { url: null, wait: null };
  const res = await within(f, '/api/share', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ param: p.param, query: p.keep.toString(), made: p.made || undefined, look }) });
  if (!res) return { url: null, wait: null };
  if (res.status === 429) { const body = await res.json().catch(() => null); return { url: null, wait: waitFromReply(429, body, res.headers.get('retry-after')) }; }
  if (!res.ok) return { url: null, wait: null };
  try { const id = ((await res.json()) as { id?: unknown }).id; return { url: typeof id === 'string' && /^[a-z2-9]{10}$/.test(id) ? `${origin}/?c=${id}` : null, wait: null }; } catch { return { url: null, wait: null }; }
}
export async function makeShortUrl(origin: string, search: string, course: CourseData, log: InputLog, nick = '', look: 'a' | 'b' = 'a', kind: ChallengeKind = 'done', f: Fetcher = (u, i) => fetch(u, i), start = 0): Promise<string | null> {
  return (await tryShortUrl(origin, search, course, log, nick, look, kind, f, start)).url;
}

/** The link to copy: short when the server answers, long otherwise. When the server asked for a pause, `wait` says for how long; the long link works at once (no server). */
export async function makeLinkInfo(origin: string, search: string, course: CourseData, log: InputLog, nick = '', look: 'a' | 'b' = 'a', kind: ChallengeKind = 'done', f?: Fetcher, start = 0): Promise<{ url: string | null; wait: number | null }> {
  let wait: number | null = null;
  if (shortOn(new URLSearchParams(search))) { const s = await tryShortUrl(origin, search, course, log, nick, look, kind, f, start); if (s.url) return { url: s.url, wait: null }; wait = s.wait; }
  return { url: await makeChallengeUrl(origin, search, course, log, nick, look, kind, start), wait };
}
export async function makeLink(origin: string, search: string, course: CourseData, log: InputLog, nick = '', look: 'a' | 'b' = 'a', kind: ChallengeKind = 'done', f?: Fetcher, start = 0): Promise<string | null> {
  return (await makeLinkInfo(origin, search, course, log, nick, look, kind, f, start)).url;
}

/** An address with ?c=<id> becomes the long form (course words, made course, challenge, look) so the rest of the page reads it as it always did. Null when the address has no short id; '' + broken when the id cannot be opened. */
export async function expandShortSearch(search: string, f: Fetcher = (u, i) => fetch(u, i)): Promise<string | null> {
  const from = new URLSearchParams(search), id = from.get('c');
  if (id === null || from.has('challenge') || !shareOn(from)) return null;
  const broken = (): string => { from.delete('c'); from.set('challenge', 'broken'); return `?${from.toString()}`; };
  if (!/^[a-z2-9]{10}$/.test(id)) return broken();
  const res = await within(f, `/api/share/${id}`, undefined);
  if (!res || !res.ok) return broken();
  try {
    const r = (await res.json()) as { param?: string; query?: string; made?: string; look?: string };
    if (typeof r.param !== 'string') return broken();
    from.delete('c');
    for (const [k, v] of new URLSearchParams(r.query ?? '')) if (KEEP.includes(k)) from.set(k, v);
    if (r.made) from.set('made', r.made);
    from.set('challenge', r.param);
    if (r.look === 'b') from.set('rk', 'b');
    return `?${from.toString()}`;
  } catch { return broken(); }
}

/** Whether the course must travel inside the link: it is not named in the address and is not the one every visitor starts on. */
function carriesCourse(from: URLSearchParams, course: CourseData): boolean {
  if (['course', 'generate', 'coaster', 'made'].some((k) => from.has(k))) return false;
  return courseHash(course) !== courseHash(courseJson as unknown as CourseData);
}

/** True when the course itself, not the run, is why no link can be made: it is too big to carry, or has something a link may not carry. */
export async function courseTooBig(search: string, course: CourseData): Promise<boolean> {
  if (!carriesCourse(new URLSearchParams(search), course)) return false;
  const c = madeCourse(course);
  return !c || (await packCourse(c)).length > MAX_MADE_CHARS;
}

const WORDS = {
  version: 'This link was made by an older version of the game, so its run cannot be played here.',
  changed: 'This course has changed since the link was made, so the run cannot be played here.',
  broken: 'This link is damaged, so its run cannot be played.',
  'not-cleared': 'The run in this link does not reach the finish on this course.',
  'too-big': 'The course in this link is too big or is damaged, so it cannot be opened.',
} as const;
/** Whether to offer the ideal ghost beside a refusal: yes when the course itself can still be played, no when the link is only damaged. */
export const offersIdeal = (why: keyof typeof WORDS): boolean => why !== 'broken' && why !== 'too-big';

export const challengeWords = (why: keyof typeof WORDS): string => WORDS[why];

export const secondsWords = (ticks: number): string => `${(ticks / 120).toFixed(2)} s`;
