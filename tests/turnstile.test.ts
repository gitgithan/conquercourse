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
import { handle as lift } from '../functions/api/object-lift';
const b64 = (t: string) => btoa(t);
describe('lift receipt for sharing a piece', () => {
  const env = { CC_UPLOAD_TOKEN: 'srv-secret', REQUIRE_LIFT_RECEIPT: '1' };
  const job = 'fc-AbCdEfGhIjKl', piece = b64('glTF-piece-bytes-one'), other = b64('glTF-some-other-file');
  it('is checked and single-use when required', async () => {
    const { db } = localD1(); const e = { ...env, DB: db as never };
    const r = (await makeReceipt(env, job, piece))!;
    expect((await spendReceipt(e, r, piece)).ok).toBe(true);
    expect((await spendReceipt(e, r, piece)).ok).toBe(false);
  });
  it('works only for the very piece the lift made', async () => {
    const { db } = localD1(); const e = { ...env, DB: db as never };
    const r = (await makeReceipt(env, job, piece))!;
    expect((await spendReceipt(e, r, other)).ok).toBe(false);
    expect((await spendReceipt(e, r, undefined)).ok).toBe(false);
    expect((await spendReceipt(e, r, piece)).ok).toBe(true); // the refusals above did not spend it
  });
  it('refuses none, forged, old, and other-secret receipts', async () => {
    const { db } = localD1(); const e = { ...env, DB: db as never }, t = 1_700_000_000_000, r = (await makeReceipt(env, job, piece, t))!;
    expect((await spendReceipt(e, undefined, piece)).ok).toBe(false);
    expect((await spendReceipt(e, r.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a')), piece, t)).ok).toBe(false);
    expect(await receiptJob(env, r, piece, t + RECEIPT_MS + 1)).toBeNull();
    expect(await receiptJob({ CC_UPLOAD_TOKEN: 'other' }, r, piece, t)).toBeNull();
  });
  it('lets everything through while the switch is off', async () => { expect((await spendReceipt({ CC_UPLOAD_TOKEN: 'x' }, undefined, undefined)).ok).toBe(true); });
  it('the status of a finished lift carries a receipt for that piece, a running one does not', async () => {
    const e = { CC_UPLOAD_TOKEN: 't', CC_UPLOAD_SUBMIT_URL: 'https://x--y.modal.run', CC_UPLOAD_STATUS_URL: 'https://x--z.modal.run' };
    const reply = (body: unknown) => (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch;
    const done = await lift({ action: 'status', id: job }, e, 'ip', reply({ state: 'done', glb: piece }));
    const receipt = (done.body as { receipt?: string }).receipt!;
    expect(await receiptJob({ CC_UPLOAD_TOKEN: 't' }, receipt, piece)).toBe(job);
    expect(await receiptJob({ CC_UPLOAD_TOKEN: 't' }, receipt, other)).toBeNull();
    const running = await lift({ action: 'status', id: job }, e, 'ip', reply({ state: 'running' }));
    expect((running.body as { receipt?: string }).receipt).toBeUndefined();
  });
});

describe('receipt table tidy-up', () => {
  it('drops rows older than the lifetime plus a day, keeps newer ones, and a spent receipt stays spent', async () => {
    const { db, sql } = localD1(); const env = { CC_UPLOAD_TOKEN: 's', REQUIRE_LIFT_RECEIPT: '1', DB: db as never };
    const now = 1_800_000_000_000, day = 86_400;
    sql.exec(`INSERT INTO lift_receipts (id, used_at) VALUES ('fc-OLDOLDOLDOLD', ${Math.floor(now / 1000) - 40 * day}), ('fc-NEWNEWNEWNEW', ${Math.floor(now / 1000) - 5 * day})`);
    const piece = btoa('abc'), r = (await makeReceipt(env, 'fc-FRESHFRESH1', piece, now))!;
    expect((await spendReceipt(env, r, piece, now)).ok).toBe(true);
    const ids = (sql.prepare('SELECT id FROM lift_receipts ORDER BY id').all() as { id: string }[]).map((x) => x.id);
    expect(ids).toEqual(['fc-FRESHFRESH1', 'fc-NEWNEWNEWNEW']);
    expect((await spendReceipt(env, r, piece, now)).ok).toBe(false);
  });
});
