import { describe, expect, it } from 'vitest';
import { cleanRequest, moderationStops, requestProblem, retryNote } from '../src/slice/object-lift';
import { creditLine, problems, PROVENANCE_VERSION } from '../src/slice/provenance';
import { handle } from '../functions/api/object-lift';

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
