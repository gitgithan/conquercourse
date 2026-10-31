import { describe, expect, it } from 'vitest';
import { askAgent } from '../functions/api/course-agent';

const ok = (content: string): typeof fetch => (async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })) as typeof fetch;

describe('/api/course-agent', () => {
  it('sends the messages to the model with the key in a header and never in the body', async () => {
    let sent: { headers: Record<string, string>; body: string } | null = null;
    const f = (async (_u: string, init: RequestInit) => { sent = { headers: init.headers as Record<string, string>, body: String(init.body) }; return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }); }) as unknown as typeof fetch;
    const r = await askAgent('SECRET', { messages: [{ role: 'user', content: 'Propose.' }] }, f);
    expect(r.status).toBe(200);
    expect(r.body.reply).toBe('ok');
    expect(sent!.headers.authorization).toBe('Api-Key SECRET');
    expect(sent!.body).not.toContain('SECRET');
    expect(sent!.body).not.toContain('image_url');
  });
  it('turns away bad bodies without calling the model', async () => {
    let calls = 0;
    const f = (async () => { calls++; return new Response('{}'); }) as unknown as typeof fetch;
    for (const b of [{}, { messages: [] }, { messages: [{ role: 'system', content: 'x' }] }, { messages: [{ role: 'assistant', content: 'x' }] }, { messages: [{ role: 'user', content: 'x'.repeat(5000) }] }, { messages: Array(5).fill({ role: 'user', content: 'x' }) }]) {
      expect((await askAgent('k', b as Record<string, unknown>, f)).status).toBe(400);
    }
    expect(calls).toBe(0);
  });
  it('says so when the model is down or answers with nothing', async () => {
    const down = (async () => new Response('x', { status: 500 })) as unknown as typeof fetch;
    expect((await askAgent('k', { messages: [{ role: 'user', content: 'x' }] }, down)).status).toBe(502);
    expect((await askAgent('k', { messages: [{ role: 'user', content: 'x' }] }, ok(''))).status).toBe(502);
  });
});
