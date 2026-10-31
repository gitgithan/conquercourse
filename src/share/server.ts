// The server side of a short share link (CC-219): store a run once, hand it back by a short id.
// Pure TypeScript with an injected store, so the same code runs in the Pages Function and in the tests. See docs/data-model.md.
// Checks before storing: size, a readable version-1 challenge, a course that exists and has the hash the keys were played on, the cheap run checks (src/sim/run-checks.ts).
// The server does not replay the keys: whoever opens the link replays them and takes the time from the simulator; a leaderboard time goes through /api/course-clear.
import type { CourseData } from '../course/course';
import courseJson from '../course/default-course.json';
import { courseHash, nickToWire, readChallengeParam, REPLAY_VERSION, startXOf, type ChallengeKind } from '../sim/replay';
import { checkRun, logTicks, rateLimited, rateWaitSeconds } from '../sim/run-checks';
import { slowDownReply } from '../sim/slow-down';
import { SHARE_MAX_MADE_CHARS, unpackCourse } from './made-course';

export const MAX_SHARE_BODY = 32_000; // characters of the request: the made course (20000) plus the keys (8000) plus the words around them
export const SHARES_PER_ADDRESS = 20; // in 10 minutes, the same limiter as the replay
export const SHARES_PER_HOUR = 3000; // for the whole site: a flood cannot fill the database
export const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // 31 characters, no i, l, o, 0 or 1
export const ID_LENGTH = 10;
export const ID_RE = /^[a-z2-9]{10}$/;
export const COURSE_KEY = /^(demo|experiments\/osm)\/[a-z0-9-]{1,60}$/; // the same list as /api/course-clear
const COURSE_PATH = /^\/assets\/((?:demo|experiments\/osm)\/[a-z0-9-]{1,60})\.course\.json$/;

export interface ShareRow {
  id: string; created_at: number; sim_version: number; kind: ChallengeKind; course_kind: 'asset' | 'default' | 'made'; course_key: string; course_hash: string;
  query: string; made: string | null; nick: string; look: string; ticks: number; keys: string; content_hash: string; beats_ideal: number; status: 'ok' | 'hidden';
}
/** What the code needs from a database. The D1 one is in functions/api/share.ts; the tests use an in-memory one. */
export interface ShareStore {
  byContentHash(h: string): Promise<string | null>;
  insert(row: ShareRow): Promise<boolean>; // false when the id is already taken
  get(id: string): Promise<ShareRow | null>;
  countSince(unix: number): Promise<number>;
  oldestSince?(unix: number): Promise<number | null>; // the first row newer than this time, so a refusal can say when the window frees up
}
export interface ShareEnv {
  store: ShareStore;
  /** The course file of a listed course, or null. */
  loadCourse(key: string): Promise<CourseData | null>;
  idealTicks?(key: string): Promise<number | null>;
  hits: Map<string, number[]>;
  now(): number; // ms
  address: string;
  randomBytes(n: number): Uint8Array;
}
export type Reply = { status: number; body: Record<string, unknown>; headers?: Record<string, string> };
const fail = (status: number, error: string, extra: Record<string, unknown> = {}): Reply => ({ status, body: { error, ...extra } });
const slow = (seconds: number): Reply => { const r = slowDownReply(seconds); return { status: 429, body: r.body, headers: r.headers }; }; // CC-219: a refusal always says when to come back

/** A random id from the 31-letter alphabet; bytes above 247 are skipped so every letter is equally likely. */
export function newId(random: (n: number) => Uint8Array): string {
  let out = '';
  while (out.length < ID_LENGTH) for (const b of random(16)) if (b < 248 && out.length < ID_LENGTH) out += ID_ALPHABET[b % 31];
  return out;
}

export async function contentHash(parts: string[]): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.join('\n')));
  return [...new Uint8Array(d)].slice(0, 16).map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Read the words of the address a link keeps: only the course file (nothing else can be loaded by the server). */
function courseWord(query: string): { path: string | null; extra: boolean } {
  const q = new URLSearchParams(query);
  const extra = [...q.keys()].some((k) => k !== 'course');
  return { path: q.get('course'), extra };
}

export async function createShare(env: ShareEnv, raw: string): Promise<Reply> {
  if (raw.length > MAX_SHARE_BODY) return fail(413, 'too long');
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return fail(400, 'bad json'); }
  const param = String(b.param ?? ''), query = String(b.query ?? ''), made = b.made === undefined || b.made === '' ? null : String(b.made), look = b.look === 'b' ? 'b' : 'a';
  if (query.length > 200 || (made !== null && made.length > SHARE_MAX_MADE_CHARS)) return fail(413, 'too long');
  if (rateLimited(env.hits, env.address, env.now(), SHARES_PER_ADDRESS)) return slow(rateWaitSeconds(env.hits, env.address, env.now()));
  const read = await readChallengeParam(param);
  if (!read.ok) return fail(400, read.why === 'version' ? 'old version' : 'bad keys');
  const { hash, nick, log, kind, start } = read.challenge;
  // which course: a listed file, the course every visitor starts on, or a made course carried with the request
  const { path, extra } = courseWord(query);
  if (extra) return fail(422, 'course not supported');
  let course: CourseData | null = null, courseKind: ShareRow['course_kind'], key = '';
  if (made !== null) { courseKind = 'made'; if (path) return fail(400, 'bad course'); course = await unpackCourse(made, SHARE_MAX_MADE_CHARS); if (!course) return fail(400, 'bad course'); }
  else if (path) {
    const m = COURSE_PATH.exec(path); if (!m) return fail(422, 'course not supported');
    courseKind = 'asset'; key = m[1]; course = await env.loadCourse(key); if (!course) return fail(404, 'no such course');
  } else { courseKind = 'default'; course = courseJson as unknown as CourseData; }
  if (courseHash(course) !== hash) return fail(409, 'course changed');
  const total = logTicks(log);
  const pre = checkRun({ log, course: kind === 'fell' ? { startX: 0, finishX: 0 } : start > 0 ? { ...course, startX: startXOf(course, start) } : course, // CC-242: a run from a checkpoint is checked from that checkpoint
    idealTicks: kind === 'done' && courseKind === 'asset' ? await env.idealTicks?.(key) : null });
  if (!pre.ok) return fail(422, 'not a possible run', { code: pre.code });
  const keys = (start > 0 ? `s${start}~` : '') + param.slice(param.lastIndexOf('.') + 1); // CC-242: the start rides in front of the keys, so no new column is needed
  const content = await contentHash([String(REPLAY_VERSION), kind, hash, nick, look, courseKind === 'asset' ? key : '', made ?? '', keys]);
  const same = await env.store.byContentHash(content);
  if (same) return { status: 200, body: { id: same, duplicate: true } };
  const nowS = Math.floor(env.now() / 1000);
  if ((await env.store.countSince(nowS - 3600)) >= SHARES_PER_HOUR) {
    const oldest = await env.store.oldestSince?.(nowS - 3600) ?? null;
    return slow(oldest === null ? 300 : oldest + 3600 - nowS);
  }
  const row: ShareRow = { id: '', created_at: nowS, sim_version: REPLAY_VERSION, kind, course_kind: courseKind, course_key: key, course_hash: hash, query: path ? `course=${path}` : '', made, nick, look, ticks: total, keys, content_hash: content, beats_ideal: pre.beatsIdeal ? 1 : 0, status: 'ok' };
  for (let tries = 0; tries < 5; tries++) { // a taken id is rare (31^10 ids); try another
    row.id = newId(env.randomBytes);
    if (await env.store.insert(row)) return { status: 201, body: { id: row.id } };
  }
  return fail(503, 'try again');
}

const shareParam = (r: ShareRow): string => {
  const m = /^s(\d{1,2})~/.exec(r.keys);
  return `${r.sim_version}${r.kind === 'fell' ? 'f' : ''}${m ? `s${m[1]}` : ''}.${r.course_hash}.${nickToWire(r.nick)}.${m ? r.keys.slice(m[0].length) : r.keys}`;
};

/** What a link needs to open: the pieces of the long link, rebuilt. */
export async function readShare(env: Pick<ShareEnv, 'store'>, id: string): Promise<Reply> {
  if (!ID_RE.test(id)) return fail(404, 'no such link');
  const r = await env.store.get(id);
  if (!r || r.status !== 'ok') return fail(404, 'no such link');
  return { status: 200, body: { id: r.id, param: shareParam(r), query: r.query, made: r.made ?? undefined, look: r.look, kind: r.kind } };
}
