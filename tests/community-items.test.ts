import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { cleanItem, visibilityFor } from '../src/community/items';
import { PAGE, file, list, publish, remove, type Db } from '../functions/api/community-items';

// A real SQL database (node:sqlite) built from the real migration, wrapped to look like D1.
function makeDb(): Db {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync('migrations/0014_community_items.sql', 'utf8'));
  return { prepare: (q: string) => ({ bind: (...v: unknown[]) => ({
    run: async () => { const r = sql.prepare(q).run(...(v as never[])); return { meta: { changes: Number(r.changes) } }; },
    first: async <T>() => (sql.prepare(q).get(...(v as never[])) as T | undefined) ?? null,
    all: async <T>() => ({ results: sql.prepare(q).all(...(v as never[])) as T[] }),
  }) }) } as Db;
}

const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
const GLB = Buffer.from('glTF-fake-model-bytes').toString('base64');
const piece = (extra: Record<string, unknown> = {}) => ({ session: 'player-aaaa-1111', kind: 'piece', name: 'railing', thumb: JPG, glb: GLB, height_m: 1, ...extra });
const wall = (extra: Record<string, unknown> = {}) => ({ session: 'player-aaaa-1111', kind: 'wallpaper', name: 'my park', thumb: JPG, course: 'demo/lache', ...extra });
const said = (verdict: string, reason: string) => (async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ verdict, reason }) } }] }) })) as unknown as typeof fetch;
let n = 0; const ip = () => `ip-${n++}`; // each test gets its own address, so the burst limit never mixes tests

describe('what a share may contain (CC-247)', () => {
  it('accepts a piece and refuses a wallpaper (wallpapers stay in the maker\'s browser)', () => {
    expect(cleanItem(piece()).ok).toBe(true);
    expect(cleanItem(wall()).ok).toBe(false);
  });
  it('refuses bad names, files and kinds', () => {
    expect(cleanItem(piece({ name: 'a' })).ok).toBe(false);
    const tags = cleanItem(piece({ name: 'rail <b>one</b>' })); // angle brackets are removed or the name is refused, never stored
    if (tags.ok) expect(tags.item.name).not.toMatch(/[<>]/);
    expect(cleanItem(piece({ glb: Buffer.from('not a model').toString('base64') })).ok).toBe(false);
    expect(cleanItem(piece({ glb: undefined })).ok).toBe(false);
    expect(cleanItem(piece({ height_m: 50 })).ok).toBe(false);
    expect(cleanItem(piece({ thumb: 'http://x/y.jpg' })).ok).toBe(false);
    expect(cleanItem({ ...piece(), kind: 'course' }).ok).toBe(false);
  });
  it('shows to everyone only when the safety check said ok with no worry', () => {
    expect(visibilityFor('ok', 'none')).toBe('approved');
    expect(visibilityFor('review', 'person')).toBe('pending');
    expect(visibilityFor('review', 'error')).toBe('pending');
    expect(visibilityFor('block', 'sexual')).toBe('refused');
  });
});

describe('sharing, the lists and deleting (CC-247)', () => {
  it('a share the safety check approved is public and also mine; a held one is only mine', async () => {
    const db = makeDb(), env = { DB: db, BASETEN_API_KEY: 'k' };
    const a = await publish(piece(), env, ip(), said('ok', 'none'));
    expect(a.body.status).toBe('approved');
    const b = await publish(piece({ session: 'player-bbbb-2222' }), env, ip(), said('review', 'person'));
    expect(b.body.status).toBe('pending');
    const anon = (await list(env, null)).body.items as { id: string }[];
    expect(anon.map((i) => i.id)).toEqual([a.body.id]);
    const meB = (await list(env, 'player-bbbb-2222')).body.items as { id: string; mine?: boolean }[];
    expect(meB.map((i) => i.id).sort()).toEqual([a.body.id, b.body.id].sort());
    expect(meB.find((i) => i.id === b.body.id)?.mine).toBe(true);
    expect(meB.find((i) => i.id === a.body.id)?.mine).toBeUndefined();
  });
  it('with no safety key the share is held, never public', async () => {
    const env = { DB: makeDb() };
    const r = await publish(piece(), env, ip());
    expect(r.body.status).toBe('pending');
    expect(((await list(env, null)).body.items as unknown[]).length).toBe(0);
  });
  it('a blocked picture is refused and stores nothing', async () => {
    const env = { DB: makeDb(), BASETEN_API_KEY: 'k' };
    expect((await publish(piece(), env, ip(), said('block', 'violence'))).status).toBe(403);
    expect(((await list(env, 'player-aaaa-1111')).body.items as unknown[]).length).toBe(0);
  });
  it('only the owner can delete: another player gets 404 and the item stays', async () => {
    const env = { DB: makeDb(), BASETEN_API_KEY: 'k' };
    const a = await publish(piece(), env, ip(), said('ok', 'none'));
    const id = String(a.body.id);
    expect((await remove({ id, session: 'player-bbbb-2222' }, env)).status).toBe(404);
    expect((await remove({ id, session: '' }, env)).status).toBe(404);
    expect((await remove({ id }, env)).status).toBe(404);
    expect(((await list(env, null)).body.items as unknown[]).length).toBe(1);
    expect((await file(env, id, 'glb', null)).status).toBe(200);
    expect((await remove({ id, session: 'player-aaaa-1111' }, env)).status).toBe(200);
  });
  it('after the owner deletes, it is gone from every list and the stored files are emptied', async () => {
    const db = makeDb(), env = { DB: db, BASETEN_API_KEY: 'k' };
    const a = await publish(piece(), env, ip(), said('ok', 'none'));
    const id = String(a.body.id);
    expect((await remove({ id, session: 'player-aaaa-1111' }, env)).status).toBe(200);
    expect(((await list(env, null)).body.items as unknown[]).length).toBe(0);
    expect(((await list(env, 'player-aaaa-1111')).body.items as unknown[]).length).toBe(0);
    expect((await file(env, id, 'thumb', 'player-aaaa-1111')).status).toBe(404);
    const row = await db.prepare('SELECT status, thumb, glb, meta FROM community_items WHERE id = ?').bind(id).first<Record<string, string>>();
    expect(row).toMatchObject({ status: 'removed', thumb: '', glb: '', meta: '{}' });
    expect((await remove({ id, session: 'player-aaaa-1111' }, env)).status).toBe(404); // a second delete finds nothing
  });
  it('a held item can be opened only by its owner', async () => {
    const env = { DB: makeDb() };
    const id = String((await publish(piece(), env, ip())).body.id);
    expect((await file(env, id, 'thumb', null)).status).toBe(404);
    expect((await file(env, id, 'thumb', 'player-bbbb-2222')).status).toBe(404);
    expect((await file(env, id, 'thumb', 'player-aaaa-1111')).status).toBe(200);
  });
  it('the stored owner is a one-way code, not the session', async () => {
    const db = makeDb(), env = { DB: db };
    await publish(piece(), env, ip());
    const row = await db.prepare('SELECT owner FROM community_items').bind().first<{ owner: string }>();
    expect(row?.owner).toMatch(/^[0-9a-f]{16}$/);
    expect(row?.owner).not.toContain('player');
  });
  it('is switched off without a database', async () => {
    expect((await publish(piece(), {}, ip())).status).toBe(503);
    expect((await list({}, null)).body.items).toEqual([]);
  });
});

describe('a long list is served in pages (CC-247)', () => {
  const fill = async (db: Db, total: number) => {
    for (let i = 0; i < total; i++) {
      const id = `a${String(i).padStart(9, '0')}`; // ten characters
      await db.prepare("INSERT INTO community_items (id, owner, kind, name, status, created_at, thumb, glb, meta) VALUES (?, 'o', ?, ?, ?, ?, 'data:image/jpeg;base64,AAAA', 'AAAA', '{}')")
        .bind(id, i % 5 === 0 ? 'wallpaper' : 'piece', i % 7 === 0 ? `railing ${i}` : `thing ${i}`, i % 11 === 0 ? 'pending' : 'approved', 1_700_000_000 + Math.floor(i / 3)).run();
    }
  };
  it('500 items come as small pages that join up with no repeats and no gaps', async () => {
    const db = makeDb(); await fill(db, 500);
    const seen: string[] = []; let cursor: string | undefined, pages = 0;
    do {
      const r = await list({ DB: db } as never, null, { cursor });
      const body = r.body as { items: { id: string }[]; next: string | null };
      expect(body.items.length).toBeLessThanOrEqual(PAGE);
      expect(JSON.stringify(body).length).toBeLessThan(40_000);
      seen.push(...body.items.map((i) => i.id)); cursor = body.next ?? undefined; pages++;
    } while (cursor && pages < 100);
    const approved = Array.from({ length: 500 }, (_, i) => i).filter((i) => i % 5 !== 0 && i % 11 !== 0).length; // old wallpaper rows are never listed
    expect(seen.length).toBe(approved);
    expect(new Set(seen).size).toBe(approved);
    expect(pages).toBeGreaterThan(5);
  });
  it('search by name and the kind filter are done by the server', async () => {
    const db = makeDb(); await fill(db, 500);
    const r = (await list({ DB: db } as never, null, { q: 'railing', kind: 'piece' })).body as { items: { name: string; kind: string }[] };
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.every((i) => i.name.includes('railing') && i.kind === 'piece')).toBe(true);
    const odd = (await list({ DB: db } as never, null, { q: "%'; DROP TABLE community_items;--" })).body as { items: unknown[] };
    expect(Array.isArray(odd.items)).toBe(true);
  });
  it('a pending item is never in the public pages', async () => {
    const db = makeDb(); await fill(db, 60);
    const r = (await list({ DB: db } as never, null)).body as { items: { id: string }[] };
    expect(r.items.some((i) => i.id === 'a000000000')).toBe(false);
  });
});
