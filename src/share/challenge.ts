// Share a run as a short link (CC-128, CC-219). The server keeps the keys of the run, never a time: the time is what the simulator says when it plays them.
import type { CourseData } from '../course/course';
import { nickOk, shownNick } from './nick';
import { waitFromReply } from '../sim/slow-down';
import courseJson from '../course/default-course.json';
import { madeCourse, packCourse, SHARE_MAX_MADE_CHARS } from './made-course';
import { COURSE_PATH } from './server';
import { courseHash, makeChallengeParam, readChallengeParam, startXOf, verifyLog, type ChallengeKind, type GhostTrack, type InputLog } from '../sim/replay';

export const SHARE_ON = true; // the build switch; ?share=0 turns it off for one visit
export const shareOn = (params: URLSearchParams, build = SHARE_ON): boolean => build && params.get('share') !== '0';

const KEEP = ['course', 'cid']; // the only words of an address a link keeps: the listed course file, or the challenge course id (CC-108)

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

/** What a share is made of: the kept words of the address, the packed course when the server cannot load it by itself (or ''), and the challenge text. Null when the keys do not do what the link says, the tag is not allowed, or the course is too big to carry. */
export async function prepareShare(search: string, course: CourseData, log: InputLog, nick: string, kind: ChallengeKind, start = 0): Promise<{ keep: URLSearchParams; made: string; param: string } | null> {
  const fits = (c: CourseData): boolean => { const v = verifyLog(c, log, undefined, startXOf(c, start)); return kind === 'fell' ? !v.cleared && v.world.outcome !== 'running' && v.ticks >= 1 : v.cleared; };
  if (!nickOk(nick) || !fits(course)) return null;
  const from = new URLSearchParams(search), keep = new URLSearchParams();
  let played = course, made = '';
  if (carriesCourse(from, course)) { // every course the server cannot load by itself (made, generated, coaster, Park, challenge) travels with the request (CC-219)
    const c = madeCourse(course);
    if (!c || !fits(c)) return null;
    made = await packCourse(c);
    if (made.length > SHARE_MAX_MADE_CHARS) return null;
    played = c;
    const cid = from.get('cid'); if (cid) keep.set('cid', cid); // the challenge course the link belongs to (CC-108)
  } else { const v = from.get('course'); if (v) keep.set('course', v); }
  return { keep, made, param: await makeChallengeParam(played, log, nick, kind, start) };
}

// ---- the short link (CC-219): the server keeps the run, the address keeps ten characters. It is the only kind of link. ----
type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
const within = async (f: Fetcher, url: string, init: RequestInit | undefined, ms = 4000): Promise<Response | null> => {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try { return await f(url, { ...init, signal: ctl.signal }); } catch { return null; } finally { clearTimeout(t); }
};

/** Why there is no link: `wait` = the server asked for a pause (seconds until it works again); `down` = the server cannot be reached or is switched off; neither = this run or course cannot be shared. */
export type LinkInfo = { url: string | null; wait: number | null; down?: boolean };

/** The short link for a run. */
export async function makeLinkInfo(origin: string, search: string, course: CourseData, log: InputLog, nick = '', look: 'a' | 'b' = 'a', kind: ChallengeKind = 'done', f: Fetcher = (u, i) => fetch(u, i), start = 0): Promise<LinkInfo> {
  const p = await prepareShare(search, course, log, nick, kind, start);
  if (!p) return { url: null, wait: null };
  const res = await within(f, '/api/share', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ param: p.param, query: p.keep.toString(), made: p.made || undefined, look }) });
  if (!res) return { url: null, wait: null, down: true };
  if (res.status === 429) { const body = await res.json().catch(() => null); return { url: null, wait: waitFromReply(429, body, res.headers.get('retry-after')) }; }
  if (!res.ok) return { url: null, wait: null, down: res.status >= 500 };
  try { const id = ((await res.json()) as { id?: unknown }).id; return typeof id === 'string' && /^[a-z2-9]{10}$/.test(id) ? { url: `${origin}/?c=${id}`, wait: null } : { url: null, wait: null, down: true }; } catch { return { url: null, wait: null, down: true }; }
}
export async function makeLink(origin: string, search: string, course: CourseData, log: InputLog, nick = '', look: 'a' | 'b' = 'a', kind: ChallengeKind = 'done', f?: Fetcher, start = 0): Promise<string | null> {
  return (await makeLinkInfo(origin, search, course, log, nick, look, kind, f, start)).url;
}

/** An address with ?c=<id> becomes the form the rest of the page reads (course word or made course, challenge, look). `c` stays in the address: it marks the challenge as coming from the server.
 *  Null when the address has no short id; a `challenge` with no `c` is an old long link and is not opened (see isOldLongLink). */
export async function expandShortSearch(search: string, f: Fetcher = (u, i) => fetch(u, i)): Promise<string | null> {
  const from = new URLSearchParams(search), id = from.get('c');
  if (id === null || from.has('challenge') || !shareOn(from)) return null;
  const broken = (): string => { from.set('challenge', 'broken'); return `?${from.toString()}`; };
  if (!/^[a-z2-9]{10}$/.test(id)) return broken();
  const res = await within(f, `/api/share/${id}`, undefined);
  if (!res || !res.ok) return broken();
  try {
    const r = (await res.json()) as { param?: string; query?: string; made?: string; look?: string };
    if (typeof r.param !== 'string') return broken();
    for (const k of ['course', 'generate', 'coaster', 'push', 'made', 'cid', 'seed']) from.delete(k); // the saved link names the course; the rest of the address is not part of it
    for (const [k, v] of new URLSearchParams(r.query ?? '')) if (KEEP.includes(k)) from.set(k, v);
    if (r.made) from.set('made', r.made);
    from.set('challenge', r.param);
    if (r.look === 'b') from.set('rk', 'b');
    return `?${from.toString()}`;
  } catch { return broken(); }
}

/** An old long address (?challenge=... with no short id) is not opened any more (CC-219). True when the address is one, so the page shows OLD_LINK_WORDS instead. */
export const isOldLongLink = (params: URLSearchParams): boolean => params.has('challenge') && params.get('challenge') !== '0' && params.get('challenge') !== 'broken' && !params.has('c');
export const OLD_LINK_WORDS = 'This is an old kind of link and it cannot be opened any more. Ask your friend to send a new one.';

/** Whether the course must travel with the request: the server cannot load it by itself. It can load only a listed course file and the course every visitor starts on. */
function carriesCourse(from: URLSearchParams, course: CourseData): boolean {
  const named = from.get('course');
  if (named !== null && COURSE_PATH.test(named) && !['generate', 'coaster', 'made', 'cid'].some((k) => from.has(k))) return false;
  return courseHash(course) !== courseHash(courseJson as unknown as CourseData);
}

/** True when the course itself, not the run, is why no link can be made: it is too big to carry, or has something a link may not carry. */
export async function courseTooBig(search: string, course: CourseData): Promise<boolean> {
  if (!carriesCourse(new URLSearchParams(search), course)) return false;
  const c = madeCourse(course);
  return !c || (await packCourse(c)).length > SHARE_MAX_MADE_CHARS;
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
