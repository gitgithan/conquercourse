// Cloudflare Turnstile (the bot check) for the two routes that cost money per call: Make a piece from a photo, and Make a character (CC-103).
// It is a switch: with no TURNSTILE_SECRET set the check is skipped, so the site works the same until the owner turns it on.
// With the secret set, a missing or wrong token is refused. The secret is a Pages secret and never leaves the server.
export interface TurnstileEnv { TURNSTILE_SECRET?: string; TURNSTILE_SITE_KEY?: string }
type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
export const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// A pass: given after one good check on the outline step, accepted by the 3D step for a short time, so one workflow asks once.
// It is "expiry.signature" (HMAC of the expiry with the secret). It is not tied to a person; the daily limits still count every 3D piece.
export const PASS_MS = 30 * 60_000;
const sign = async (secret: string, text: string): Promise<string> => {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(text)))].map((x) => x.toString(16).padStart(2, '0')).join('');
};
export async function makePass(env: TurnstileEnv, now = Date.now()): Promise<string | undefined> {
  if (!env.TURNSTILE_SECRET) return undefined;
  const exp = String(now + PASS_MS);
  return `${exp}.${await sign(env.TURNSTILE_SECRET, `pass:${exp}`)}`;
}
export async function passOk(env: TurnstileEnv, pass: unknown, now = Date.now()): Promise<boolean> {
  if (!env.TURNSTILE_SECRET || typeof pass !== 'string') return false;
  const [exp, sig] = pass.split('.');
  if (!/^\d{10,15}$/.test(exp ?? '') || Number(exp) < now || !sig || sig.length !== 64) return false;
  const want = await sign(env.TURNSTILE_SECRET, `pass:${exp}`);
  let d = 0; for (let i = 0; i < 64; i++) d |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  return d === 0;
}

export async function checkTurnstile(env: TurnstileEnv, token: unknown, ip: string, fetcher: Fetcher = fetch, pass?: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!env.TURNSTILE_SECRET) return { ok: true };
  if (await passOk(env, pass)) return { ok: true };
  const no = { ok: false as const, message: 'Please finish the quick check that you are a person, then try again.' };
  if (typeof token !== 'string' || token.length < 10 || token.length > 4096) return no;
  try {
    const res = await fetcher(VERIFY_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }).toString() });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true ? { ok: true } : no;
  } catch { return no; } // fails closed: when the check cannot be asked, a paid call is not made
}
