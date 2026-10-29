// Share a run as a link (CC-128). The link carries the keys of the run, never a time: the time is what the simulator says when it plays them.
import type { CourseData } from '../course/course';
import { nickOk, shownNick } from './nick';
import courseJson from '../course/default-course.json';
import { madeCourse, MAX_MADE_CHARS, packCourse } from './made-course';
import { courseHash, makeChallengeParam, readChallengeParam, verifyLog, type GhostTrack, type InputLog } from '../sim/replay';

export const SHARE_ON = true; // the build switch; ?share=0 turns it off for one visit
export const shareOn = (params: URLSearchParams, build = SHARE_ON): boolean => build && params.get('share') !== '0';
export const MAX_PARAM_CHARS = 2000; // a link a chat app or a post will not cut

// Only these words of the address are kept in a link: the course, and the seed of a made course. No name, no time, no account.
const KEEP = ['course', 'seed', 'generate'];

export type OpenedChallenge = { ok: true; track: GhostTrack; ticks: number; log: InputLog; nick: string } | { ok: false; why: 'version' | 'changed' | 'broken' | 'not-cleared' | 'too-big' };

/** Play the keys of a link on this course. The ghost and the time come from the simulator. */
export async function openChallenge(course: CourseData, param: string): Promise<OpenedChallenge> {
  const read = await readChallengeParam(param);
  if (!read.ok) return { ok: false, why: read.why };
  if (read.challenge.hash !== courseHash(course)) return { ok: false, why: 'changed' };
  const v = verifyLog(course, read.challenge.log);
  if (!v.cleared) return { ok: false, why: 'not-cleared' };
  return { ok: true, track: v.track, ticks: v.ticks, log: read.challenge.log, nick: shownNick(read.challenge.nick) };
}

/** The link for a cleared run, or null when the keys do not clear this course the nickname is not allowed or the link would be too long. */
export async function makeChallengeUrl(origin: string, search: string, course: CourseData, log: InputLog, nick = ''): Promise<string | null> {
  if (!nickOk(nick) || !verifyLog(course, log).cleared) return null;
  const from = new URLSearchParams(search), to = new URLSearchParams();
  for (const k of KEEP) { const v = from.get(k); if (v) to.set(k, v); }
  let played = course, made = '';
  if (carriesCourse(from, course)) { // a course made in the editor: the link carries it (CC-136)
    const c = madeCourse(course);
    if (!c || !verifyLog(c, log).cleared) return null;
    made = await packCourse(c);
    if (made.length > MAX_MADE_CHARS) return null;
    played = c;
    to.set('made', made);
  }
  const param = await makeChallengeParam(played, log, nick);
  if (param.length + made.length > MAX_PARAM_CHARS) return null;
  to.set('challenge', param);
  return `${origin}/?${to.toString()}`;
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
