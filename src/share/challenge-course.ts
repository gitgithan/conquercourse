// Challenge courses (CC-108): a course the player changed can be registered once the author's own run clears it on the SERVER replay.
// Pure TypeScript with an injected store, so the same code runs in the Pages Function and in the tests. The story in plain words: docs/challenge-courses.md.
//   - ranked boards (src/share/board-courses.ts) take only the official course; every other course is a challenge course
//   - registration needs a verified clear by the author; the same course (same canonical JSON) is one entry
//   - it is found by its link only; it joins the Community list after ANOTHER player clears it; unpromoted courses expire
import type { CourseData } from '../course/course';
import { courseHash, decodeLog, verifyLog } from '../sim/replay';
import { checkRun, MAX_CLEAR_TICKS, physicsFloorTicks, rateLimited, rateWaitSeconds } from '../sim/run-checks';
import { slowDownReply } from '../sim/slow-down';
import { cleanCourse, madeCourse, SHARE_MAX_MADE_CHARS, unpackCourse } from './made-course';
import { contentHash, ID_ALPHABET, ID_LENGTH, ID_RE, newId } from './server';

export { ID_ALPHABET, ID_LENGTH, ID_RE };
/** The build switch; `?challenge=0` hides the feature for one visit (src/flags.ts convention: the helper takes the params). */
export const CHALLENGE_ON = true;
export const challengeOn = (params: URLSearchParams, build = CHALLENGE_ON): boolean => build && params.get('challenge') !== '0';
/** The id of a challenge course in the address (?cid=), or null when it is missing or badly shaped. */
export const cidOf = (params: URLSearchParams): string | null => { const v = params.get('cid'); return v && ID_RE.test(v) ? v : null; };
export const CHALLENGE_PREFIX = 'challenge/';
export const challengeKey = (id: string): string => `${CHALLENGE_PREFIX}${id}`;
export const isChallengeKey = (key: string): boolean => key.startsWith(CHALLENGE_PREFIX) && ID_RE.test(key.slice(CHALLENGE_PREFIX.length));
export const challengeIdOf = (key: string): string | null => (isChallengeKey(key) ? key.slice(CHALLENGE_PREFIX.length) : null);

/** The short hash of a key string that /api/course-clear keeps as log_hash. */
export function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}
export const TTL_SECONDS = 14 * 86400; // an unpromoted course expires after about two weeks
export const MAX_STORED_CHARS = 40_000; // the cleaned course JSON kept per row; the biggest demo course is about 25 000
export const MAX_REGISTER_BODY = SHARE_MAX_MADE_CHARS + 12_000; // the packed course plus the keys plus the words around them
export const MAX_KEYS_CHARS = 8000;
export const MAX_LIVE_UNPROMOTED = 5000; // for the whole site: a flood cannot fill the table
// The per-player creation cap: the number lives here as a code constant; how a player is told apart and why is in the private notes.
export const CREATIONS_PER_PLAYER_PER_DAY = 5;
export const CREATIONS_PER_ADDRESS = 10; // in 10 minutes, the same limiter as the replay
export const LIST_LIMIT = 40;

export interface ChallengeRow {
  id: string; content_hash: string; board_hash: string; name: string; course: string; author: string; author_ticks: number;
  created_at: number; promoted_at: number | null; expires_at: number | null;
}
export interface CommunityEntry { id: string; name: string; players: number; bestTicks: number | null }
export interface ChallengeStore {
  byContentHash(h: string): Promise<ChallengeRow | null>;
  get(id: string): Promise<ChallengeRow | null>;
  insert(row: ChallengeRow): Promise<boolean>; // false when the id is taken
  createdBySince(author: string, unix: number): Promise<number>;
  liveUnpromoted(now: number): Promise<number>;
  purgeExpired(now: number): Promise<void>; // the expired, unpromoted courses and their clears
  promote(id: string, now: number): Promise<void>;
  /** The author's own clear (a counted run, never a published one), so the course has a first time on its board. */
  addClear(id: string, boardHash: string, ticks: number, runId: string, logHash: string, player: string): Promise<void>;
  community(now: number, limit: number): Promise<CommunityEntry[]>;
}
export interface ChallengeEnv {
  store: ChallengeStore;
  hits: Map<string, number[]>;
  address: string;
  now(): number; // ms
  randomBytes(n: number): Uint8Array;
  /** The one-way code of this browser session (functions/_lib/player.ts). */
  playerOf(session: string): Promise<string>;
}
export type Reply = { status: number; body: Record<string, unknown>; headers?: Record<string, string> };
const fail = (status: number, reason: string, extra: Record<string, unknown> = {}): Reply => ({ status, body: { error: reason, reason, ...extra } });

/** The rule that makes a course appear in the Community list: a verified clear by a player who is not its author. The author's own clear never does, however many there are. */
export const promotes = (author: string, clearer: string): boolean => clearer !== '' && clearer !== author;

export const isLive = (row: Pick<ChallengeRow, 'promoted_at' | 'expires_at'>, nowS: number): boolean => row.promoted_at !== null || (row.expires_at !== null && row.expires_at > nowS);
export const expiryOf = (createdS: number): number => createdS + TTL_SECONDS;

/** The canonical form of a course: cleaned (the shape rules of a made course), without looks and without the stored plans the course hash ignores. Key order is kept: the board hash reads it. Null when anything is off or it is too big. */
export function canonicalCourse(raw: unknown): { course: CourseData; json: string; boardHash: string } | null {
  const c = raw && typeof raw === 'object' ? madeCourse(raw as CourseData) : null;
  if (!c) return null;
  const { plan: _p, shortcuts: _s, routes: _r, ...rest } = c as CourseData & { plan?: unknown; shortcuts?: unknown; routes?: unknown };
  const clean = cleanCourse(JSON.parse(JSON.stringify(rest)));
  if (!clean) return null;
  const json = JSON.stringify(clean);
  if (json.length > MAX_STORED_CHARS) return null;
  return { course: clean, json, boardHash: courseHash(clean) };
}
export const courseContentHash = (json: string): Promise<string> => contentHash(['challenge-course', json]);

/** What registering needs from the page: the packed course, the keys of the author's run, the session. */
export interface RegisterBody { session: string; runId: string; made: string; keys: string; claimedTicks?: number }
const ID = /^[a-zA-Z0-9-]{8,64}$/;

function parseBody(raw: string): RegisterBody | Reply {
  if (raw.length > MAX_REGISTER_BODY) return fail(413, 'body-too-big');
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return fail(400, 'bad-run'); }
  const session = String(b.session ?? ''), runId = String(b.runId ?? ''), made = String(b.made ?? ''), keys = String(b.keys ?? '');
  const claimed = b.claimedTicks === undefined ? undefined : Number(b.claimedTicks);
  if (!ID.test(session) || !ID.test(runId) || !made || !keys || keys.length > MAX_KEYS_CHARS || (claimed !== undefined && !Number.isInteger(claimed))) return fail(400, 'bad-run');
  return { session, runId, made, keys, claimedTicks: claimed };
}

/** POST: register a challenge course. Order of the checks: shape of the course, then (only then) the replay of the author's run. */
export async function registerChallenge(env: ChallengeEnv, raw: string, replayOff = false): Promise<Reply> {
  const b = parseBody(raw);
  if ('status' in b) return b;
  if (rateLimited(env.hits, env.address, env.now(), CREATIONS_PER_ADDRESS)) { const r = slowDownReply(rateWaitSeconds(env.hits, env.address, env.now())); return { status: 429, body: r.body, headers: r.headers }; }
  const unpacked = await unpackCourse(b.made, SHARE_MAX_MADE_CHARS);
  const canon = unpacked ? canonicalCourse(unpacked) : null;
  if (!canon) return fail(422, 'bad-course');
  const nowS = Math.floor(env.now() / 1000);
  await env.store.purgeExpired(nowS);
  const author = await env.playerOf(b.session);
  const content = await courseContentHash(canon.json);
  const same = await env.store.byContentHash(content);
  // the run must clear THIS course on the server replay, whoever sends it (the tests of the checks are those of the board: src/sim/run-checks.ts)
  let log;
  try { log = await decodeLog(b.keys); } catch { return fail(400, 'bad-run'); }
  const pre = checkRun({ log, course: canon.course, claimedTicks: b.claimedTicks });
  if (!pre.ok) return fail(422, 'not-possible', { code: pre.code });
  if (replayOff) return fail(503, 'not-ready');
  let v: ReturnType<typeof verifyLog>;
  try { v = verifyLog(canon.course, log, MAX_CLEAR_TICKS); } catch { return fail(503, 'server-error', { code: 'replay-failed' }); }
  if (!v.cleared || v.ticks < physicsFloorTicks(canon.course)) return fail(422, 'not-a-clear');
  const logHash = fnv(b.keys); // the same short hash /api/course-clear keeps, so the author's keys sent by someone else are a duplicate, not a play
  if (same && isLive(same, nowS)) {
    // the same course again: one entry. A clear by someone else is still a clear, so it can promote the course.
    await env.store.addClear(same.id, same.board_hash, v.ticks, b.runId, logHash, author);
    if (promotes(same.author, author) && same.promoted_at === null) await env.store.promote(same.id, nowS);
    return { status: 200, body: { id: same.id, duplicate: true, ticks: v.ticks, boardHash: same.board_hash, promoted: same.promoted_at !== null || promotes(same.author, author) } };
  }
  if ((await env.store.createdBySince(author, nowS - 86400)) >= CREATIONS_PER_PLAYER_PER_DAY) return fail(429, 'creation-cap');
  if ((await env.store.liveUnpromoted(nowS)) >= MAX_LIVE_UNPROMOTED) { const r = slowDownReply(600); return { status: 429, body: r.body, headers: r.headers }; }
  const row: ChallengeRow = { id: '', content_hash: content, board_hash: canon.boardHash, name: String((canon.course as { name?: string }).name ?? 'Challenge course').slice(0, 60), course: canon.json, author, author_ticks: v.ticks, created_at: nowS, promoted_at: null, expires_at: expiryOf(nowS) };
  for (let tries = 0; tries < 5; tries++) {
    row.id = newId(env.randomBytes);
    if (await env.store.insert(row)) {
      await env.store.addClear(row.id, row.board_hash, v.ticks, b.runId, logHash, author);
      return { status: 201, body: { id: row.id, ticks: v.ticks, boardHash: row.board_hash, promoted: false, expiresAt: row.expires_at } };
    }
  }
  return fail(503, 'server-error', { code: 'id-taken' });
}

/** GET ?id=: the course for a link. Reachable by its id only; an expired, unpromoted course answers gone. */
export async function readChallenge(env: Pick<ChallengeEnv, 'store' | 'now'>, id: string): Promise<Reply> {
  if (!ID_RE.test(id)) return fail(404, 'no-course');
  const r = await env.store.get(id);
  if (!r) return fail(404, 'no-course');
  if (!isLive(r, Math.floor(env.now() / 1000))) return fail(410, 'challenge-gone');
  return { status: 200, body: { id: r.id, name: r.name, course: JSON.parse(r.course), boardHash: r.board_hash, promoted: r.promoted_at !== null, expiresAt: r.expires_at } };
}

/** GET ?list=1: the Community list. Only promoted, live courses; never an unpromoted one. */
export async function listCommunity(env: Pick<ChallengeEnv, 'store' | 'now'>): Promise<Reply> {
  await env.store.purgeExpired(Math.floor(env.now() / 1000));
  return { status: 200, body: { courses: await env.store.community(Math.floor(env.now() / 1000), LIST_LIMIT) } };
}

/** What the server needs to judge a clear on a challenge course: the course itself (from storage, never from the client), or why not. */
export async function loadChallengeCourse(store: Pick<ChallengeStore, 'get'>, key: string, nowS: number): Promise<{ ok: true; course: CourseData; row: ChallengeRow } | { ok: false; gone: boolean }> {
  const id = challengeIdOf(key);
  if (!id) return { ok: false, gone: false };
  const row = await store.get(id);
  if (!row) return { ok: false, gone: false };
  if (!isLive(row, nowS)) return { ok: false, gone: true };
  return { ok: true, course: JSON.parse(row.course) as CourseData, row };
}

