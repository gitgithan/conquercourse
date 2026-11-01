// /api/turnstile-key -> {siteKey: string | null}. The site key is public by design (it is in the page anyway); null means the bot check is off here.
import { json } from '../_lib/http';
export const onRequestGet = async ({ env }: { env: { TURNSTILE_SITE_KEY?: string; TURNSTILE_SECRET?: string } }): Promise<Response> =>
  json({ siteKey: env.TURNSTILE_SECRET && env.TURNSTILE_SITE_KEY ? env.TURNSTILE_SITE_KEY : null }, 200, { 'cache-control': 'no-store' });
