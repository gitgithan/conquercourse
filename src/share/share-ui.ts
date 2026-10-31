// The small pieces of page for sharing (CC-128, CC-129): the "Beat this time" banner, the two report buttons and the clip card.
// Plain words only. Nothing here asks for a name or an account.
import { nickOk, tidyNick } from './nick';
import { countdownLabel, shareWaitText } from '../sim/slow-down';
import { countdownButton } from '../ui/countdown';
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

/** The link button: it uses the name saved from the box at the top of the report (it has no box of its own). Its words say what happened. A try that fell gets the same button (CC-181). */
export type LinkResult = { url: string | null; wait?: number | null };
export function copyLinkButton(o: { link: (nick: string) => Promise<string | null | LinkResult>; courseTooBig?: () => Promise<boolean>; label?: string; id?: string }): HTMLElement[] {
  const label = o.label ?? 'Copy link to challenge a friend';
  const nickNow = (): string => { try { return tidyNick(localStorage.getItem('cc.nick') ?? ''); } catch { return ''; } }; // the one name box is at the top of the report (src/ui/leaderboard.ts)
  const note = document.createElement('div'); note.id = 'share-wait'; note.setAttribute('role', 'status');
  note.style.cssText = 'flex-basis:100%;font-size:.85em;font-weight:600;color:#8a5a00;display:none';
  let pauseUntil = 0, longUrl: string | null = null; // CC-219: while the server asks for a pause, the long link is copied without asking it again
  const give = async (url: string): Promise<void> => {
    try { await navigator.clipboard.writeText(url); copy.textContent = 'Link copied'; }
    catch { window.prompt('Copy this link', url); copy.textContent = 'Link ready'; }
  };
  const copy = button(label, () => {
    if (Date.now() < pauseUntil && longUrl) { void give(longUrl).then(() => setTimeout(() => { if (!copy.disabled) copy.textContent = label; }, 2500)); return; }
    void o.link(nickNow()).then(async (got) => {
      const r: LinkResult = got === null || typeof got === 'string' ? { url: got } : got;
      if (r.wait) {
        pauseUntil = Date.now() + r.wait * 1000; longUrl = r.url;
        note.style.display = ''; note.textContent = `${shareWaitText(r.wait)}${r.url ? ' The long link is copied and works now.' : ' You can still download a video.'}`;
        if (r.url) await give(r.url);
        if (!r.url) { countdownButton(copy, r.wait, label, (left) => `Short link in ${countdownLabel(left)}`, () => { note.style.display = 'none'; longUrl = null; }); return; }
        setTimeout(() => { copy.textContent = label; }, 2500);
        setTimeout(() => { note.style.display = 'none'; longUrl = null; pauseUntil = 0; }, r.wait * 1000);
        return;
      }
      const url = r.url;
      if (!url) {
        const big = nickOk(nickNow()) && o.courseTooBig ? await o.courseTooBig() : false;
        copy.textContent = !nickOk(nickNow()) ? 'Pick another name in the box at the top' : big ? 'This course is too big for a link' : 'This run is too long for a link';
        setTimeout(() => { copy.textContent = label; }, 2500); return; }
      await give(url);
      setTimeout(() => { copy.textContent = label; }, 2500);
    });
  });
  copy.id = o.id ?? 'share-copy';
  copy.style.cssText = BTN.replace('background:#fff;color:#17201d', 'background:#0f6b5c;color:#fff;font-weight:700'); // the main share action
  return [copy, note];
}

/** Buttons for the end-of-run report. The link is the way to share (it plays the run in the browser); the video is only a download. */
export function shareButtons(o: { link?: (nick: string) => Promise<string | null | LinkResult>; courseTooBig?: () => Promise<boolean>; clip?: () => void }): HTMLElement[] {
  const out: HTMLElement[] = o.link ? copyLinkButton({ link: o.link, courseTooBig: o.courseTooBig }) : []; // a run that did not start at the start of the course has a video but no link (CC-157)
  if (o.clip) { const c = button('Download a video', o.clip); c.id = 'share-clip'; out.push(c); }
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
      a.href = url; a.download = name; a.id = 'clip-download'; a.textContent = 'Download video'; a.style.cssText = BTN + ';text-decoration:none';
      say(note); el.append(a, button('Close', () => { el.remove(); URL.revokeObjectURL(url); }));
    },
  };
}
