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

import { makePass, passOk, PASS_MS } from '../functions/_lib/turnstile';
describe('pass from the outline step', () => {
  const env = { TURNSTILE_SECRET: 's3cret' };
  it('is accepted by the 3D step and skips a second check', async () => {
    const pass = await makePass(env);
    expect(await passOk(env, pass)).toBe(true);
    const f = vi.fn();
    expect((await checkTurnstile(env, undefined, 'ip', f as never, pass)).ok).toBe(true);
    expect(f).not.toHaveBeenCalled();
  });
  it('is refused when old, forged, or made with another secret', async () => {
    const t = 1_700_000_000_000, pass = (await makePass(env, t))!;
    expect(await passOk(env, pass, t + PASS_MS + 1)).toBe(false);
    expect(await passOk(env, pass.replace(/.$/, (c) => (c === '0' ? '1' : '0')), t)).toBe(false);
    expect(await passOk({ TURNSTILE_SECRET: 'other' }, pass, t)).toBe(false);
    expect(await passOk(env, 'junk')).toBe(false);
  });
  it('does nothing when the check is off', async () => { expect(await makePass({})).toBeUndefined(); });
});

import { makeReceipt, receiptJob, spendReceipt, RECEIPT_MS } from '../functions/_lib/receipt';
import { localD1 } from './helpers-d1';
describe('lift receipt for sharing a piece', () => {
  const env = { CC_UPLOAD_TOKEN: 'srv-secret', REQUIRE_LIFT_RECEIPT: '1' };
  const job = 'fc-AbCdEfGhIjKl';
  it('is checked and single-use when required', async () => {
    const { db } = localD1(); const e = { ...env, DB: db as never };
    const r = (await makeReceipt(env, job))!;
    expect((await spendReceipt(e, r)).ok).toBe(true);
    expect((await spendReceipt(e, r)).ok).toBe(false);
  });
  it('refuses none, forged, old, and other-secret receipts', async () => {
    const { db } = localD1(); const e = { ...env, DB: db as never }, t = 1_700_000_000_000, r = (await makeReceipt(env, job, t))!;
    expect((await spendReceipt(e, undefined)).ok).toBe(false);
    expect((await spendReceipt(e, r.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a')), t)).ok).toBe(false);
    expect(await receiptJob(env, r, t + RECEIPT_MS + 1)).toBeNull();
    expect(await receiptJob({ CC_UPLOAD_TOKEN: 'other' }, r, t)).toBeNull();
  });
  it('lets everything through while the switch is off', async () => { expect((await spendReceipt({ CC_UPLOAD_TOKEN: 'x' }, undefined)).ok).toBe(true); });
});
