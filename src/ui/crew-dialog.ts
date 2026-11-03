// Meet the crew (owner request, 2026-11-03): ten cards, one per built-in character, each with a name and a short run loop,
// and the character maker one press away. The "X says" pills are not here: they show up on the page where each one speaks.
// ?crewcards=old brings back the strip of voice pills (src/ui/says.ts).
import { flag } from '../flags';
import { closeOnBackdrop } from './backdrop';
import { openCrewDialog as openCrewStrip } from './says';
import { loadCrewCards, startCrewLoop, type CrewCard, type CrewLoop } from '../characters/crew-cards';
import { openCharacterPanel } from '../characters/panel';
import { saveChoice } from '../characters/runner';

export const crewCardsOn = (value: string | null = flag('crewcards')): boolean => value !== 'old';

const CSS = `
#crew-dialog .cc-card{background:#f6f8f5;color:#17201d;border-radius:18px;padding:16px 18px;width:min(1000px,94vw);max-height:90vh;overflow:hidden;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:10px;box-shadow:0 20px 60px #0006;font-family:system-ui,sans-serif}
#crew-dialog .cc-top{display:flex;align-items:center;justify-content:space-between;gap:12px}
#crew-dialog h2{margin:0;font-size:24px}
#crew-dialog .cc-sub{margin:0;color:#44504a;font-size:15px}
#crew-dialog button.cc-make{font:800 16px system-ui,sans-serif;border:3px solid #17201d;border-radius:999px;padding:7px 18px;background:#ffd23f;color:#17201d;box-shadow:0 3px 0 #17201d;cursor:pointer}
#crew-dialog button.cc-close{justify-self:end;font:700 15px system-ui,sans-serif;border:0;border-radius:10px;padding:8px 18px;background:#0f6b5c;color:#fff;cursor:pointer}
#crew-cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:0;padding:2px;list-style:none;overflow:auto;min-height:0;align-content:start}
#crew-cards>li{display:grid;justify-items:center;gap:4px;padding:8px 6px 10px;border-radius:12px;background:#fff;border:1px solid #d6ddd6;border-top:5px solid var(--a)}
#crew-cards .cc-pic{position:relative;width:min(150px,100%);aspect-ratio:1;border-radius:10px;background:#e1e7e2;overflow:hidden;display:grid;place-items:center}
#crew-cards .cc-pic>*{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
#crew-cards .cc-pic canvas[data-live]{background:#e1e7e2}
#crew-cards .cc-disc{inset:auto;position:static;width:56%;height:auto;aspect-ratio:1;border-radius:50%;background:var(--a);color:#fff;display:grid;place-items:center;font:800 34px system-ui,sans-serif}
#crew-cards b{font-size:16px}
#crew-cards .cc-blurb{font-size:12px;color:#44504a;text-align:center;line-height:1.3;max-height:2.6em;overflow:hidden}
`;

function cardEl(doc: Document, c: CrewCard, canvases: Map<string, HTMLCanvasElement>): HTMLLIElement {
  const li = doc.createElement('li'); li.dataset.key = c.key; li.style.setProperty('--a', c.accent);
  const pic = doc.createElement('div'); pic.className = 'cc-pic';
  if (c.thumb) { const img = Object.assign(doc.createElement('img'), { src: c.thumb, alt: '', width: 150, height: 150 }); img.loading = 'lazy'; pic.append(img); }
  else { const d = doc.createElement('div'); d.className = 'cc-disc'; d.textContent = c.name[0]; pic.append(d); }
  const cv = doc.createElement('canvas'); cv.width = 200; cv.height = 200; cv.dataset.key = c.key; cv.setAttribute('aria-hidden', 'true'); pic.append(cv); canvases.set(c.key, cv);
  const name = doc.createElement('b'); name.textContent = c.name;
  const blurb = doc.createElement('span'); blurb.className = 'cc-blurb'; blurb.textContent = c.blurb; blurb.title = c.blurb;
  li.append(pic, name, blurb);
  return li;
}

/** The crew dialog. Esc, Close or a click outside shuts it and stops the loop. Returns the dialog. */
export function openCrewDialog(doc: Document = document): HTMLElement {
  if (!crewCardsOn()) return openCrewStrip(doc);
  const old = doc.getElementById('crew-dialog'); if (old) return old;
  if (!doc.getElementById('crew-cards-style')) doc.head.append(Object.assign(doc.createElement('style'), { id: 'crew-cards-style', textContent: CSS }));
  const shade = doc.createElement('div'); shade.id = 'crew-dialog'; shade.setAttribute('role', 'dialog'); shade.setAttribute('aria-label', 'Meet the crew');
  shade.style.cssText = 'position:fixed;inset:0;z-index:90;background:#0e1412b8;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif';
  const card = doc.createElement('div'); card.className = 'cc-card';
  const top = doc.createElement('div'); top.className = 'cc-top';
  const h = doc.createElement('h2'); h.textContent = 'Meet the crew';
  const make = doc.createElement('button'); make.type = 'button'; make.id = 'crew-make'; make.className = 'cc-make'; make.textContent = 'Make a character';
  top.append(h, make);
  const p = doc.createElement('p'); p.className = 'cc-sub'; p.textContent = 'Ten runners ship with the game. Describe your own and it joins them.';
  const list = doc.createElement('ul'); list.id = 'crew-cards'; list.setAttribute('aria-label', 'The ten built-in characters');
  const close = doc.createElement('button'); close.type = 'button'; close.id = 'crew-close'; close.className = 'cc-close'; close.textContent = 'Close';
  card.append(top, p, list, close); shade.append(card); doc.body.append(shade);

  const canvases = new Map<string, HTMLCanvasElement>();
  let loop: CrewLoop | null = null, shut = false;
  void loadCrewCards().then((cards) => {
    if (shut) return;
    for (const c of cards) list.append(cardEl(doc, c, canvases));
    loop = startCrewLoop(cards, canvases, list);
  });
  const end = () => { shut = true; loop?.stop(); shade.remove(); doc.removeEventListener('keydown', onKey, true); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !doc.getElementById('chars')) { e.stopPropagation(); end(); } }; // the maker panel closes first
  doc.addEventListener('keydown', onKey, true); close.onclick = end; closeOnBackdrop(shade, end);
  // the maker opens on top of this dialog, same panel, same limits and checks as in the Course; a pick is remembered for the next Course
  make.onclick = () => { openCharacterPanel({ current: null, parent: shade, onPick: (c) => saveChoice(c?.id ?? null) }); };
  close.focus();
  return shade;
}
