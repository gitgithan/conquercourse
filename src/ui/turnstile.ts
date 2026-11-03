// The bot check on the page (CC-103): asks the server whether it is on, and if so shows Cloudflare's small check and returns its token.
// Off (no key) -> returns undefined at once and nothing is shown. Used before "Make a character" and "Make a piece from a photo".
type TS = { render: (el: HTMLElement, o: Record<string, unknown>) => string; remove: (id: string) => void };
let script: Promise<void> | null = null;
const load = (): Promise<void> => (script ??= new Promise((ok, bad) => {
  const s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true;
  s.onload = () => ok(); s.onerror = () => { script = null; bad(new Error('check')); }; document.head.appendChild(s);
}));

export async function turnstileToken(f: typeof fetch = fetch): Promise<string | undefined> {
  let key: string | null = null;
  try { key = ((await (await f('/api/turnstile-key')).json()) as { siteKey?: string | null }).siteKey ?? null; } catch { return undefined; }
  if (!key) return undefined;
  await load();
  const ts = (window as unknown as { turnstile: TS }).turnstile;
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45)';
  const card = document.createElement('div');
  card.style.cssText = 'background:#fff;color:#222;padding:18px 22px;border-radius:12px;font:15px system-ui,sans-serif;text-align:center';
  card.innerHTML = '<p style="margin:0 0 10px">One quick check that you are a person.</p>';
  const slot = document.createElement('div'); card.appendChild(slot); box.appendChild(card); document.body.appendChild(box);
  return new Promise((ok, bad) => {
    const done = (fn: () => void) => { box.remove(); fn(); };
    ts.render(slot, { sitekey: key, callback: (t: string) => done(() => ok(t)), 'error-callback': () => done(() => bad(new Error('The check did not work. Try again.'))), 'expired-callback': () => undefined });
  });
}

// The pass from the outline step (the server gives it after one good check); the 3D step uses it for the same photo, so a person is asked once.
let held: { pass: string; photo: string; until: number } | null = null;
/** A short stand-in for the photo (its length and last characters), so the stored pass does not carry a whole picture. */
const printOf = (photo: string): string => `${photo.length}:${photo.slice(-160)}`;
// The pass also lives in this tab's session storage, so a player who leaves the Make screen and comes back is not asked again (it is signed for this photo and runs out in 25 minutes).
const PASS_KEY = 'cc.pass';
const loadHeld = (now: number): void => {
  if (held) return;
  try { const v = JSON.parse(sessionStorage.getItem(PASS_KEY) ?? 'null') as { pass?: unknown; photo?: unknown; until?: unknown } | null; if (v && typeof v.pass === 'string' && typeof v.photo === 'string' && typeof v.until === 'number' && v.until > now) held = { pass: v.pass, photo: v.photo, until: v.until }; } catch { /* asked again */ }
};
export const rememberPass = (pass: string, photo: string, now = Date.now()): void => {
  held = { pass, photo: printOf(photo), until: now + 25 * 60_000 };
  try { sessionStorage.setItem(PASS_KEY, JSON.stringify(held)); } catch { /* asked again after a reload */ }
};
/** What to send with a paid call: the held pass when it was made for this photo, else a fresh check (undefined when the check is off). */
export async function checkField(f: typeof fetch = fetch, now = Date.now(), photo?: string): Promise<{ pass: string } | { turnstile: string | undefined }> {
  loadHeld(now);
  if (held && held.until > now && photo !== undefined && held.photo === printOf(photo)) return { pass: held.pass };
  return { turnstile: await turnstileToken(f) };
}
