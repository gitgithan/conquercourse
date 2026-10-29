// The end report's buttons in labelled sections (CC-158): Share first and biggest, then Play, Learn, More.
// Plain words only; nothing here grades or coaches. ?report=old keeps the one long row of buttons.
import { HUD } from './hud-style';

export const reportSectionsOn = (params: URLSearchParams): boolean => params.get('report') !== 'old';

const SMALL = 'font:700 12px system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#58635d';

/** Take the buttons the report and the share code put in `#report-actions` and lay them out in sections. */
export function organiseReport(body: HTMLElement, o: { dojo?: () => void } = {}): void {
  const row = body.querySelector<HTMLElement>('#report-actions');
  if (!row) return;
  const get = (id: string) => row.querySelector<HTMLElement>(`#${id}`);
  const [again, watch, next, close, chase, copy, clip, nick] = ['report-again', 'report-watch', 'report-next', 'report-close', 'report-chase', 'share-copy', 'share-clip', 'share-nick'].map(get);

  // Share: the card at the top, bright, so nobody misses it
  if (clip || copy) {
    const card = document.createElement('section');
    card.id = 'report-share'; card.setAttribute('aria-label', 'Share this run');
    card.style.cssText = `display:grid;gap:8px;background:${HUD.panelSolid};color:${HUD.text};border-radius:12px;padding:12px 14px;box-shadow:0 2px 10px #0004`;
    const head = document.createElement('div'); head.textContent = 'Share this run'; head.style.cssText = 'font:700 12px system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#ffb347';
    const big = 'font:800 17px system-ui,sans-serif;border:0;border-radius:10px;padding:11px 18px;cursor:pointer;background:#ffb347;color:#1b1004;flex:1 1 200px';
    const buttons = document.createElement('div'); buttons.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;align-items:center';
    if (clip) { clip.textContent = 'Download your clip'; clip.style.cssText = big; buttons.append(clip); }
    if (copy) {
      copy.style.cssText = big.replace('background:#ffb347;color:#1b1004', clip ? 'background:#f4f7f1;color:#10141c' : 'background:#ffb347;color:#1b1004');
      buttons.append(copy);
      if (nick) { nick.style.cssText = 'font:inherit;border:1px solid #ffffff55;background:#232a36;color:#f4f7f1;border-radius:8px;padding:8px;width:4.2em;text-transform:uppercase;text-align:center'; buttons.append(nick); }
    }
    const note = document.createElement('div'); note.style.cssText = `font:500 14px/1.4 system-ui,sans-serif;color:${HUD.soft}`;
    note.textContent = copy ? 'A friend opens your link, plays your exact keys, and tries to beat your time. The clip is a short video to post.' : 'The clip is a short video to post. A link needs a run from the start of the course.';
    card.append(head, buttons, note);
    body.querySelector('h2')?.after(card);
    if (!body.querySelector('h2')) body.prepend(card);
  }

  // Play / Learn / More: small labelled groups in the bottom row
  const group = (label: string, items: (HTMLElement | null | undefined)[]) => {
    const kids = items.filter((x): x is HTMLElement => !!x);
    if (!kids.length) return null;
    const g = document.createElement('div'); g.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center';
    const l = document.createElement('span'); l.textContent = label; l.style.cssText = `${SMALL};min-width:46px`;
    g.append(l, ...kids); return g;
  };
  let dojo: HTMLButtonElement | null = null;
  if (o.dojo) { dojo = document.createElement('button'); dojo.type = 'button'; dojo.id = 'report-dojo'; dojo.textContent = 'Dojo (T)'; dojo.style.cssText = again?.style.cssText.replace(/background:[^;]+;/, 'background:#fff;').replace(/color:[^;]+;/, 'color:#17201d;') ?? ''; dojo.onclick = o.dojo; }
  const play = group('Play', [again, next, chase]), others = [group('Learn', [watch, dojo]), group('More', [close])].filter((g): g is HTMLDivElement => !!g);
  if (others.length) { const more = document.createElement('div'); more.style.cssText = 'display:grid;gap:8px'; more.append(...others); row.before(more); } // only Play stays pinned at the bottom, so the Share card is never covered
  row.replaceChildren(...(play ? [play] : []));
  row.style.cssText = 'display:grid;gap:8px;position:sticky;bottom:-16px;background:#fffffff5;padding:8px 0';
}
