import { describe, expect, it, vi } from 'vitest';
import { checkTurnstile } from '../functions/_lib/turnstile';
import { onRequestGet } from '../functions/api/turnstile-key';

const ok = () => vi.fn(async () => new Response(JSON.stringify({ success: true })));
const bad = () => vi.fn(async () => new Response(JSON.stringify({ success: false })));

describe('bot check (Turnstile)', () => {
  it('is off when no secret is set', async () => { expect(await checkTurnstile({}, undefined, 'ip')).toEqual({ ok: true }); });
  it('refuses a missing or odd token when on', async () => {
    const f = ok();
    for (const t of [undefined, '', 'short', 'x'.repeat(5000), 42]) expect((await checkTurnstile({ TURNSTILE_SECRET: 's' }, t, 'ip', f)).ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it('accepts a token Cloudflare approves and refuses one it does not', async () => {
    expect((await checkTurnstile({ TURNSTILE_SECRET: 's' }, 'a'.repeat(40), 'ip', ok())).ok).toBe(true);
    expect((await checkTurnstile({ TURNSTILE_SECRET: 's' }, 'a'.repeat(40), 'ip', bad())).ok).toBe(false);
  });
  it('fails closed when Cloudflare cannot be reached', async () => {
    expect((await checkTurnstile({ TURNSTILE_SECRET: 's' }, 'a'.repeat(40), 'ip', vi.fn(async () => { throw new Error('down'); }))).ok).toBe(false);
  });
  it('shows the site key only when both keys are set, and never the secret', async () => {
    expect(await (await onRequestGet({ env: {} })).json()).toEqual({ siteKey: null });
    expect(await (await onRequestGet({ env: { TURNSTILE_SITE_KEY: 'pub' } })).json()).toEqual({ siteKey: null });
    const body = await (await onRequestGet({ env: { TURNSTILE_SITE_KEY: 'pub', TURNSTILE_SECRET: 'priv' } })).text();
    expect(body).toContain('pub'); expect(body).not.toContain('priv');
  });
});
