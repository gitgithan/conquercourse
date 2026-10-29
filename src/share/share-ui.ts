// The small pieces of page for sharing (CC-128, CC-129): the "Beat this time" banner, the two report buttons and the clip card.
// Plain words only. Nothing here asks for a name or an account.
import { nickOk, tidyNick } from './nick';
const BTN = 'font:inherit;border:1px solid #17201d;background:#fff;color:#17201d;border-radius:8px;padding:6px 12px;cursor:pointer';

function card(id: string): HTMLElement {
  document.getElementById(id)?.remove();
  const el = document.createElement('div');
  el.id = id; el.setAttribute('role', 'status');
  el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);z-index:30;background:#fffffff2;color:#17201d;border:2px solid #17201d;border-radius:12px;padding:8px 14px;font:600 15px system-ui,sans-serif;display:flex;gap:10px;align-items:center;flex-wrap:wrap;max-width:min(92vw,520px)';
  document.body.append(el);
  return el;
}
const button = (label: string, go: () => void): HTMLButtonElement => {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = label; b.style.cssText = BTN; b.onclick = go;
  return b;
};

/** A line near the top: 'Beat this time: 7.32 s'. It goes away by itself, or with the close button. */
export function showBanner(text: string, actions: { label: string; go: () => void }[] = [], keepMs = 14000): void {
  const el = card('challenge-banner');
  el.style.top = '84px';
  const t = document.createElement('span'); t.textContent = text;
  const x = button('Close', () => el.remove());
  el.append(t, ...actions.map((a) => button(a.label, a.go)), x);
  if (keepMs > 0) setTimeout(() => el.remove(), keepMs);
}

/** Buttons for the end-of-run report. Copy link says what happened in the button itself. */
export function shareButtons(o: { link: (nick: string) => Promise<string | null>; courseTooBig?: () => Promise<boolean>; clip?: () => void }): HTMLElement[] {
  const nick = document.createElement('input');
  nick.id = 'share-nick'; nick.maxLength = 3; nick.placeholder = 'Tag'; nick.size = 4; nick.autocomplete = 'off'; nick.spellcheck = false;
  nick.title = 'Optional: up to three letters, so your friend sees who to beat. Not your real name.';
  nick.setAttribute('aria-label', 'Optional three-letter tag');
  nick.style.cssText = BTN + ';width:4.2em;text-transform:uppercase;text-align:center';
  nick.oninput = () => { nick.value = tidyNick(nick.value); };
  const copy = button('Copy challenge link', () => {
    void o.link(nick.value).then(async (url) => {
      if (!url) {
        const big = nickOk(nick.value) && o.courseTooBig ? await o.courseTooBig() : false;
        copy.textContent = !nickOk(nick.value) ? 'Pick another tag' : big ? 'This course is too big for a link' : 'This run is too long for a link';
        setTimeout(() => { copy.textContent = 'Copy challenge link'; }, 2500); return; }
      try { await navigator.clipboard.writeText(url); copy.textContent = 'Link copied'; }
      catch { window.prompt('Copy this link', url); copy.textContent = 'Link ready'; }
      setTimeout(() => { copy.textContent = 'Copy challenge link'; }, 2500);
    });
  });
  copy.id = 'share-copy';
  const out: HTMLElement[] = [nick, copy];
  if (o.clip) { const c = button('Make a clip', o.clip); c.id = 'share-clip'; out.push(c); }
  return out;
}

/** A card that says what the clip is doing, then offers the file. */
export function clipCard(): { say(text: string): void; done(blob: Blob, name: string, note: string): void; fail(text: string): void } {
  const el = card('clip-card');
  el.style.top = '84px';
  const say = (text: string) => { el.replaceChildren(Object.assign(document.createElement('span'), { textContent: text })); };
  return {
    say,
    fail(text) { say(text); el.append(button('Close', () => el.remove())); },
    done(blob, name, note) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; a.id = 'clip-download'; a.textContent = 'Download clip'; a.style.cssText = BTN + ';text-decoration:none';
      say(note); el.append(a, button('Close', () => { el.remove(); URL.revokeObjectURL(url); }));
    },
  };
}
