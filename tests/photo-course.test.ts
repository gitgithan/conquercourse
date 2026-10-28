import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { askPhoto, MAX_PHOTO_BODY } from '../functions/api/photo-course';
import { fixLayout } from '../src/slice/fixit';
import { boxSrc, layoutToPieces, parseLayout, pieceFromSrc, scoreLayout, type Layout } from '../src/slice/photo-course';
import { NO_TURN, proves } from '../src/slice/photo-proof';
import { realSize } from '../src/slice/world';

const reply = (id: string) => (JSON.parse(readFileSync(`data/eval/photo-course/outputs/${id}.run1.json`, 'utf8')) as { reply: string }).reply;
const draft = (...items: Layout['items']): Layout => ({ items: [{ kind: 'ground', length: 4 }, ...items, { kind: 'ground', length: 4 }] });

describe('photo to course: reading the model', () => {
  it('reads a real saved answer (three bars) and keeps the sizes inside what the game can build', () => {
    const p = parseLayout(reply('new03'));
    expect(p.layout).not.toBeNull();
    const bars = p.layout!.items.filter((i) => i.kind === 'bar');
    expect(bars.length).toBeGreaterThanOrEqual(2);
    for (const b of bars) expect((b as { height: number }).height).toBeGreaterThanOrEqual(1.5); // a bar lower than the reach is lifted to 1.5 m
    expect(p.text.length).toBeGreaterThan(5);
  });
  it('refuses an answer with no json, no items, or nothing to clear', () => {
    expect(parseLayout('I see a park.').layout).toBeNull();
    expect(parseLayout('```json\n{"items": []}\n```').layout).toBeNull();
    expect(parseLayout('```json\n{"items":[{"kind":"ground","length":5}]}\n```').problems).toContain('nothing to clear in it');
  });
  it('drops items with bad numbers, clamps big ones, and adds ground at both ends', () => {
    const p = parseLayout('```json\n{"items":[{"kind":"block","length":2,"height":50},{"kind":"gap","width":"wide"},{"kind":"lava"}]}\n```');
    expect(p.layout!.items).toEqual([{ kind: 'ground', length: 4 }, { kind: 'block', length: 2, height: 4.3 }, { kind: 'ground', length: 4 }]);
    expect(p.problems.length).toBe(2);
  });
});

describe('photo to course: pieces and the proof', () => {
  it('builds pieces of the right size, centred on the run, and a saved box comes back from its src', () => {
    const ps = layoutToPieces(draft({ kind: 'block', length: 2, height: 0.5 }));
    const block = ps.find((p) => p.name === 'Block')!;
    expect(realSize(block).h).toBeCloseTo(0.5, 2);
    expect(realSize(block).w).toBeCloseTo(2, 2);
    expect(Math.min(...ps.map((p) => p.x))).toBeLessThan(0);
    expect(Math.max(...ps.map((p) => p.x))).toBeGreaterThan(0);
    expect(realSize(pieceFromSrc(boxSrc(2, 0.5, 2), { x: 0, z: 0 })!).h).toBeCloseTo(0.5, 2);
    expect(pieceFromSrc('obj:rail.glb', { x: 0, z: 0 })).toBeNull();
  });
  it('a low block clears; a 3 m wall does not, and Fix it brings it down to something that does', () => {
    expect(proves(layoutToPieces(draft({ kind: 'block', length: 2, height: 0.5 })), NO_TURN)).toBe(true);
    const tall = layoutToPieces(draft({ kind: 'block', length: 2, height: 3 }));
    expect(proves(tall, NO_TURN)).toBe(false);
    const fx = fixLayout(tall, NO_TURN);
    expect(fx.ok).toBe(true);
    expect(proves(fx.pieces, NO_TURN)).toBe(true);
  });
});

describe('photo to course: scoring against the answer key', () => {
  const key = draft({ kind: 'block', length: 3, height: 0.4 }, { kind: 'ground', length: 2 }, { kind: 'block', length: 2, height: 1 });
  it('a perfect draft matches everything with no error', () => {
    expect(scoreLayout(key, key)).toEqual({ keyCount: 2, modelCount: 2, matched: 2, extra: 0, meanRelError: 0, meanAbsError: 0 });
  });
  it('a missing obstacle and an invented one are counted, and size error is relative', () => {
    const s = scoreLayout(draft({ kind: 'block', length: 3, height: 0.8 }, { kind: 'bar', height: 2 }), key);
    expect(s.matched).toBe(1);
    expect(s.extra).toBe(1);
    expect(s.meanRelError).toBeCloseTo(0.5, 1); // height 0.8 against 0.4 is 100% off, length exact: mean 50%
    expect(scoreLayout(null, key).matched).toBe(0);
  });
});

describe('/api/photo-course', () => {
  const img = 'data:image/jpeg;base64,AAAA';
  it('refuses anything that is not a small photo', async () => {
    const never = (async () => { throw new Error('must not call the model'); }) as unknown as typeof fetch;
    expect((await askPhoto('k', { image: 'hello' }, never)).status).toBe(400);
    expect((await askPhoto('k', { image: 'data:text/html;base64,AAAA' }, never)).status).toBe(400);
    expect((await askPhoto('k', { image: `data:image/jpeg;base64,${'A'.repeat(MAX_PHOTO_BODY)}` }, never)).status).toBe(400);
  });
  it('sends the photo and the prompt to the model and returns only the answer text', async () => {
    let sent: { messages: { role: string; content: unknown }[] } | null = null;
    const fake = (async (_u: string, init: { body: string }) => { sent = JSON.parse(init.body); return new Response(JSON.stringify({ choices: [{ message: { content: 'ok ```json {"items":[]}```', reasoning_content: 'secret' } }] })); }) as unknown as typeof fetch;
    const r = await askPhoto('k', { image: img }, fake);
    expect(r).toEqual({ status: 200, body: { reply: 'ok ```json {"items":[]}```' } });
    expect(JSON.stringify(sent)).toContain(img);
    expect(sent!.messages[0].role).toBe('system');
  });
  it('says so when the model runs out of room', async () => {
    const empty = (async () => new Response(JSON.stringify({ choices: [{ message: { content: null } }] }))) as unknown as typeof fetch;
    expect((await askPhoto('k', { image: img }, empty)).status).toBe(502);
  });
});
