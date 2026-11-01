// /api/character: community characters (CC-108). A player describes a character; a provider (route A: Muse Image, SAM 3.1, SAM 3D Objects, our rig) makes a
// packaged 34-bone glb; the server checks the size caps, stores it, and lists the newest 24 of each kind. See docs/character-pipeline.md.
//   GET  ?kind=character|object          -> {items: CharacterCard[] (newest 24, thumbnails only), canCreate, providers}
//   GET  ?id=<16 hex>                    -> the glb bytes, cached for ever (the id is the content hash)
//   POST {action:"create", prompt, provider?}  -> {id} | {state:"done", character, duplicate:true} | a refusal ({error, message, retryAfterSeconds})
//   POST {action:"status", id}           -> {state:"running", stage, index, total, words} | {state:"done", character} | {state:"failed", reason}
//   POST {action:"pick", id}             -> {ok:true}   (counts a use; characters picked 10 times are kept)
//   POST {action:"delete", id}           -> {ok:true}   (only the player who made it; ownership is a one-way code)
//   POST {action:"publish", id}          -> {ok:true}   (only the maker; a private character becomes visible to everyone)
// A made character starts private (status 'private': only its maker sees it, kept 30 days unused); Publish makes it 'ok'. GET also takes sort=newest|picked, q=<name search>, page=<0 based>.
// The gates, in order: request shape -> burst limit -> prompt rules -> optional safety check -> same prompt already made -> daily slot -> start the job.
// A slot is taken only after those pass and given back once if the job fails. Abuse limits: kept in the private notes.
import { waitTimer } from '../_lib/analytics';
import { cardName, cleanPrompt, promptKey, promptProblem } from '../../src/characters/prompt';
import { glbProblems, THUMB_OK } from '../../src/characters/limits';
import { CHARACTER_STEPS, EXPIRY_DAYS, KEEPER_PICKS, PANEL_SIZE, PRIVATE_DAYS, type CharacterCard } from '../../src/characters/steps';
import { DEFAULT_PROVIDER, JOB_ID, PROVIDERS, type Env, type JobState } from '../../src/characters/providers';
import { moderationStops } from '../../src/slice/object-lift';
import { askModeration } from './moderate';
import { limited, waitSeconds } from './designer';
import { refusalBody, secondsToNextDay, stageIndex } from '../../src/slice/stages';
import { d1Ledger } from '../../src/slice/d1-ledger';
import { memoryLedger, utcDay, type Ledger, type Limits } from '../../src/slice/upload-gates';
import { playerCode } from '../_lib/player';
import { json } from '../_lib/http';
import { featureOn, offWords, recordUsage } from '../_lib/usage';
import { checkTurnstile, type TurnstileEnv } from '../_lib/turnstile';

interface Stmt { bind(...v: unknown[]): { run(): Promise<{ meta?: { changes?: number } }>; first<T>(): Promise<T | null>; all(): Promise<{ results: Record<string, unknown>[] }> } }
export interface Db { prepare(sql: string): Stmt }
type Row = { status?: string; id: string; ts: string; kind: string; owner: string; name: string; prompt: string; provider: string; route: string; bytes: number; faces: number; thumb: string; picks: number; last_pick: string | null };

const SALT = 'cc-char';
const sharedLedger = memoryLedger(); // only for local runs without a database
const dayKey = (day: string): string => `char|${day}`; // its own rows in upload_days, apart from the object slots
export const b64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const unb64 = (b: Uint8Array): string => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };

/** The daily numbers come from a secret (CC_CHAR_LIMITS = "perPlayer,perGame"); with none set the maker is closed to all but one character a day for the whole game. */
export function charLimits(env: Env): Limits {
  const m = /^(\d{1,4}),(\d{1,6})$/.exec(env.CC_CHAR_LIMITS ?? '');
  return m ? { perPlayer: Number(m[1]), perGame: Number(m[2]) } : { perPlayer: 1, perGame: 1 };
}

const card = (r: Row, who: string): CharacterCard => ({ id: r.id, kind: r.kind === 'object' ? 'object' : 'character', name: r.name, prompt: r.prompt, provider: r.provider, route: r.route, bytes: r.bytes, faces: r.faces, picks: r.picks, keeper: r.picks >= KEEPER_PICKS, ts: r.ts, mine: r.owner === who, thumb: `data:image/webp;base64,${r.thumb}`, ...(r.status === 'private' ? { private: true } : {}) });
const COLS = 'id, status, ts, kind, owner, name, prompt, provider, route, bytes, faces, thumb, picks, last_pick';

/** Published characters nobody picked for 14 days go (a Keeper, 10 or more picks, stays); a private one goes after 30 days unused. */
export async function expire(db: Db): Promise<number> {
  const a = await db.prepare(`DELETE FROM characters WHERE status = 'private' AND COALESCE(last_pick, ts) < datetime('now', ?)`).bind(`-${PRIVATE_DAYS} days`).run();
  const r = await db.prepare(`DELETE FROM characters WHERE status != 'private' AND picks < ? AND COALESCE(last_pick, ts) < datetime('now', ?)`).bind(KEEPER_PICKS, `-${EXPIRY_DAYS} days`).run();
  return (r.meta?.changes ?? 0) + (a.meta?.changes ?? 0);
}

export interface ListQuery { sort?: string; q?: string; page?: number }
/** The shared panel: published ones only, newest or most picked, an optional name search, one page of PANEL_SIZE (`more` says whether another page follows). */
export async function listPage(db: Db, kind: string, who: string, o: ListQuery = {}): Promise<{ items: CharacterCard[]; more: boolean }> {
  await expire(db);
  const k = kind === 'object' ? 'object' : 'character', page = Math.max(0, Math.min(1000, Math.floor(o.page ?? 0)));
  const like = (o.q ?? '').trim().slice(0, 40).replace(/[%_\\]/g, (c) => `\\${c}`);
  const order = o.sort === 'picked' ? 'picks DESC, ts DESC, rowid DESC' : 'ts DESC, rowid DESC';
  const rows = await db.prepare(`SELECT ${COLS} FROM characters WHERE kind = ? AND status = 'ok' AND reports < 3 AND name LIKE ? ESCAPE '\\' ORDER BY ${order} LIMIT ? OFFSET ?`).bind(k, `%${like}%`, PANEL_SIZE + 1, page * PANEL_SIZE).all();
  const all = (rows.results as unknown as Row[]).map((r) => card(r, who));
  return { items: all.slice(0, PANEL_SIZE), more: all.length > PANEL_SIZE };
}
export async function list(db: Db, kind: string, who: string): Promise<CharacterCard[]> { return (await listPage(db, kind, who)).items; }
/** The maker's own private characters, newest first (never shown to anyone else). */
export async function mine(db: Db, who: string): Promise<CharacterCard[]> {
  const rows = await db.prepare(`SELECT ${COLS} FROM characters WHERE kind = 'character' AND status = 'private' AND owner = ? ORDER BY ts DESC, rowid DESC LIMIT ?`).bind(who, PANEL_SIZE).all();
  return (rows.results as unknown as Row[]).map((r) => card(r, who));
}

export interface Deps { db: Db; env: Env; ip: string; fetcher?: typeof fetch; ledger?: Ledger; now?: number; burstMax?: number }

const refuse = (status: number, body: unknown) => ({ status, body });

export async function handle(b: Record<string, unknown>, d: Deps): Promise<{ status: number; body: unknown }> {
  const { db, env, ip } = d, fetcher = d.fetcher ?? fetch, now = d.now ?? Date.now(), ledger = d.ledger ?? (d.db ? d1Ledger(d.db) : sharedLedger);
  const who = await playerCode(ip, SALT);
  const action = b.action;

  if (action === 'pick' || action === 'delete' || action === 'publish') {
    const id = typeof b.id === 'string' && /^[0-9a-f]{16}$/.test(b.id) ? b.id : '';
    if (!id) return refuse(400, { error: 'bad' });
    if (action === 'pick') {
      const r = await db.prepare(`UPDATE characters SET picks = picks + 1, last_pick = datetime('now') WHERE id = ? AND (status = 'ok' OR (status = 'private' AND owner = ?))`).bind(id, who).run();
      return (r.meta?.changes ?? 0) > 0 ? refuse(200, { ok: true }) : refuse(404, { error: 'not found' });
    }
    if (action === 'publish') { // the maker's one deliberate press; a character waiting for the safety check stays hidden
      const p = await db.prepare(`UPDATE characters SET status = 'ok', ts = datetime('now') WHERE id = ? AND owner = ? AND status = 'private'`).bind(id, who).run();
      return (p.meta?.changes ?? 0) > 0 ? refuse(200, { ok: true }) : refuse(404, { error: 'not found' });
    }
    const r = await db.prepare('DELETE FROM characters WHERE id = ? AND owner = ?').bind(id, who).run(); // only the maker's own code matches
    return (r.meta?.changes ?? 0) > 0 ? refuse(200, { ok: true }) : refuse(404, { error: 'not found' });
  }

  const provider = PROVIDERS[typeof b.provider === 'string' ? b.provider : DEFAULT_PROVIDER];
  if (!provider) return refuse(400, { error: 'bad', message: 'Unknown maker.' });
  if (!provider.configured(env)) return refuse(provider.id === DEFAULT_PROVIDER ? 503 : 501, { error: 'not configured', message: 'The character maker is not switched on here.' });

  if (action === 'status') {
    const id = typeof b.id === 'string' && JOB_ID.test(b.id) ? b.id : '';
    if (!id) return refuse(400, { state: 'failed', reason: 'bad' });
    const job = await db.prepare('SELECT owner, day, prompt, state FROM character_jobs WHERE id = ?').bind(id).first<{ owner: string; day: string; prompt: string; state: string }>();
    if (!job || job.owner !== who) return refuse(404, { state: 'failed', reason: 'not found' });
    let st: JobState;
    try { st = await provider.status(id, env, fetcher); } catch { return refuse(502, { state: 'failed', reason: 'down' }); }
    if (st.state === 'running') {
      const index = stageIndex(CHARACTER_STEPS, st.stage);
      return refuse(200, { state: 'running', stage: CHARACTER_STEPS[index].id, index, total: CHARACTER_STEPS.length, words: CHARACTER_STEPS[index].words, attempt: st.attempt ?? 1 });
    }
    if (st.state === 'failed') {
      if (st.refund !== false && (await db.prepare(`UPDATE character_jobs SET state = 'refunded' WHERE id = ? AND state = 'running'`).bind(id).run()).meta?.changes) await ledger.refund(who, dayKey(job.day));
      return refuse(200, { state: 'failed', reason: st.reason });
    }
    return store(db, job, st, id, who, provider.id);
  }

  if (action !== 'create') return refuse(400, { error: 'bad' });
  if (limited(`char:${ip}`, now, d.burstMax ?? 6)) return refuse(429, refusalBody('busy', 'You made a lot of characters just now. Wait a few minutes.', waitSeconds(`char:${ip}`, now)));
  const prompt = cleanPrompt(b.prompt), problem = promptProblem(prompt);
  if (problem) return refuse(400, { error: 'bad', message: problem });
  let status = 'ok';
  if (env.BASETEN_API_KEY) { // the safety hook: text only; a "block" stops here, anything that needs a person is stored hidden
    const m = await askModeration(env.BASETEN_API_KEY, { text: prompt }, fetcher);
    const stop = moderationStops(m.body.verdict, m.body.reason === 'person' ? 'none' : m.body.reason);
    if (stop) return refuse(403, { error: 'moderation', message: stop });
    if (m.body.verdict !== 'ok') status = 'review';
  }
  const key = promptKey(prompt);
  const dup = await db.prepare(`SELECT ${COLS} FROM characters WHERE prompt_key = ? AND kind = 'character' AND (status = 'ok' OR (status = 'private' AND owner = ?))`).bind(key, who).first<Row>();
  if (dup) return refuse(200, { state: 'done', character: card(dup, who), duplicate: true });
  const day = utcDay(now);
  const slot = await ledger.take(who, dayKey(day), charLimits(env));
  if (!slot.ok) return refuse(429, refusalBody(slot.limit === 'game' ? 'budget' : 'daily', slot.limit === 'game' ? "Everyone together has made today's characters." : 'You have made all your characters for today.', secondsToNextDay(now)));
  try {
    const { id } = await provider.submit(prompt, env, fetcher);
    await db.prepare(`INSERT INTO character_jobs (id, ts, owner, day, provider, prompt, state) VALUES (?, datetime('now'), ?, ?, ?, ?, 'running')`).bind(id, who, day, provider.id, status === 'review' ? `review:${prompt}` : prompt).run();
    return refuse(200, { id });
  } catch {
    await ledger.refund(who, dayKey(day));
    return refuse(502, refusalBody('down', 'The character maker is busy. Try again in a minute.', 60));
  }
}

async function store(db: Db, job: { prompt: string; state: string }, st: Extract<JobState, { state: 'done' }>, jobId: string, who: string, provider: string) {
  let glb: Uint8Array<ArrayBuffer>, thumb: Uint8Array<ArrayBuffer>;
  try { glb = b64(st.glb); thumb = b64(st.thumb); } catch { return refuse(200, { state: 'failed', reason: 'The maker sent a broken file.' }); }
  const problems = glbProblems(glb);
  if (problems.length || !THUMB_OK(thumb)) {
    if ((await db.prepare(`UPDATE character_jobs SET state = 'refunded' WHERE id = ? AND state = 'running'`).bind(jobId).run()).meta?.changes) { /* the slot is given back by the next line */ }
    return refuse(200, { state: 'failed', reason: `Too big or not a runner: ${problems[0] ?? 'thumbnail'}.` });
  }
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', glb)).slice(0, 8)].map((x) => x.toString(16).padStart(2, '0')).join('');
  const review = job.prompt.startsWith('review:'), prompt = review ? job.prompt.slice(7) : job.prompt;
  const route = st.meta.route === 'C' ? 'C' : 'A';
  await db.prepare(`INSERT OR IGNORE INTO characters (id, ts, kind, status, owner, name, prompt, prompt_key, provider, route, bytes, faces, thumb, glb) VALUES (?, datetime('now'), 'character', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(hash, review ? 'review' : 'private', who, cardName(prompt), prompt, promptKey(prompt), provider, route, glb.length, Number(st.meta.faces) || 0, unb64(thumb), unb64(glb)).run();
  await db.prepare(`UPDATE character_jobs SET state = 'done' WHERE id = ? AND state = 'running'`).bind(jobId).run();
  const row = await db.prepare(`SELECT ${COLS} FROM characters WHERE id = ?`).bind(hash).first<Row>();
  return refuse(200, { state: 'done', character: card(row!, who), hidden: review, route, notes: st.meta.notes ?? [] });
}

export const onRequestGet = async ({ request, env }: { request: Request; env: Env & { DB: Db } }): Promise<Response> => {
  const q = new URL(request.url).searchParams;
  const ip = request.headers.get('cf-connecting-ip') ?? 'local';
  if (!env.DB) return json({ items: [], canCreate: false, providers: [] }, 200, { 'cache-control': 'no-store' });
  const id = q.get('id');
  if (id !== null) {
    if (!/^[0-9a-f]{16}$/.test(id)) return json({ error: 'bad' }, 400);
    const row = await env.DB.prepare(`SELECT glb FROM characters WHERE id = ? AND (status = 'ok' OR (status = 'private' AND owner = ?)) AND reports < 3`).bind(id, await playerCode(ip, SALT)).first<{ glb: string }>();
    if (!row) return json({ error: 'not found' }, 404);
    return new Response(b64(row.glb), { headers: { 'content-type': 'model/gltf-binary', 'cache-control': 'private, max-age=31536000, immutable' } });
  }
  const who = await playerCode(ip, SALT);
  const kind = q.get('kind') ?? 'character', page = await listPage(env.DB, kind, who, { sort: q.get('sort') ?? '', q: q.get('q') ?? '', page: Number(q.get('page')) || 0 });
  const first = !(Number(q.get('page')) > 0);
  const mineCards = first && kind === 'character' ? await mine(env.DB, who) : [];
  const lim = charLimits(env), left = await d1Ledger(env.DB).left(who, dayKey(utcDay(Date.now())), lim); // so a refusal is never a surprise
  const providers = Object.values(PROVIDERS).map((p) => ({ id: p.id, label: p.label, configured: p.configured(env) }));
  return json({ items: page.items, more: page.more, mine: mineCards, left, limit: lim.perPlayer, canCreate: PROVIDERS[DEFAULT_PROVIDER].configured(env), providers }, 200, { 'cache-control': 'no-store' });
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env & TurnstileEnv & { DB: Db } }): Promise<Response> => {
  const raw = await request.text();
  if (raw.length > 6_000) return json({ error: 'bad', message: 'Too long.' }, 413);
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return json({ error: 'bad' }, 400); }
  if (!env.DB) return json({ error: 'not configured' }, 503);
  const create = b.action === 'create';
  if (create && !(await featureOn(env.DB, 'character'))) return json({ error: 'off', message: offWords('character') }, 503);
  if (create) { const c = await checkTurnstile(env, b.turnstile, request.headers.get('cf-connecting-ip') ?? 'local'); if (!c.ok) return json({ error: 'check', message: c.message }, 403); }
  const wt = waitTimer('character');
  const r = await handle(b, { db: env.DB, env, ip: request.headers.get('cf-connecting-ip') ?? 'local', fetcher: create ? wt.fetcher : undefined });
  if (create) await wt.flush(env.DB);
  if (create && r.status === 200 && typeof (r.body as { id?: unknown }).id === 'string') await recordUsage(env.DB, 'character'); // only a job that started; a repeat of an old prompt costs nothing
  const wait = (r.body as { retryAfterSeconds?: number }).retryAfterSeconds;
  return json(r.body, r.status, wait ? { 'retry-after': String(wait) } : {});
};
