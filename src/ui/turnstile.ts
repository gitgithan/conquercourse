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
