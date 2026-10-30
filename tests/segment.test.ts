import { describe, expect, it } from 'vitest';
import { cleanSuggestions, segmentProblem } from '../src/slice/segment';
import { handle } from '../functions/api/segment';

const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
const ENV = { CC_UPLOAD_TOKEN: 't', CC_SEGMENT_SUBMIT_URL: 'https://x--seg-submit.modal.run', CC_SEGMENT_STATUS_URL: 'https://x--seg-status.modal.run' };
const reply = (o: unknown, ok = true) => (async () => ({ ok, status: ok ? 200 : 500, json: async () => o })) as unknown as typeof fetch;

describe('suggested regions (CC-248)', () => {
  it('refuses a photo that is not a JPEG or has no small copy', () => {
    expect(segmentProblem({ image: 'x', thumb: JPG })).toMatch(/JPEG/);
    expect(segmentProblem({ image: JPG })).toMatch(/small copy/);
    expect(segmentProblem({ image: JPG, thumb: JPG })).toBe('');
  });
  it('keeps only well-formed suggestions inside the photo, at most 12', () => {
    const good = { label: 'bench', score: 0.8, box: [1, 2, 30, 40], cutout: 'AAAA' };
    const raw = [good, { ...good, box: [0, 0, 999, 5] }, { ...good, label: 'Bad<' }, { ...good, box: [5, 5, 5, 9] }, ...Array.from({ length: 20 }, () => good)];
    const out = cleanSuggestions(raw, 100, 100);
    expect(out.length).toBe(12);
    expect(out.every((s) => s.box[2] <= 100 && /^[a-z]/.test(s.label))).toBe(true);
    expect(cleanSuggestions('nope', 100, 100)).toEqual([]);
  });
  it('answers 503 when it is switched off', async () => {
    expect((await handle({ action: 'submit', image: JPG, thumb: JPG }, {}, 'a')).status).toBe(503);
  });
  it('submits, then polls, and checks the id', async () => {
    const sub = await handle({ action: 'submit', image: JPG, thumb: JPG }, ENV, 'ip-sub', reply({ id: 'fc-ABCDEFGHIJKL' }));
    expect(sub).toMatchObject({ status: 200, body: { id: 'fc-ABCDEFGHIJKL' } });
    expect((await handle({ action: 'status', id: 'nope' }, ENV, 'a')).status).toBe(400);
    const st = await handle({ action: 'status', id: 'fc-ABCDEFGHIJKL' }, ENV, 'a', reply({ state: 'running' }));
    expect(st.body.state).toBe('running');
  });
  it('limits bursts per address', async () => {
    const f = reply({ id: 'fc-ABCDEFGHIJKL' });
    const codes: number[] = [];
    for (let i = 0; i < 4; i++) codes.push((await handle({ action: 'submit', image: JPG, thumb: JPG }, ENV, 'ip-burst', f, 3, 1000)).status);
    expect(codes).toEqual([200, 200, 200, 429]);
  });
});
