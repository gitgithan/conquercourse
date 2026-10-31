// /api/challenge-course (CC-108). POST: register a challenge course after the author's run clears it on the server replay. GET ?id=<id>: the course of a link. GET ?list=1: the Community list (promoted courses only).
// The logic is in src/share/challenge-course.ts; this file is the D1 side. The Pages variable CHALLENGE=off answers 503.
import { listCommunity, readChallenge, registerChallenge, type ChallengeEnv } from '../../src/share/challenge-course';
import { d1Challenges, type Db } from '../_lib/challenge-db';
import { playerCode } from '../_lib/player';
import { json as base } from '../_lib/http';

export interface Env { DB: Db; CHALLENGE?: string; REPLAY?: string }
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => base(body, status, { 'cache-control': 'no-store', ...extra });
const hits = new Map<string, number[]>();

export const challengeEnv = (env: Env, request: Request): ChallengeEnv => ({
  store: d1Challenges(env.DB), hits, address: request.headers.get('cf-connecting-ip') ?? 'local', now: () => Date.now(),
  randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)), playerOf: (s) => playerCode(s, 'cc-board'),
});

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  if (env.CHALLENGE === 'off') return json({ error: 'off', reason: 'not-ready' }, 503);
  try {
    const r = await registerChallenge(challengeEnv(env, request), await request.text(), env.REPLAY === 'off');
    return json(r.body, r.status, r.headers);
  } catch (e) {
    const code = /D1_|SQLITE|database|no such table/i.test(String((e as Error)?.message)) ? 'db-error' : 'server-error';
    return json({ error: 'unavailable', reason: 'not-ready', code }, 503); // most likely migration 0013 is not applied: the page then says so
  }
};

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  if (env.CHALLENGE === 'off') return json({ error: 'off', reason: 'not-ready' }, 503);
  const q = new URL(request.url).searchParams;
  try {
    const e = challengeEnv(env, request);
    const r = q.get('list') ? await listCommunity(e) : await readChallenge(e, q.get('id') ?? '');
    return json(r.body, r.status, r.status === 200 && !q.get('list') ? { 'cache-control': 'no-store' } : {});
  } catch { return q.get('list') ? json({ courses: [] }) : json({ error: 'unavailable', reason: 'not-ready' }, 503); }
};
