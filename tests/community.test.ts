import { describe, expect, it } from 'vitest';
import { PHRASES as SERVER_PHRASES, onRequestGet, onRequestPost, cleanCourse } from '../functions/api/community';
import { onRequestPost as report } from '../functions/api/community-report';
import { onRequestGet as image } from '../functions/api/community-image';
import { PHRASES, fitPrimitives, proveCourse } from '../src/park/fit';

// A small stand-in for D1: keeps the inserted courses and answers the few queries the endpoints make.
function fakeDb(opts: { recent?: number; rows?: Record<string, unknown>[] } = {}) {
  const inserts: unknown[][] = [];
  const stmts: string[] = [];
  const db = { prepare: (sql: string) => ({ bind: (...v: unknown[]) => ({
    run: async () => { stmts.push(sql); if (sql.startsWith('INSERT INTO community')) inserts.push(v); return {}; },
    first: async () => (sql.includes('COUNT(*)') ? { n: opts.recent ?? 0 } : (opts.rows ?? [])[0] ?? null),
    all: async () => ({ results: opts.rows ?? [] }),
  }) }) };
  return { db, inserts, stmts };
}
const jpeg = 'data:image/jpeg;base64,' + 'A'.repeat(1000);
const good = { session: 'abcdef12-3456', name: 'Library steps', nick: 'sam', confirm: true, width: 800, height: 600, image: jpeg,
  boxes: [{ phrase: 'steps', box: [100, 300, 400, 420], heightM: 0.6 }, { phrase: 'wall', box: [450, 250, 700, 400] }] };
const post = (body: unknown, recent = 0) => {
  const f = fakeDb({ recent });
  const req = new Request('https://x/api/community', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
  return onRequestPost({ request: req, env: { DB: f.db } as never }).then(async (r) => ({ status: r.status, body: await r.json() as Record<string, unknown>, inserts: f.inserts }));
};

describe('publishing a community course', () => {
  it('stores a good course as pending', async () => {
    const r = await post(good);
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('pending');
    expect(r.inserts.length).toBe(1);
    expect(r.inserts[0].slice(0, 3)).toEqual(['abcdef12-3456', 'Library steps', 'sam']);
  });
  it('keeps the kinds of obstacle in step with the Park', () => expect(SERVER_PHRASES).toEqual(PHRASES));
  it('ignores a robot that fills the hidden field', async () => {
    const r = await post({ ...good, website: 'http://spam' });
    expect(r.body).toEqual({ ok: true });
    expect(r.inserts.length).toBe(0);
  });
  it('refuses without the photo-rules confirmation', async () => expect((await post({ ...good, confirm: false })).status).toBe(400));
  it('refuses a photo that is not a jpeg or is too big', async () => {
    expect((await post({ ...good, image: 'data:image/png;base64,AAAA' })).status).toBe(400);
    expect((await post({ ...good, image: 'data:image/jpeg;base64,' + 'A'.repeat(470_000) })).status).toBe(413);
  });
  it('refuses unknown kinds, boxes outside the photo, wild heights and a course of only people', async () => {
    expect((await post({ ...good, boxes: [{ phrase: 'rocket', box: [1, 1, 100, 100] }] })).status).toBe(400);
    expect((await post({ ...good, boxes: [{ phrase: 'bench', box: [1, 1, 900, 100] }] })).status).toBe(400);
    expect((await post({ ...good, boxes: [{ phrase: 'bench', box: [1, 1, 100, 100], heightM: 9 }] })).status).toBe(400);
    expect((await post({ ...good, boxes: [{ phrase: 'person', box: [1, 1, 100, 100] }] })).status).toBe(400);
  });
  it('strips markup from names', () => {
    const c = cleanCourse({ ...good, name: '<b>Nice</b> steps', nick: '' });
    expect(c.ok && /[<>]/.test(c.course.name)).toBe(false);
    expect(c.ok && c.course.nick).toBe('anonymous');
  });
  it('slows a session down after 3 courses in a day', async () => expect((await post(good, 3)).status).toBe(429));
  it('refuses a body that is not json', async () => expect((await post('not json')).status).toBe(400));
});

describe('the gallery and the reports', () => {
  const row = { id: 4, name: 'Library steps', nick: 'sam', width: 800, height: 600, boxes: JSON.stringify(good.boxes) };
  it('lists approved courses with their boxes', async () => {
    const f = fakeDb({ rows: [row] });
    const r = await onRequestGet({ request: new Request('https://x/api/community'), env: { DB: f.db } as never });
    const body = await r.json() as { courses: { id: number; boxes: unknown[] }[] };
    expect(body.courses[0].id).toBe(4);
    expect(body.courses[0].boxes.length).toBe(2);
  });
  it('says not found for a course that is not approved', async () => {
    const f = fakeDb({ rows: [] });
    expect((await onRequestGet({ request: new Request('https://x/api/community?id=9'), env: { DB: f.db } as never })).status).toBe(404);
    expect((await image({ request: new Request('https://x/api/community-image?id=9'), env: { DB: f.db } as never })).status).toBe(404);
  });
  it('serves the photo as jpeg bytes', async () => {
    const f = fakeDb({ rows: [{ image: 'data:image/jpeg;base64,/9j/4A==' }] });
    const r = await image({ request: new Request('https://x/api/community-image?id=1'), env: { DB: f.db } as never });
    expect(r.headers.get('content-type')).toBe('image/jpeg');
    expect(new Uint8Array(await r.arrayBuffer())[0]).toBe(0xff);
  });
  it('counts a report once per session', async () => {
    const f = fakeDb();
    const r = await report({ request: new Request('https://x/api/community-report', { method: 'POST', body: JSON.stringify({ id: 4, session: 'abcdef12-3456' }) }), env: { DB: f.db } as never });
    expect(r.status).toBe(200);
    expect(f.stmts[0]).toContain('INSERT OR IGNORE');
    expect(f.stmts[1]).toContain('UPDATE community SET reports');
  });
});

describe('sizes typed by the maker', () => {
  it('beat the typical size and are marked as the maker\'s', () => {
    const [p] = fitPrimitives([{ id: 1, phrase: 'wall', box: [0, 0, 100, 100], score: 1, heightM: 0.7 }]);
    expect(p.height).toBe(0.7);
    expect(p.scale.source).toBe('maker');
  });
  it('a course made from typed sizes is proven with the simulator', () => {
    const prims = fitPrimitives(good.boxes.map((b, i) => ({ ...b, id: i + 1, score: 1 })) as never);
    expect(proveCourse(prims, 'x').cleared).toBe(true);
  });
});
