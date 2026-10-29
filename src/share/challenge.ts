// Share a run as a link (CC-128). The link carries the keys of the run, never a time: the time is what the simulator says when it plays them.
import type { CourseData } from '../course/course';
import { nickOk, shownNick } from './nick';
import { courseHash, makeChallengeParam, readChallengeParam, verifyLog, type GhostTrack, type InputLog } from '../sim/replay';

export const SHARE_ON = true; // the build switch; ?share=0 turns it off for one visit
export const shareOn = (params: URLSearchParams, build = SHARE_ON): boolean => build && params.get('share') !== '0';
export const MAX_PARAM_CHARS = 2000; // a link a chat app or a post will not cut

// Only these words of the address are kept in a link: the course, and the seed of a made course. No name, no time, no account.
const KEEP = ['course', 'seed'];

export type OpenedChallenge = { ok: true; track: GhostTrack; ticks: number; log: InputLog; nick: string } | { ok: false; why: 'version' | 'changed' | 'broken' | 'not-cleared' };

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
  const param = await makeChallengeParam(course, log, nick);
  if (param.length > MAX_PARAM_CHARS) return null;
  const from = new URLSearchParams(search), to = new URLSearchParams();
  for (const k of KEEP) { const v = from.get(k); if (v) to.set(k, v); }
  to.set('challenge', param);
  return `${origin}/?${to.toString()}`;
}

const WORDS = {
  version: 'This link was made by an older version of the game, so its run cannot be played here.',
  changed: 'This course has changed since the link was made, so the run cannot be played here.',
  broken: 'This link is damaged, so its run cannot be played.',
  'not-cleared': 'The run in this link does not reach the finish on this course.',
} as const;
/** Whether to offer the ideal ghost beside a refusal: yes when the course itself can still be played, no when the link is only damaged. */
export const offersIdeal = (why: keyof typeof WORDS): boolean => why !== 'broken';

export const challengeWords = (why: keyof typeof WORDS): string => WORDS[why];

export const secondsWords = (ticks: number): string => `${(ticks / 120).toFixed(2)} s`;
