import { describe, expect, it } from 'vitest';
import { localD1 } from './helpers-d1';
import { charLimits, handle, list, onRequestGet } from '../functions/api/character';
import { memoryLedger } from '../src/slice/upload-gates';
import { glb, thumb } from './helpers-char';

const b64 = (b: Uint8Array) => { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s); };
const env = { CC_CHAR_TOKEN: 't', CC_CHAR_SUBMIT_URL: 'https://a--b.modal.run', CC_CHAR_STATUS_URL: 'https://a--c.modal.run', CC_CHAR_LIMITS: '2,5' };
const J = (o: unknown) => new Response(JSON.stringify(o), { status: 200 });
/** A pretend Modal: submit hands out a job id; status answers whatever `next` says. */
function modal(next: () => unknown) {
  let n = 0;
  const fetcher = (async (url: string) => (String(url).includes('--b.') ? J({ id: `fc-JOB${String(++n).padStart(10, '0')}` }) : J(next()))) as unknown as typeof fetch;
  return fetcher;
}
const mk = (ip = '1.1.1.1', over: Record<string, unknown> = {}) => ({ ip, env: { ...env, ...over }, ledger: memoryLedger(), burstMax: 50 });
const done = () => ({ state: 'done', glb: b64(glb()), thumb: b64(thumb()), meta: { route: 'A', faces: 100 } });

describe('character API', () => {
  it('create -> status running -> done stores one character and lists it', async () => {
    const { db } = localD1(); const d = { ...mk(), db, fetcher: modal(() => ({ state: 'running', stage: 'mesh' })) };
    const c = await handle({ action: 'create', prompt: 'a friendly robot frog' }, d);
    expect(c.status).toBe(200);
    const id = (c.body as { id: string }).id;
    const run = (await handle({ action: 'status', id }, d)).body as { state: string; stage: string; index: number; total: number };
    expect(run).toMatchObject({ state: 'running', stage: 'mesh', index: 2, total: 6 });
    const dn = { ...d, fetcher: modal(done) };
    const fin = (await handle({ action: 'status', id }, dn)).body as { state: string; character: { id: string; mine: boolean; name: string } };
    expect(fin.state).toBe('done'); expect(fin.character.mine).toBe(true); expect(fin.character.name).toBe('Friendly robot frog');
    const again = (await handle({ action: 'status', id }, dn)).body as { character: { id: string } };
    expect(again.character.id).toBe(fin.character.id); // polling twice stores once
    expect((await list(db, 'character', 'x')).length).toBe(1);
    expect((await list(db, 'object', 'x')).length).toBe(0);
  });
  it('the same prompt returns the existing character and uses no slot', async () => {
    const { db } = localD1(); const d = { ...mk(), db, fetcher: modal(done) };
    const id = ((await handle({ action: 'create', prompt: 'a calm owl' }, d)).body as { id: string }).id;
    await handle({ action: 'status', id }, d);
    const r = (await handle({ action: 'create', prompt: 'A calm owl!' }, d)).body as { duplicate?: boolean; state: string };
    expect(r).toMatchObject({ state: 'done', duplicate: true });
  });
  it('another player cannot poll or delete; the maker can delete', async () => {
    const { db } = localD1(); const f = modal(done); const a = { ...mk('1.1.1.1'), db, fetcher: f }, o = { ...mk('2.2.2.2'), db, fetcher: f };
    const id = ((await handle({ action: 'create', prompt: 'a calm owl' }, a)).body as { id: string }).id;
    expect((await handle({ action: 'status', id }, o)).status).toBe(404);
    const cid = ((await handle({ action: 'status', id }, a)).body as { character: { id: string } }).character.id;
    expect((await handle({ action: 'delete', id: cid }, o)).status).toBe(404);
    expect((await handle({ action: 'delete', id: cid }, a)).status).toBe(200);
    expect((await list(db, 'character', 'x')).length).toBe(0);
  });
  it('the daily slot is taken once, refused when used, and given back once if the job fails', async () => {
    const { db } = localD1(); const ledger = memoryLedger();
    const d = { ...mk(), ledger, env: { ...env, CC_CHAR_LIMITS: '1,5' }, db, fetcher: modal(() => ({ state: 'failed', reason: 'no', refund: true })) };
    const id = ((await handle({ action: 'create', prompt: 'a calm owl' }, d)).body as { id: string }).id;
    expect((await handle({ action: 'create', prompt: 'a red fox' }, d)).status).toBe(429);
    await handle({ action: 'status', id }, d); await handle({ action: 'status', id }, d);
    expect((await handle({ action: 'create', prompt: 'a red fox' }, d)).status).toBe(200);
    expect((await handle({ action: 'create', prompt: 'a blue whale' }, d)).status).toBe(429); // refunded once, not twice
  });
  it('refuses bad prompts, unknown makers, the Tripo stub, and an unconfigured server', async () => {
    const { db } = localD1(); const d = { ...mk(), db, fetcher: modal(done) };
    expect((await handle({ action: 'create', prompt: 'x' }, d)).status).toBe(400);
    expect((await handle({ action: 'create', prompt: 'a calm owl', provider: 'nope' }, d)).status).toBe(400);
    expect((await handle({ action: 'create', prompt: 'a calm owl', provider: 'tripo' }, d)).status).toBe(501);
    expect((await handle({ action: 'create', prompt: 'a calm owl' }, { ...d, env: {} })).status).toBe(503);
  });
  it('a file over the caps is refused and never stored', async () => {
    const { db } = localD1(); const d = { ...mk(), db, fetcher: modal(() => ({ ...done(), glb: b64(glb({ faces: 9000 })) })) };
    const id = ((await handle({ action: 'create', prompt: 'a calm owl' }, d)).body as { id: string }).id;
    const r = (await handle({ action: 'status', id }, d)).body as { state: string };
    expect(r.state).toBe('failed'); expect((await list(db, 'character', 'x')).length).toBe(0);
  });
  it('lists the newest 24, expires unpicked old ones, keeps Keepers, and counts picks', async () => {
    const { db, sql } = localD1();
    for (let i = 0; i < 30; i++) sql.prepare(`INSERT INTO characters (id, ts, kind, status, owner, name, prompt, prompt_key, provider, route, bytes, faces, thumb, glb) VALUES (?, datetime('now', ?), 'character', 'ok', 'o', 'n', 'p', ?, 'route-a', 'A', 1, 1, 'AAAA', 'AAAA')`).run(`${i.toString(16).padStart(16, '0')}`, `-${i} minutes`, `k${i}`);
    expect((await list(db, 'character', 'x')).length).toBe(24);
    sql.prepare(`UPDATE characters SET ts = datetime('now','-20 days') WHERE id IN (?, ?)`).run('000000000000000a', '000000000000000b');
    sql.prepare(`UPDATE characters SET picks = 10 WHERE id = ?`).run('000000000000000a');
    await list(db, 'character', 'x');
    const ids = (sql.prepare('SELECT id FROM characters').all() as { id: string }[]).map((r) => r.id);
    expect(ids).toContain('000000000000000a'); expect(ids).not.toContain('000000000000000b');
    const r = await handle({ action: 'pick', id: '000000000000000c' }, { ...mk(), db });
    expect(r.status).toBe(200);
    expect(sql.prepare('SELECT picks FROM characters WHERE id = ?').get('000000000000000c')).toEqual({ picks: 1 });
  });
  it('the limits come from a secret and fail closed', () => {
    expect(charLimits({ CC_CHAR_LIMITS: '3,40' })).toEqual({ perPlayer: 3, perGame: 40 });
    expect(charLimits({})).toEqual({ perPlayer: 1, perGame: 1 });
    expect(charLimits({ CC_CHAR_LIMITS: 'x' })).toEqual({ perPlayer: 1, perGame: 1 });
  });
  it('GET serves a glb for ever and a list without any glb bytes', async () => {
    const { db, sql } = localD1(); const d = { ...mk(), db, fetcher: modal(done) };
    const id = ((await handle({ action: 'create', prompt: 'a calm owl' }, d)).body as { id: string }).id;
    const cid = ((await handle({ action: 'status', id }, d)).body as { character: { id: string } }).character.id;
    const g = await onRequestGet({ request: new Request(`https://x/api/character?id=${cid}`), env: { ...env, DB: db } as never });
    expect(g.headers.get('cache-control')).toMatch(/immutable/);
    expect(new Uint8Array(await g.arrayBuffer()).length).toBe(glb().length);
    const l = await (await onRequestGet({ request: new Request('https://x/api/character'), env: { ...env, DB: db } as never })).json() as { items: { thumb: string }[]; canCreate: boolean };
    expect(l.canCreate).toBe(true); expect(JSON.stringify(l)).not.toContain('"glb"');
    sql.prepare('UPDATE characters SET reports = 3').run();
    expect((await onRequestGet({ request: new Request(`https://x/api/character?id=${cid}`), env: { ...env, DB: db } as never })).status).toBe(404);
  });
});
