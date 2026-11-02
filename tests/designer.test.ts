import { describe, expect, it } from 'vitest';
import { applyEdits, parseReply, worldBrief } from '../src/slice/designer';
import { askSpark, MODEL } from '../functions/api/designer';
import { limited } from '../functions/_lib/limit';
import { newPiece } from '../src/slice/world';

const box = { positions: [0, 0, 0, 2, 0, 0, 2, 1, 0, 0, 1, 1], indices: [0, 1, 2, 0, 2, 3] };
const pieces = [newPiece('bench', box, { x: 3, z: 0 }), newPiece('rail', box, { x: 9, z: 1 })];
const ids = pieces.map((p) => p.id);

describe('worldBrief', () => {
  const b = JSON.parse(worldBrief(pieces, { angle: Math.PI / 6, offset: 0.5, level: 0.25 }, 'no way to clear', ['move the rail 0.4 m closer']));
  it('lists each piece with id, place and real size', () => {
    expect(b.pieces).toHaveLength(2);
    expect(b.pieces[0]).toMatchObject({ id: ids[0], name: 'bench', x: 3, size_m: { long: 2, high: 1, deep: 1 } });
  });
  it('carries the lane, the verdict and the verified advice', () => {
    expect(b.lane).toEqual({ turn_deg: 30, sideways_m: 0.5, water_level_m: 0.25 });
    expect(b.simulator_verdict).toBe('no way to clear');
    expect(b.verified_advice).toEqual(['move the rail 0.4 m closer']);
  });
});

describe('parseReply', () => {
  it('splits the sentences from the json edits', () => {
    const r = parseReply(`Slide the rail closer. It is a long jump.\n\`\`\`json\n[{"piece": ${ids[1]}, "dx": -0.4}]\n\`\`\``, ids);
    expect(r.text).toBe('Slide the rail closer. It is a long jump.');
    expect(r.edits).toEqual([{ piece: ids[1], dx: -0.4 }]);
  });
  it('rejects unknown pieces and clamps moves and scale', () => {
    const r = parseReply(`ok\n\`\`\`json\n[{"piece": 999, "dx": 1}, {"piece": ${ids[0]}, "dx": 50, "scale": 20, "dz": -80}]\n\`\`\``, ids);
    expect(r.edits).toEqual([{ piece: ids[0], dx: 10, dz: -10, scale: 5 }]);
  });
  it('survives malformed or missing json', () => {
    expect(parseReply('Just talk.', ids)).toEqual({ text: 'Just talk.', edits: [] });
    expect(parseReply('hm\n```json\n[{"piece": 1, dx:\n```', ids).edits).toEqual([]);
    expect(parseReply('hm\n```json\n{"piece": 1}\n```', ids).edits).toEqual([]);
    expect(parseReply('hm\n```json\n[{"piece": ' + ids[0] + ', "dx": "far"}]\n```', ids).edits).toEqual([]);
  });
});

describe('applyEdits', () => {
  it('moves, lifts (never below ground) and scales', () => {
    const q = [newPiece('a', box, { x: 1, z: 1 })];
    applyEdits(q, [{ piece: q[0].id, dx: 2, dy: -5, scale: 2 }]);
    expect(q[0]).toMatchObject({ x: 3, z: 1, y: 0, scale: 2 });
  });
});

describe('the server call', () => {
  const ok = (content: string | null) => (async () => new Response(JSON.stringify({ choices: [{ message: { content, reasoning_content: 'secret thoughts' } }] }), { status: 200 })) as unknown as typeof fetch;
  it('sends the hackathon model with room to reason and never returns the reasoning', async () => {
    let sent: { url: string; init: RequestInit } | null = null;
    const f = (async (url: string, init: RequestInit) => { sent = { url, init }; return new Response(JSON.stringify({ choices: [{ message: { content: 'Move it.', reasoning_content: 'secret thoughts' } }] })); }) as unknown as typeof fetch;
    const r = await askSpark('KEY', { messages: [{ role: 'user', content: 'help' }], world: '{}' }, f);
    const body = JSON.parse(String(sent!.init.body));
    expect(body.model).toBe(MODEL);
    expect(body.max_tokens).toBeGreaterThanOrEqual(1500);
    expect(r).toEqual({ status: 200, body: { reply: 'Move it.' } });
    expect(JSON.stringify(r)).not.toContain('secret');
  });
  it('refuses an empty question and an empty answer', async () => {
    expect((await askSpark('K', { messages: [] }, ok('x'))).status).toBe(400);
    expect((await askSpark('K', { messages: [{ role: 'user', content: 'q' }] }, ok(null))).status).toBe(502);
  });
  it('rate-limits one address', () => {
    for (let i = 0; i < 20; i++) expect(limited('1.2.3.4', 1000)).toBe(false);
    expect(limited('1.2.3.4', 1001)).toBe(true);
    expect(limited('1.2.3.4', 1000 + 700_000)).toBe(false);
  });
});
