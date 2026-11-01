// Cloudflare Turnstile (the bot check) for the two routes that cost money per call: Make a piece from a photo, and Make a character (CC-103).
// It is a switch: with no TURNSTILE_SECRET set the check is skipped, so the site works the same until the owner turns it on.
// With the secret set, a missing or wrong token is refused. The secret is a Pages secret and never leaves the server.
export interface TurnstileEnv { TURNSTILE_SECRET?: string; TURNSTILE_SITE_KEY?: string }
type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
export const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function checkTurnstile(env: TurnstileEnv, token: unknown, ip: string, fetcher: Fetcher = fetch): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!env.TURNSTILE_SECRET) return { ok: true };
  const no = { ok: false as const, message: 'Please finish the quick check that you are a person, then try again.' };
  if (typeof token !== 'string' || token.length < 10 || token.length > 4096) return no;
  try {
    const res = await fetcher(VERIFY_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }).toString() });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true ? { ok: true } : no;
  } catch { return no; } // fails closed: when the check cannot be asked, a paid call is not made
}
