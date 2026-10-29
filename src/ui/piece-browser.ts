// The add browser (CC-96): a featured view of the piece under the mouse (a big picture, what it does, where it came from) above a grid of small picture cards.
// Mouse over, keyboard focus or a tap on a card changes the featured view; a click adds the piece by pressing the editor's own add button, so nothing else changes.
import { SECTION_NAME, SECTION_ORDER, STATIC_PIECES, realInfo, type PieceInfo, type Section } from '../slice/piece-info';

export const PIECE_BROWSER_CSS = `
  .ed .addmenu.open{display:block}
  .ed .addmenu{position:fixed;left:12px;top:58px;width:min(760px,calc(100vw - 24px));max-height:calc(100vh - 70px);padding:0;overflow:hidden}
  .ed .addmenu>:not(.pb){display:none!important}
  .ed .pb{display:flex;flex-direction:column;max-height:calc(100vh - 80px)}
  .ed .pb-feature{display:grid;grid-template-columns:minmax(0,320px) minmax(0,1fr);gap:16px;padding:14px;background:var(--soft);border-bottom:1px solid var(--line)}
  .ed .pb-feature img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:10px;background:#e6ede9;display:block}
  .ed .pb-feature h3{margin:0 0 6px;font:700 18px system-ui,sans-serif}
  .ed .pb-feature p{margin:0 0 8px;font:14px/1.4 system-ui,sans-serif}
  .ed .pb-feature .from{color:var(--muted);font-size:13px}
  .ed .pb-feature .hint{color:var(--muted);font-size:12px}
  .ed .pb-bar{display:flex;gap:6px;align-items:center;padding:10px 14px 0;flex-wrap:wrap}
  .ed .pb-tab{min-width:0!important;min-height:30px;padding:3px 12px;border-radius:999px}
  .ed .pb-tab[aria-selected=true]{background:var(--teal,#0f6b5c);color:#fff;border-color:transparent}
  .ed .pb-search{margin-left:auto;min-width:150px;max-width:220px;padding:5px 10px;border:1px solid var(--line);border-radius:8px;font:14px system-ui,sans-serif}
  .ed .pb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:8px;padding:12px 14px 14px;overflow:auto;min-height:110px}
  .ed .pb-card{display:flex;flex-direction:column;gap:4px;align-items:stretch;padding:4px;border:2px solid transparent;border-radius:10px;background:#fff;cursor:pointer;text-align:center;min-width:0!important;white-space:normal!important}
  .ed .pb-card img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:7px;background:#e6ede9;display:block}
  .ed .pb-card span{font:600 12.5px/1.2 system-ui,sans-serif;padding:0 2px 2px}
  .ed .pb-card:hover,.ed .pb-card:focus-visible,.ed .pb-card.on{border-color:var(--teal,#0f6b5c);background:#eaf4f0;outline:none}
  .ed .pb-none{padding:18px;color:var(--muted)}
  @media (max-width:760px){.ed .pb-feature{grid-template-columns:1fr}}`;

export function mountPieceBrowser(menu: HTMLElement): void {
  const h = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {}) => { const { class: c, ...rest } = props as Record<string, unknown> & { class?: string }; const e = Object.assign(document.createElement(tag), rest) as HTMLElementTagNameMap[K]; if (c) e.className = c; return e; };
  const root = h('div', { class: 'pb', id: 'piecebrowser' });
  const feature = h('div', { class: 'pb-feature' }), fImg = h('img'), fText = h('div');
  fImg.alt = ''; feature.append(fImg, fText);
  const bar = h('div', { class: 'pb-bar' }), tabs = h('div', { class: 'pb-tabs' }); tabs.setAttribute('role', 'tablist'); tabs.style.display = 'contents';
  const search = h('input', { class: 'pb-search', type: 'search', placeholder: 'Search pieces', id: 'piecesearch' }); search.setAttribute('aria-label', 'Search pieces');
  const grid = h('div', { class: 'pb-grid', id: 'piecegrid' });
  bar.append(tabs, search); root.append(feature, bar, grid); menu.prepend(root);

  let pieces: PieceInfo[] = [...STATIC_PIECES], section: Section = 'ground', shown = pieces[0];
  const tabBtn = new Map<Section, HTMLButtonElement>();
  const feat = (p: PieceInfo) => {
    shown = p; fImg.src = `/assets/pieces/${p.id}-large.webp`; fImg.alt = p.name;
    fText.replaceChildren(h('h3', { textContent: p.name }), h('p', { textContent: p.does }), h('p', { class: 'from', textContent: p.from }), h('p', { class: 'hint', textContent: 'Click the picture card to add it to the world.' }));
    for (const c of grid.querySelectorAll<HTMLElement>('.pb-card')) c.classList.toggle('on', c.dataset.piece === p.id);
  };
  const press = (p: PieceInfo) => { const b = menu.querySelector<HTMLElement>(p.button); if (p.id === 'photo') { (window as unknown as { ccPickPhoto?: () => void }).ccPickPhoto?.(); return; } b?.click(); };
  const paint = () => {
    const q = search.value.trim().toLowerCase();
    const list = pieces.filter((p) => (q ? `${p.name} ${p.does} ${SECTION_NAME[p.section]}`.toLowerCase().includes(q) : p.section === section));
    grid.replaceChildren(...list.map((p) => {
      const c = h('button', { class: 'pb-card', type: 'button' }); c.dataset.piece = p.id; c.title = p.name;
      const img = h('img', { src: `/assets/pieces/${p.id}.webp`, alt: '' }); img.loading = 'lazy'; img.onerror = () => { img.style.visibility = 'hidden'; };
      c.append(img, h('span', { textContent: p.name }));
      c.onmouseenter = c.onfocus = () => feat(p);
      c.onclick = () => press(p);
      return c;
    }));
    if (!list.length) grid.append(h('div', { class: 'pb-none', textContent: 'Nothing matches. Try another word.' }));
    else if (!list.includes(shown)) feat(list[0]); else feat(shown);
    for (const [s, b] of tabBtn) b.setAttribute('aria-selected', String(!q && s === section));
  };
  for (const s of SECTION_ORDER) {
    const b = h('button', { class: 'pb-tab', type: 'button', textContent: SECTION_NAME[s] }); b.setAttribute('role', 'tab'); b.id = `pbtab-${s}`;
    const go = () => { section = s; search.value = ''; paint(); };
    b.onclick = go; b.onmouseenter = go; // pointing at a section shows its pieces
    b.onkeydown = (e) => { const i = SECTION_ORDER.indexOf(s), k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (k) { tabBtn.get(SECTION_ORDER[(i + k + SECTION_ORDER.length) % SECTION_ORDER.length])?.focus(); e.preventDefault(); } };
    tabBtn.set(s, b); tabs.append(b);
  }
  search.oninput = paint;
  grid.onkeydown = (e) => { // arrows move between cards
    const cards = [...grid.querySelectorAll<HTMLElement>('.pb-card')], i = cards.indexOf(document.activeElement as HTMLElement);
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (d && i >= 0) { cards[(i + d + cards.length) % cards.length].focus(); e.preventDefault(); }
  };
  paint();
  // the real objects from photos arrive from the object list: their words come from piece-info, the credit from the index
  void fetch('/assets/objects/index.json').then((r) => r.json()).then((idx: { objects: { name: string; label: string; author: string; licence: string }[] }) => {
    pieces = [...STATIC_PIECES.filter((p) => p.section !== 'tools'), ...idx.objects.map(realInfo), ...STATIC_PIECES.filter((p) => p.section === 'tools')];
    paint();
  }).catch(() => { /* no objects on this site */ });
}
