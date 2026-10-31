// Real photos of a real place (CC-85): small thumbnails with the credit under each one; a click opens a large view.
// The photos come from Wikimedia Commons under a free licence (CC0, public domain, CC BY or CC BY-SA); the credit is always on screen.
import { nameTag, saysOn, VOICES } from './says';
export interface PhotoCredit {
  file: string; title: string; author: string; licence: string; licenceUrl: string; source: string; date: string;
  hint: string; changes: string; width: number; height: number; bytes: number;
}
export interface PlacePhotos { place: string; name: string; photos: PhotoCredit[]; note?: string; status?: string } // note: replaces the default line under the strip (live photos name Mapillary there)
export interface PlaceIndexEntry { slug: string; name: string; lat: number; lon: number; radiusKm: number }

export const PLACES_DIR = '/assets/places';
const HIDE_KEY = 'cc.photos.hidden';

// The OSM courses are named "OSM <slug>" (scripts/osm-lane.ts); the slug is the folder of the photos.
export const slugOfCourse = (name: string): string | null => /^OSM ([a-z0-9-]+)$/.exec(name)?.[1] ?? null;

// A stored photo is a file in the place folder; a live one (CC-90) is a full https address.
export const srcOf = (d: PlacePhotos, p: PhotoCredit): string => (/^https:\/\//.test(p.file) ? p.file : `${PLACES_DIR}/${d.place}/${p.file}`);

export const captionFor = (d: PlacePhotos, p: PhotoCredit): string => `Real photo of ${d.name}, ${p.author}, ${p.licence}`;

// The listed place nearest to a pin, if the pin is inside its radius.
export function nearestPlace(index: PlaceIndexEntry[], lat: number, lon: number): PlaceIndexEntry | null {
  const R = 6371, rad = (x: number) => (x * Math.PI) / 180;
  let best: PlaceIndexEntry | null = null, bd = Infinity;
  for (const p of index) {
    const a = Math.sin(rad(p.lat - lat) / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(p.lat)) * Math.sin(rad(p.lon - lon) / 2) ** 2;
    const d = 2 * R * Math.asin(Math.sqrt(a));
    if (d <= p.radiusKm && d < bd) { bd = d; best = p; }
  }
  return best;
}

export async function loadPhotoIndex(f: typeof fetch = fetch): Promise<PlaceIndexEntry[]> {
  try { const r = await f(`${PLACES_DIR}/photos-index.json`); return r.ok ? ((await r.json()) as { places: PlaceIndexEntry[] }).places : []; } catch { return []; }
}

export async function loadPlacePhotos(slug: string, f: typeof fetch = fetch): Promise<PlacePhotos | null> {
  try {
    const r = await f(`${PLACES_DIR}/${slug}/credits.json`);
    if (!r.ok) return null;
    const d = (await r.json()) as PlacePhotos;
    return Array.isArray(d.photos) && d.photos.length ? d : null;
  } catch { return null; }
}

const readHidden = (): boolean => { try { return localStorage.getItem(HIDE_KEY) === '1'; } catch { return false; } };
const writeHidden = (v: boolean) => { try { localStorage.setItem(HIDE_KEY, v ? '1' : '0'); } catch { /* nothing remembered */ } };

const CSS = `
#placephotos{box-sizing:border-box;background:#fffffff2;border:1px solid #cfd6d0;border-radius:12px;padding:6px 8px;font:500 12px system-ui,sans-serif;color:#17201d;max-width:100%}
#placephotos.floating{position:fixed;right:16px;top:228px;z-index:6;width:210px;padding:4px 6px}
#placephotos.floating .pp-hint{display:none}
#placephotos.floating .pp-row{gap:4px}
#placephotos.floating .pp-item{flex:0 0 60px}
#placephotos.floating .pp-thumb{border-width:1px;border-radius:6px}
#placephotos.floating .pp-credit{font-size:9px;line-height:1.15}
#placephotos.floating .pp-head{margin-bottom:2px}
#placephotos .pp-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px}
#placephotos .pp-head b{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
#placephotos .pp-sw{font:600 11px system-ui,sans-serif;border:1px solid #b9c2bb;background:#fff;color:#17201d;border-radius:6px;padding:1px 7px;cursor:pointer}
#placephotos .pp-row{display:flex;gap:6px}
#placephotos .pp-item{flex:1 1 0;min-width:0;display:grid;gap:2px}
#placephotos .pp-thumb{padding:0;border:2px solid #17201d;border-radius:8px;background:#e9ece9;cursor:zoom-in;overflow:hidden;aspect-ratio:3/2;display:block}
#placephotos .pp-thumb:focus-visible{outline:3px solid #0f6b5c;outline-offset:2px}
#placephotos .pp-thumb img{width:100%;height:100%;object-fit:cover;display:block}
#placephotos .pp-credit{font-size:10px;line-height:1.2;color:#44504a;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word}
#placephotos .pp-hint{margin-top:4px;font-size:11px;color:#44504a}
#placephotos.hidden .pp-row,#placephotos.hidden .pp-hint{display:none}
#placephotos-view{position:fixed;inset:0;z-index:30;background:#000000d0;display:grid;place-items:center;padding:12px}
#placephotos-view figure{margin:0;display:grid;gap:8px;justify-items:center;max-width:96vw}
#placephotos-view img{max-width:94vw;max-height:68vh;border-radius:8px;background:#222;display:block}
#placephotos-view figcaption{max-width:min(900px,94vw);color:#fff;font:15px/1.4 system-ui,sans-serif;text-align:center}
#placephotos-view figcaption small{display:block;color:#d4dad6;font-size:12px;margin-top:4px}
#placephotos-view a{color:#9fe0d3}
#placephotos-view .pp-bar{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap}
#placephotos-view button{font:600 14px system-ui,sans-serif;border:1px solid #fff;background:#17201d;color:#fff;border-radius:8px;padding:6px 14px;cursor:pointer}
#placephotos-view button:focus-visible{outline:3px solid #9fe0d3;outline-offset:2px}
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, parent: HTMLElement | null, props: Partial<HTMLElementTagNameMap[K]> & { className?: string; text?: string } = {}): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  const { text, ...rest } = props as { text?: string };
  Object.assign(e, rest);
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}

export interface PhotosHandle { el: HTMLElement; destroy(): void; open(i: number): void; close(): void }

export function mountPlacePhotos(host: HTMLElement, d: PlacePhotos, opts: { floating?: boolean } = {}): PhotosHandle {
  if (!document.getElementById('placephotos-style')) { const s = el('style', document.head, { id: 'placephotos-style' }); s.textContent = CSS; }
  const root = el('aside', host, { id: 'placephotos', className: opts.floating === false ? 'inline' : 'floating' }); // inline: inside the map's side panel
  root.setAttribute('aria-label', `Real photos of ${d.name}`);
  let hidden = readHidden();
  const head = el('div', root, { className: 'pp-head' });
  el('b', head, { text: opts.floating === false ? `The real ${d.name}` : d.name, title: `Real photos of ${d.name}` });
  if (saysOn() && d.photos.some((p) => /^https:\/\//.test(p.file))) { const t = nameTag('street'); t.title = VOICES.street.poweredBy; head.append(t); } // CC-243: live street photos name their source
  const sw = el('button', head, { className: 'pp-sw', type: 'button' });
  const row = el('div', root, { className: 'pp-row' });
  const thumbs: HTMLButtonElement[] = [];
  d.photos.forEach((p, i) => {
    const item = el('div', row, { className: 'pp-item' });
    const b = el('button', item, { className: 'pp-thumb', type: 'button' });
    b.setAttribute('aria-label', `Open photo ${i + 1} of ${d.photos.length}: ${p.hint}`);
    b.title = p.hint;
    const img = el('img', b, { alt: p.hint, loading: 'lazy', decoding: 'async', src: srcOf(d, p) });
    img.width = p.width; img.height = p.height;
    b.onclick = () => open(i);
    thumbs.push(b);
    el('div', item, { className: 'pp-credit', text: `${p.author}, ${p.licence}`, title: captionFor(d, p) });
  });
  el('div', root, { className: 'pp-hint', text: d.note ?? 'Real photos of this place. Click one to see it large.' });
  if (d.status) el('div', root, { className: 'pp-hint pp-status', text: d.status }); // CC-90: whether photos follow the whole lane
  const paint = () => { root.classList.toggle('hidden', hidden); sw.textContent = hidden ? 'Show photos' : 'Hide'; sw.setAttribute('aria-pressed', String(hidden)); };
  sw.onclick = () => { hidden = !hidden; writeHidden(hidden); paint(); };
  paint();

  // the large view
  let view: HTMLElement | null = null, index = 0, opener: HTMLElement | null = null;
  const onKey = (e: KeyboardEvent) => {
    if (!view) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') show(index + 1);
    else if (e.key === 'ArrowLeft') show(index - 1);
    else if (e.key === 'Tab') return; // normal focus movement
    e.stopPropagation(); // the game does not run while the photo is open
  };
  function show(i: number) {
    if (!view) return;
    index = (i + d.photos.length) % d.photos.length;
    const p = d.photos[index];
    view.dataset.index = String(index);
    const img = view.querySelector('img')!; img.src = srcOf(d, p); img.alt = p.hint;
    view.querySelector('.pp-caption')!.textContent = captionFor(d, p);
    view.querySelector('.pp-where')!.textContent = `Where is this? ${p.hint}`;
    const credit = view.querySelector('.pp-licence')!; credit.textContent = '';
    credit.append(`Photo by ${p.author}, `);
    const l = el('a', null, { href: p.licenceUrl, text: p.licence, target: '_blank', rel: 'noopener noreferrer' }); credit.append(l, ', ');
    const s = el('a', null, { href: p.source, text: /mapillary\.com/.test(p.source) ? 'source on Mapillary' : 'source on Wikimedia Commons', target: '_blank', rel: 'noopener noreferrer' }); credit.append(s, `. ${p.changes}`);
    view.querySelector('.pp-count')!.textContent = `${index + 1} / ${d.photos.length}`;
  }
  function open(i: number) {
    if (view) return;
    opener = document.activeElement as HTMLElement | null;
    view = el('div', document.body, { id: 'placephotos-view' });
    view.setAttribute('role', 'dialog'); view.setAttribute('aria-modal', 'true'); view.setAttribute('aria-label', `Real photo of ${d.name}`);
    const fig = el('figure', view);
    el('img', fig, { alt: '' });
    const cap = el('figcaption', fig);
    el('strong', cap, { className: 'pp-caption' });
    el('small', cap, { className: 'pp-where' });
    el('small', cap, { className: 'pp-licence' });
    const bar = el('div', fig, { className: 'pp-bar' });
    el('button', bar, { type: 'button', text: '‹ Previous', id: 'pp-prev' }).onclick = () => show(index - 1);
    el('span', bar, { className: 'pp-count' }).style.color = '#fff';
    el('button', bar, { type: 'button', text: 'Next ›', id: 'pp-next' }).onclick = () => show(index + 1);
    const close_ = el('button', bar, { type: 'button', text: 'Close (Esc)', id: 'pp-close' }); close_.onclick = () => close();
    view.addEventListener('click', (e) => { if (e.target === view) close(); });
    show(i);
    document.addEventListener('keydown', onKey, true); // captured first, so the arrow keys never reach the game
    close_.focus();
  }
  function close() {
    if (!view) return;
    document.removeEventListener('keydown', onKey, true);
    view.remove(); view = null;
    (opener ?? thumbs[index])?.focus?.();
  }
  return { el: root, open, close, destroy() { close(); root.remove(); } };
}
