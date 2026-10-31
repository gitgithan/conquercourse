import { describe, expect, it } from 'vitest';
import { cleanRequest, moderationStops, requestProblem, retryNote } from '../src/slice/object-lift';
import { creditLine, problems, PROVENANCE_VERSION } from '../src/slice/provenance';
import { handle } from '../functions/api/object-lift';
import { memoryLedger, utcDay } from '../src/slice/upload-gates';

const jpg = 'data:image/jpeg;base64,/9j/4AAQ';
const good = { image: jpg, thumb: jpg, label: ' Bench ', box: [10, 10, 300, 200], width: 640, height: 480, height_m: 0.8 };
const env = { CC_UPLOAD_TOKEN: 't', CC_UPLOAD_SUBMIT_URL: 'https://a--b.modal.run', CC_UPLOAD_STATUS_URL: 'https://a--c.modal.run' };

describe('requestProblem', () => {
  it('accepts a good request and cleans the label', () => {
    expect(requestProblem(good)).toBe('');
    expect(cleanRequest(good).label).toBe('bench');
  });
  it.each([
    [{ ...good, image: 'x' }], [{ ...good, label: '3d!' }], [{ ...good, box: [10, 10, 12, 12] }], [{ ...good, box: [0, 0, 700, 200] }],
    [{ ...good, height_m: 9 }], [{ ...good, width: 9000 }],
  ])('refuses %#', (b) => expect(requestProblem(b)).not.toBe(''));
});

describe('moderation and notes', () => {
  it('lets a person through (they are blurred) but stops real worries', () => {
    expect(moderationStops('review', 'person')).toBe('');
    expect(moderationStops('ok', 'none')).toBe('');
    expect(moderationStops('block', 'sexual')).not.toBe('');
    expect(moderationStops('review', 'minor')).not.toBe('');
  });
  it('words the pad note', () => {
    expect(retryNote({ note: 'pad' })).toMatch(/room/);
    expect(retryNote({})).toBe('');
  });
});

describe('provenance', () => {
  const rec = {
    version: PROVENANCE_VERSION, id: 'bench-1', glb: 'bench-1.glb', name: 'Bench', source: 'library', label: 'bench', created: '2026-10-30',
    photo: { sha256: 'a'.repeat(64), width: 640, height: 480, id: 'x', url: null, stored: false }, box: [1, 1, 100, 100], height_m: 0.8, height_source: 'library',
    pipeline: { name: 'photo_to_object', model: 'SAM 3 + SAM 3D Objects', seed: 42, texture: 1024, pad_retry: true },
    credit: { author: 'Ana', licence: 'CC0', source_url: null, line: 'Photo by Ana, CC0' },
  };
  it('a clean record has no problems', () => expect(problems(rec)).toEqual([]));
  it('finds a box outside the photo and a missing licence', () => {
    expect(problems({ ...rec, box: [1, 1, 900, 100] })).toContain('box outside photo');
    expect(problems({ ...rec, credit: { ...rec.credit, licence: '' } })).toContain('credit author and licence');
  });
  it('credit lines', () => {
    expect(creditLine({ author: 'Ana', licence: 'CC0' }, 'library')).toBe('Photo by Ana, CC0');
    expect(creditLine({}, 'user')).toBe('From your own photo');
  });
});

describe('/api/object-lift handle', () => {
  const ok = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
  it('is off without the secret', async () => expect((await handle(good, {}, 'ip')).status).toBe(503));
  it('accepts the real Modal host with a region', async () => {
    const e = { ...env, CC_UPLOAD_SUBMIT_URL: 'https://han-qi91--cc-photo-to-object-submit.us-east.modal.run', CC_UPLOAD_STATUS_URL: 'https://han-qi91--cc-photo-to-object-status.us-east.modal.run' };
    expect((await handle({ action: 'status', id: 'fc-ABCDEFGHIJKL' }, e, 'ipr', ok({ state: 'running' }))).status).toBe(200);
  });
  it('submits and returns the job id', async () => {
    const r = await handle({ ...good, action: 'submit' }, env, 'ip1', ok({ id: 'fc-ABCDEFGHIJKL' }));
    expect(r).toEqual({ status: 200, body: { id: 'fc-ABCDEFGHIJKL', moderation: 'skipped' } });
  });
  it('refuses bad boxes before paying for a job', async () => {
    const r = await handle({ ...good, action: 'submit', box: [0, 0, 5, 5] }, env, 'ip2', ok({}));
    expect(r.status).toBe(400);
  });
  it('rejects odd job ids on status', async () => expect((await handle({ action: 'status', id: '../x' }, env, 'ip')).status).toBe(400));
  it('rate limits one address', async () => {
    let last = 0;
    for (let i = 0; i < 8; i++) last = (await handle({ ...good, action: 'submit' }, env, 'ip3', ok({ id: 'fc-ABCDEFGHIJKL' }), 5)).status;
    expect(last).toBe(429);
  });
  it('a burst refusal says how long to wait, a daily refusal waits for the next UTC day, a down service says a minute', async () => {
    const t = Date.UTC(2026, 9, 31, 22, 30);
    let busy = { status: 0, body: {} as Record<string, unknown> };
    for (let i = 0; i < 3; i++) busy = (await handle({ ...good, action: 'submit' }, env, 'ip-wait', ok({ id: 'fc-ABCDEFGHIJKL' }), 2, memoryLedger(), undefined, t)) as typeof busy;
    expect(busy.status).toBe(429); expect(busy.body).toMatchObject({ error: 'busy', retryAfterSeconds: 600 });
    const led = memoryLedger();
    const lim = { perPlayer: 1, perGame: 100 };
    await handle({ ...good, action: 'submit' }, env, 'ip-day', ok({ id: 'fc-ABCDEFGHIJKL' }), 99, led, lim, t);
    const day = await handle({ ...good, action: 'submit' }, env, 'ip-day', ok({ id: 'fc-ABCDEFGHIJKL' }), 99, led, lim, t);
    expect(day.body).toMatchObject({ error: 'daily', retryAfterSeconds: 90 * 60 });
    const down = await handle({ ...good, action: 'submit' }, env, 'ip-down', (async () => { throw new Error('x'); }) as unknown as typeof fetch, 99, memoryLedger(), undefined, t);
    expect(down).toMatchObject({ status: 502, body: { error: 'down', retryAfterSeconds: 60 } });
  });
});

// The unhappy paths, in gate order. One fake network: Baseten answers with `verdict`, Modal with `modal`.
describe('/api/object-lift gates', () => {
  const keyed = { ...env, BASETEN_API_KEY: 'k' };
  const net = (verdict: unknown, modal: unknown = { id: 'fc-ABCDEFGHIJKL' }, modalStatus = 200) => (async (url: string) => {
    if (String(url).includes('modal.run')) return new Response(JSON.stringify(modal), { status: modalStatus });
    if (verdict === 'down') return new Response('x', { status: 500 });
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(verdict) } }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const submit = (ip: string, f: typeof fetch, ledger = memoryLedger(), limits = { perPlayer: 3, perGame: 100 }, e: Record<string, string> = keyed) =>
    handle({ ...good, action: 'submit' }, e, ip, f, 99, ledger, limits, Date.UTC(2026, 9, 30, 12));
  const ok = { verdict: 'ok', reason: 'none' };

  it('a clean photo goes through and says so', async () => expect((await submit('g1', net(ok))).body).toEqual({ id: 'fc-ABCDEFGHIJKL', moderation: 'ok:none' }));
  it('a blocked photo is refused with plain words and starts no job', async () => {
    const r = await submit('g2', net({ verdict: 'block', reason: 'sexual' }));
    expect(r.status).toBe(403); expect(r.body).toMatchObject({ error: 'moderation', message: 'This photo cannot be used here.' });
  });
  it('a worry that needs a person is refused', async () => {
    const r = await submit('g3', net({ verdict: 'review', reason: 'minor' }));
    expect(r.status).toBe(403); expect((r.body as { message: string }).message).toMatch(/needs a person/);
  });
  it('a person in the photo is allowed (the pipeline blurs them)', async () => expect((await submit('g4', net({ verdict: 'review', reason: 'person' }))).status).toBe(200));
  it('a broken checker fails closed when a key is set', async () => {
    const r = await submit('g5', net('down'));
    expect(r.status).toBe(403); expect((r.body as { message: string }).message).toMatch(/safety check could not run/);
  });
  it('an unreadable checker answer fails closed too', async () => expect((await submit('g6', net('not json at all'))).status).toBe(403));
  it('without a key the checker is skipped, as recorded', async () => expect((await submit('g7', net(ok), memoryLedger(), undefined, env)).body).toMatchObject({ moderation: 'skipped' }));

  it('one more object after the player\'s daily slots is refused for that player only', async () => {
    const led = memoryLedger();
    for (let i = 0; i < 3; i++) expect((await submit('p1', net(ok), led)).status).toBe(200);
    const r = await submit('p1', net(ok), led);
    expect(r.status).toBe(429); expect(r.body).toMatchObject({ error: 'daily' });
    expect((r.body as { retryAfterSeconds: number }).retryAfterSeconds).toBeGreaterThan(0); // the page turns it into a clock time
    expect((await submit('p2', net(ok), led)).status).toBe(200);
  });
  it('the next day the player has slots again', async () => {
    const led = memoryLedger();
    for (let i = 0; i < 3; i++) await submit('p3', net(ok), led);
    expect((await handle({ ...good, action: 'submit' }, keyed, 'p3', net(ok), 99, led, { perPlayer: 3, perGame: 100 }, Date.UTC(2026, 9, 31, 1))).status).toBe(200);
  });
  it('the game budget stops everyone and says the makers are used up', async () => {
    const led = memoryLedger(); const lim = { perPlayer: 3, perGame: 2 };
    await submit('b1', net(ok), led, lim); await submit('b2', net(ok), led, lim);
    const r = await submit('b3', net(ok), led, lim);
    expect(r.status).toBe(429); expect(r.body).toMatchObject({ error: 'budget' }); expect((r.body as { message: string }).message).toMatch(/used up/);
  });
  it('a blocked photo does not use up a slot', async () => {
    const led = memoryLedger();
    for (let i = 0; i < 5; i++) await submit('s1', net({ verdict: 'block', reason: 'other' }), led);
    for (let i = 0; i < 3; i++) expect((await submit('s1', net(ok), led)).status).toBe(200);
  });
  it('a job that never starts gives the slot back (Modal down, or Modal says no)', async () => {
    const led = memoryLedger();
    for (let i = 0; i < 2; i++) expect((await submit('r1', net(ok, {}, 500), led)).status).toBe(502);
    expect((await submit('r1', net(ok, { error: 'bad photo' }), led)).status).toBe(400);
    for (let i = 0; i < 3; i++) expect((await submit('r1', net(ok), led)).status).toBe(200);
    expect((await submit('r1', net(ok), led)).status).toBe(429);
  });
  it('the day key is the UTC date', () => expect(utcDay(Date.UTC(2026, 9, 30, 23, 59))).toBe('2026-10-30'));
});

import { readFileSync } from 'node:fs';
describe('the 19 library objects', () => {
  const doc = JSON.parse(readFileSync('public/assets/objects/provenance.json', 'utf8')) as { objects: unknown[] };
  const idx = JSON.parse(readFileSync('public/assets/objects/index.json', 'utf8')) as { objects: { glb: string }[] };
  it('every object has a clean provenance record with an author and a licence', () => {
    expect(doc.objects.length).toBe(idx.objects.length);
    for (const o of doc.objects) expect(problems(o)).toEqual([]);
  });
});
