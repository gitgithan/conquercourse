// One list of worlds and one way to jump between them, shared by the Course and every other mode (CC-89).
// A value is a course path, or one of the words in WORD_VALUES, or empty for the stock course.
export type Demo = [string, string, string];
export const DEMO_GROUPS: [string, Demo[]][] = [
  ['Start here', [
    ['/assets/demo/training.course.json', 'Training course: every move', 'A gap jump, a vault, the lache bars, a rope, a climb, a trampoline and a rolled drop in one run. The best line is faster than the obvious one.'],
  ]],
  ['Real places', [
    ['/assets/experiments/osm/montmartre-paris.course.json', 'Montmartre, Paris', 'Real streets and roofs on a hill, cut at one level and shrunk to run on.'],
    ['/assets/experiments/osm/eixample-barcelona.course.json', 'Barcelona block', 'The Eixample grid: rooftops of a flat city block.'],
    ['/assets/experiments/osm/circular-quay-sydney.course.json', 'Sydney quay', 'Waterfront buildings at Circular Quay.'],
    ['/assets/experiments/osm/san-francisco-lombard.course.json', 'San Francisco hill (62 m of hill)', 'Lombard Street: the hill is real and so are the roofs.'],
    ['map', 'Slice a real place', 'Pick a real street, cut it at a height and turn its roofs into a course.'],
  ]],
  ['Real objects, built in the editor', [
    ['/assets/demo/park-run.course.json', 'Park run', 'Stairs, a skate box, two rails, a bench and a handrail in one line: vault, jump, repeat.'],
  ]],
  ['Contraptions', [
    ['/assets/demo/coaster-two-hills.course.json', 'Coaster: two hills (brake on the sharp one)', 'Height turns into speed: ride a gentle hill, then brake before a hilltop that bends away too fast.'],
    ['/assets/demo/launch-bar.course.json', 'Trebuchet: throw, then catch the bar', 'Sit in the sling and let go at the right moment; the throw falls short, so catch the bar and swing the rest.'],
    ['/assets/demo/band.course.json', 'Band: stretch it, turn round, be thrown', 'Run away to stretch the band, turn round and it throws you.'],
    ['/assets/demo/drone.course.json', 'Drone ferry: carried across a gap', 'A drone carries you over a gap you cannot jump.'],
    ['/assets/demo/cannon.course.json', 'Cannon: aim it, fire it, roll out of the landing', 'Aim the barrel up or down: the recoil pushes you forward and up.'],
    ['/assets/demo/stack.course.json', 'Stack demo: climb the cup pyramids', 'Sport-stacking cups as obstacles.'],
    ['/assets/demo/plank-two.course.json', 'Plank bridge: thick, then thin', 'A thick plank bends and holds; a thin one needs a post in the middle.'],
  ]],
  ['Make your own', [
    ['generate', 'Make me a new course (random)', 'A random course the simulator has proved clearable.'],
    ['editor', 'Build your own (editor)', 'Place real objects and bars; the simulator checks the lane.'],
    ['coaster-builder', 'Build your own coaster', 'Drag the dots of the track and ride it.'],
  ]],
  ['Labs (university level)', [
    ['lab-search', 'Lab 1: Search', 'Choose how the game looks for a clear run: greedy, beam, A* or everything. Mix a heuristic, set a budget, read the numbers.'],
  ]],
];

import { labsOn } from './labs';
import { applyStats, loadStats, statsOn } from './course-stats';
import { showWorldStats } from './world-stats';
import { pageQuery } from '../flags';

/** CC-201: the slicer card is always shown (it used to hide behind ?labs=1); ?slice2=old brings the old rule back. */
export const sliceCardOn = (params: URLSearchParams): boolean => params.get('slice2') !== 'old';

export const WORD_VALUES = ['generate', 'editor', 'coaster-builder', 'map', 'lab-search'];
export const DEMOS: [string, string][] = DEMO_GROUPS.flatMap(([, ds]) => ds.map((d) => [d[0], d[1]] as [string, string]));
export const DEMO_ABOUT = new Map<string, string>(DEMO_GROUPS.flatMap(([, ds]) => ds.map((d) => [d[0], d[2]] as [string, string])));

/** The picture file of a course card: public/assets/thumbs/<slug>.webp (made by npm run thumbs). */
export const thumbSlug = (value: string): string => (value === '' ? 'stock' : value.split('/').pop()!.replace(/\.course\.json$/, ''));
export const hasThumb = (value: string): boolean => !WORD_VALUES.includes(value);
export const thumbUrl = (value: string): string => `/assets/thumbs/${thumbSlug(value)}.webp`;

/** Where a choice leads. 'generate-same' reloads the current page (a generated course, kept by its seed). */
export function worldHref(value: string, loc?: { pathname: string; search: string }, seed: number = Math.floor(Math.random() * 1e6)): string {
  const suffix = '&welcome=0';
  if (value === 'editor') return `?mode=editor${suffix}`;
  if (value === 'coaster-builder') return `?mode=coaster${suffix}`;
  if (value === 'map') return `?mode=map${suffix}`;
  if (value === 'lab-search') return `?mode=lab-search&labs=1${suffix}`;
  if (value === 'generate') return `?generate=${seed}${suffix}`;
  if (value === 'generate-same') { const at = loc ?? location; return `${at.pathname}${at.search}${at.search.includes('?') ? '&' : '?'}welcome=0`; }
  return value ? `?course=${value}${suffix}` : `?welcome=0`;
}

/** Which card is the one you are in: a list value, 'generate-same' for a generated seed, 'stay' for a course outside the list, '' (stock), or null for modes that are not a world. */
export function currentWorld(params: URLSearchParams, courseName?: string): { value: string | null; label?: string } {
  const mode = params.get('mode') ?? 'course';
  if (mode === 'editor') return { value: 'editor' };
  if (mode === 'coaster') return { value: 'coaster-builder' };
  if (mode === 'map') return { value: 'map' };
  if (mode === 'lab-search') return { value: 'lab-search' };
  if (mode !== 'course') return { value: null };
  const seed = params.get('generate');
  if (seed !== null) return { value: 'generate-same', label: `Generated course (seed ${seed})` };
  const now = params.get('course') ?? '';
  if (params.has('coaster')) return { value: 'stay', label: courseName ?? 'My coaster' };
  if (DEMOS.some(([v]) => v === now)) return { value: now };
  return { value: 'stay', label: courseName ?? 'This course' };
}

const ICONS: Record<string, string> = {
  generate: '<rect x="14" y="14" width="36" height="36" rx="7"/><circle cx="25" cy="25" r="3"/><circle cx="39" cy="25" r="3"/><circle cx="32" cy="32" r="3"/><circle cx="25" cy="39" r="3"/><circle cx="39" cy="39" r="3"/>',
  editor: '<rect x="10" y="38" width="16" height="14" rx="2"/><rect x="26" y="26" width="16" height="26" rx="2"/><rect x="42" y="14" width="14" height="38" rx="2"/><path d="M8 54h50"/>',
  'coaster-builder': '<path d="M6 46C16 14 26 14 32 36s14 22 26-18"/><circle cx="6" cy="46" r="3"/><circle cx="32" cy="36" r="3"/><circle cx="58" cy="18" r="3"/>',
  'lab-search': '<circle cx="32" cy="12" r="4"/><circle cx="16" cy="34" r="4"/><circle cx="48" cy="34" r="4"/><circle cx="8" cy="54" r="3"/><circle cx="24" cy="54" r="3"/><circle cx="40" cy="54" r="3"/><circle cx="56" cy="54" r="3"/><path d="M30 16L18 30M34 16l12 14M14 38L9 51M18 38l5 13M46 38l-5 13M50 38l5 13"/>',
  map: '<path d="M32 56S14 38 14 26a18 18 0 0 1 36 0c0 12-18 30-18 30z"/><circle cx="32" cy="26" r="6"/>',
  stay: '<path d="M10 50h12V36h14V22h18"/><circle cx="54" cy="22" r="3"/>',
  'generate-same': '<rect x="14" y="14" width="36" height="36" rx="7"/><circle cx="25" cy="25" r="3"/><circle cx="39" cy="39" r="3"/><circle cx="32" cy="32" r="3"/>',
};
const iconSvg = (value: string): string => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[value] ?? ICONS.stay}</svg>`;

const STYLE = `
.wg{box-sizing:border-box;font:14px/1.35 system-ui,sans-serif;color:#17201d}
.wg *{box-sizing:border-box}
.wg-top{display:flex;gap:8px;align-items:center;margin:0 0 10px}
.wg-top h2{margin:0;font:800 20px system-ui,sans-serif;letter-spacing:-.02em;flex:0 0 auto}
.wg-search{flex:1 1 120px;min-width:0;font:600 15px system-ui,sans-serif;border:2px solid #17201d;border-radius:10px;padding:7px 10px;background:#fff;color:#17201d}
.wg-x{flex:0 0 auto;font:700 18px system-ui,sans-serif;border:2px solid #17201d;background:#fff;color:#17201d;border-radius:10px;padding:4px 12px;cursor:pointer}
.wg h3{margin:14px 0 6px;font:700 13px system-ui,sans-serif;text-transform:uppercase;letter-spacing:.06em;color:#58635d}
.wg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:10px}
.wg-card{display:grid;grid-template-rows:auto 1fr;text-align:left;padding:0;border:2px solid #d5d9d2;border-radius:12px;background:#fff;color:#17201d;cursor:pointer;overflow:hidden;font:inherit}
.wg-card:hover{border-color:#0f6b5c}
.wg-card:focus-visible{outline:3px solid #f0a020;outline-offset:1px}
.wg-card[aria-current=true]{border-color:#0f6b5c;box-shadow:0 0 0 3px #0f6b5c55}
.wg-pic{display:grid;place-items:center;aspect-ratio:16/9;background:#e3e9e4;color:#0f6b5c;overflow:hidden}
.wg-pic img{width:100%;height:100%;object-fit:cover;display:block}
.wg-pic svg{width:44%;height:70%}
.wg-txt{padding:6px 9px 8px}
.wg-txt b{display:block;font:700 14px/1.25 system-ui,sans-serif}
.wg-txt span{display:block;margin-top:2px;font:12px/1.3 system-ui,sans-serif;color:#58635d}
.wg-txt .wg-stats{display:flex;flex-wrap:wrap;gap:2px 8px;align-items:baseline;margin-top:3px;font:12px/1.3 system-ui,sans-serif;color:#17201d}
.wg-stats i{flex:0 0 100%;font-style:normal;font-weight:600;color:#0f6b5c}
.wg-stats em{font-style:normal;color:#58635d}
.wg-here{display:inline-block;margin-left:6px;font:700 10px system-ui,sans-serif;color:#fff;background:#0f6b5c;border-radius:6px;padding:1px 5px;vertical-align:1px}
.wg-none{padding:20px;color:#58635d}
#world-gallery{position:fixed;inset:0;z-index:900;display:grid;place-items:center;padding:12px;background:#10182099;backdrop-filter:blur(3px)}
#world-gallery .wg{width:min(1000px,100%);max-height:100%;overflow:auto;background:#fffdf7;border-radius:18px;padding:14px 16px 18px;box-shadow:0 24px 80px #0006}
#courses-btn{position:fixed;z-index:20;font:700 13px system-ui,sans-serif;border:2px solid #17201d;background:#fff;color:#17201d;border-radius:10px;padding:5px 12px;cursor:pointer}
@media (max-width:520px){#courses-btn.wg-low{top:auto!important;bottom:12px!important;left:12px!important;right:auto!important}.wg-grid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}#world-gallery{padding:0}#world-gallery .wg{border-radius:0;height:100%}}
`;
function injectStyle(): void {
  if (document.getElementById('wg-style')) return;
  const st = document.createElement('style'); st.id = 'wg-style'; st.textContent = STYLE; document.head.append(st);
}

export interface GalleryOptions {
  current: { value: string | null; label?: string };
  onPick: (value: string) => void;
  /** Called by the close button and Esc; leave out for a gallery that cannot be closed (the first-visit chooser). */
  onClose?: () => void;
  heading?: string;
}

/** The cards: a picture, a title and one line per world, under the group headings, with a search box and arrow-key movement. */
export function buildGallery(o: GalleryOptions): { el: HTMLElement; focusStart(): void } {
  injectStyle();
  const el = document.createElement('div'); el.className = 'wg';
  const top = document.createElement('div'); top.className = 'wg-top';
  const h = document.createElement('h2'); h.textContent = o.heading ?? 'Courses';
  const search = document.createElement('input');
  search.className = 'wg-search'; search.type = 'search'; search.id = 'gallery-search'; search.placeholder = 'Search the courses'; search.setAttribute('aria-label', 'Search the courses');
  top.append(h, search);
  if (o.onClose) { const x = document.createElement('button'); x.type = 'button'; x.className = 'wg-x'; x.textContent = '×'; x.title = 'Close (Esc)'; x.setAttribute('aria-label', 'Close'); x.onclick = o.onClose; top.append(x); }
  const body = document.createElement('div'); el.append(top, body);
  const cards: { card: HTMLButtonElement; sec: HTMLElement; text: string }[] = [];
  const addCard = (grid: HTMLElement, value: string, title: string, about: string, here: boolean): HTMLButtonElement => {
    const card = document.createElement('button');
    card.type = 'button'; card.className = 'wg-card'; card.dataset.value = value; card.title = about;
    if (here) card.setAttribute('aria-current', 'true');
    const pic = document.createElement('div'); pic.className = 'wg-pic';
    if (hasThumb(value) && value !== 'stay') { const img = new Image(); img.src = thumbUrl(value); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.onerror = () => { img.remove(); pic.innerHTML = iconSvg(value); }; pic.append(img); }
    else pic.innerHTML = iconSvg(value);
    const txt = document.createElement('div'); txt.className = 'wg-txt';
    const b = document.createElement('b'); b.textContent = title;
    if (here) { const t = document.createElement('i'); t.className = 'wg-here'; t.textContent = 'You are here'; t.style.fontStyle = 'normal'; b.append(t); }
    const s = document.createElement('span'); s.textContent = about;
    txt.append(b, s); card.append(pic, txt);
    card.onclick = () => o.onPick(value);
    grid.append(card);
    return card;
  };
  const section = (name: string): HTMLElement => {
    const sec = document.createElement('section'); sec.dataset.group = name;
    const h3 = document.createElement('h3'); h3.textContent = name;
    const grid = document.createElement('div'); grid.className = 'wg-grid';
    sec.append(h3, grid); body.append(sec); return grid;
  };
  const cur = o.current;
  if (cur.value === 'stay' || cur.value === 'generate-same') {
    const grid = section('This course');
    addCard(grid, cur.value, cur.label ?? 'This course', cur.value === 'stay' ? 'The course you are playing: it is not on the list.' : 'Play this same generated course again.', true);
    cards.push({ card: grid.lastElementChild as HTMLButtonElement, sec: grid.parentElement!, text: `${cur.label ?? ''} this course`.toLowerCase() });
  }
  for (const [group, ds] of DEMO_GROUPS) {
    const hiddenItem = (v: string): boolean => (v === 'map' ? !sliceCardOn(pageQuery()) && cur.value !== v && !labsOn() : v === 'lab-search' && cur.value !== v && !labsOn());
    if (ds.every(([v]) => hiddenItem(v))) continue; // a group whose items are all switched off shows no heading
    const grid = section(group);
    for (const [v, label, about] of ds) {
      if (hiddenItem(v)) continue; // CC-78: the map and the Labs are behind the labs switch (?labs=1)
      cards.push({ card: addCard(grid, v, label, about, cur.value === v), sec: grid.parentElement!, text: `${label} ${about} ${group}`.toLowerCase() });
    }
  }
  const none = document.createElement('div'); none.className = 'wg-none'; none.textContent = 'No course matches that. Try another word.'; none.hidden = true; body.append(none);
  const visible = (): HTMLButtonElement[] => cards.filter((c) => !c.card.hidden && !c.sec.hidden).map((c) => c.card);
  const filter = () => {
    const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
    for (const c of cards) c.card.hidden = !words.every((w) => c.text.includes(w));
    for (const sec of new Set(cards.map((c) => c.sec))) sec.hidden = !cards.some((c) => c.sec === sec && !c.card.hidden);
    none.hidden = visible().length > 0;
  };
  search.addEventListener('input', filter);
  el.addEventListener('keydown', (e) => {
    e.stopPropagation(); // a key typed in the gallery is never also a key for the game behind it
    if (e.key === 'Escape' && o.onClose) { e.preventDefault(); o.onClose(); return; }
    const list = visible();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    if (document.activeElement === search) {
      if ((e.key === 'ArrowDown' || e.key === 'Enter') && list.length) { e.preventDefault(); list[0].focus(); }
      return;
    }
    if (at < 0) return;
    const r = list[at].getBoundingClientRect(), cx = r.left + r.width / 2;
    let next: HTMLButtonElement | undefined;
    if (e.key === 'ArrowRight') next = list[at + 1];
    else if (e.key === 'ArrowLeft') next = at === 0 ? undefined : list[at - 1];
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const down = e.key === 'ArrowDown';
      const rows = list.filter((c) => { const b = c.getBoundingClientRect(); return down ? b.top > r.bottom - 4 : b.bottom < r.top + 4; });
      if (rows.length) {
        const edge = down ? Math.min(...rows.map((c) => c.getBoundingClientRect().top)) : Math.max(...rows.map((c) => c.getBoundingClientRect().top));
        const row = rows.filter((c) => Math.abs(c.getBoundingClientRect().top - edge) < 4);
        next = row.reduce((best, c) => { const b = c.getBoundingClientRect(); const bb = best.getBoundingClientRect(); return Math.abs(b.left + b.width / 2 - cx) < Math.abs(bb.left + bb.width / 2 - cx) ? c : best; });
      } else if (!down) next = undefined, search.focus();
    } else return;
    if (next) { e.preventDefault(); next.focus(); next.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') e.preventDefault();
  });
  // CC-149: the play numbers and the difficulty order arrive a moment later, so the cards never wait for the server; ?stats=0 leaves them out
  if (statsOn(pageQuery())) { const wl = document.createElement('div'); wl.id = 'world-stats'; wl.style.cssText = 'font-size:.85em;opacity:.85;margin:.3em 0'; el.prepend(wl); showWorldStats(wl); } // CC-108
  if (statsOn(pageQuery())) void loadStats().then((d) => { if (d && el.isConnected !== false) applyStats(el, d); });
  return { el, focusStart: () => { const here = el.querySelector<HTMLElement>('.wg-card[aria-current=true]'); (here ?? search).focus({ preventScroll: false }); here?.scrollIntoView({ block: 'center' }); } };
}

/** While a gallery is open no key reaches the game or editor behind it (keys typed inside the gallery are handled there). Call once, before any mode starts. */
export function installGalleryKeyGuard(): void {
  const guard = (e: KeyboardEvent) => {
    const modal = document.querySelector('[data-cc-modal]');
    if (modal && !modal.contains(e.target as Node)) e.stopImmediatePropagation();
  };
  window.addEventListener('keydown', guard, true); // only keydown: a key released after the gallery opened still lets go
}

/** What the gallery asks before leaving an editor with work not yet saved (plain words for a young reader). */
export const LEAVE_MESSAGE = 'You have changes you have not saved. Leave and lose them?';

/** True when the gallery may jump to another course. The editor sets window.ccHasUnsavedChanges when it starts; other modes set nothing and never ask. */
export function mayLeaveCourse(ask: (msg: string) => boolean = window.confirm.bind(window)): boolean {
  const unsaved = (window as unknown as { ccHasUnsavedChanges?: () => boolean }).ccHasUnsavedChanges;
  if (typeof unsaved !== 'function') return true;
  try { return unsaved() ? ask(LEAVE_MESSAGE) : true; }
  catch { return true; }
}

/** Tells the Course to wait while a gallery is open. */
export const GALLERY_EVENT = 'cc-gallery';

/** The first-visit chooser and the "Courses" overlay both go through here: the gallery as a modal. */
export function modalAttrs(el: HTMLElement): void { el.dataset.ccModal = '1'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); }

/** A small "Courses" button in a corner that opens the gallery. place: css for the button's position. */
export function mountWorldGallery(parent: HTMLElement, o: { current: { value: string | null; label?: string }; place: string; onPick?: (value: string) => void }): { button: HTMLButtonElement; open(): void; close(): void } {
  injectStyle();
  const button = document.createElement('button');
  button.id = 'courses-btn'; button.type = 'button'; button.textContent = 'Courses'; button.title = 'Pick another course (the gallery)'; button.setAttribute('aria-haspopup', 'dialog');
  button.style.cssText = o.place; button.classList.add('wg-low'); // on a phone it sits bottom left instead (the Feedback button is bottom right)
  let overlay: HTMLElement | null = null;
  const close = () => {
    if (!overlay) return;
    overlay.remove(); overlay = null;
    window.dispatchEvent(new CustomEvent(GALLERY_EVENT, { detail: { open: false } }));
    button.focus({ preventScroll: true });
  };
  const open = () => {
    if (overlay) return;
    overlay = document.createElement('div'); overlay.id = 'world-gallery'; modalAttrs(overlay); overlay.setAttribute('aria-label', 'Courses');
    const g = buildGallery({
      current: o.current, onClose: close,
      onPick: (v) => { if (v === 'stay' || v === o.current.value) { close(); return; } if (!mayLeaveCourse()) return; (o.onPick ?? ((w) => { location.href = worldHref(w); }))(v); },
    });
    overlay.append(g.el);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    parent.append(overlay);
    window.dispatchEvent(new CustomEvent(GALLERY_EVENT, { detail: { open: true } }));
    g.focusStart();
  };
  button.onclick = open;
  parent.append(button);
  return { button, open, close };
}

/** Where the button sits in each mode, chosen so it covers no control there (scripts/picker-check.mjs checks every one at 1280x720 and 1024x640). */
export const BUTTON_PLACE: Record<string, string> = {
  course: 'right:16px;top:196px',
  dojo: 'right:330px;top:12px', // left of the Back button
  editor: 'right:60px;top:8px', // left of the top bar's More (⋯) menu
};
export const DEFAULT_PLACE = 'right:12px;top:8px'; // the top right corner is empty in the editor, the map, the coaster builder and the park
