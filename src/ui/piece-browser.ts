// The add browser (CC-96): a featured view of the piece under the mouse (a big picture, what it does, where it came from) above a grid of small picture cards.
// Mouse over, keyboard focus or a tap on a card changes the featured view; a click adds the piece by pressing the editor's own add button, so nothing else changes.
import { MOVE_EMPTY, MOVE_NAME, MOVE_ORDER, SECTION_NAME, SECTION_ORDER, STATIC_PIECES, realInfo, type PieceInfo, type Section } from '../slice/piece-info';
import { pageQuery } from '../flags';

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
  .ed .pb-grid{display:grid;grid-auto-rows:max-content;align-content:start;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:8px;padding:12px 14px 14px;overflow:auto;min-height:110px}
  .ed .pb-card{display:flex;flex-direction:column;gap:4px;align-items:stretch;padding:4px;border:2px solid transparent;border-radius:10px;background:#fff;cursor:pointer;text-align:center;min-width:0!important;white-space:normal!important}
  .ed .pb-card img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:7px;background:#e6ede9;display:block}
  .ed .pb-card span{font:600 12.5px/1.2 system-ui,sans-serif;padding:0 2px 2px}
  .ed .pb-card:hover,.ed .pb-card:focus-visible,.ed .pb-card.on{border-color:var(--teal,#0f6b5c);background:#eaf4f0;outline:none}
  .ed .pb-group{grid-column:1/-1;margin:6px 2px 0;font:700 13px system-ui,sans-serif;color:var(--teal,#0f6b5c);border-bottom:1px solid var(--line)}
  .ed .pb-group-none{grid-column:1/-1;margin:0 2px;font:13px system-ui,sans-serif;color:var(--muted)}
  .ed .pb-view{min-width:0!important;min-height:30px;padding:3px 12px;border-radius:999px}
  .ed .pb-none{padding:18px;color:var(--muted)}
  .ed .pb-mine{display:flex;flex-direction:column;align-items:center;justify-content:center;aspect-ratio:16/9;border-radius:7px;background:#e7f3ef;font-size:26px}
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

  // one switch for the by-move view: on by default, the button flips it, and ?bymove=0 starts with it off
  let byMove = (() => { try { return pageQuery().get('bymove') !== '0' && localStorage.getItem('cc-pb-bymove') !== '0'; } catch { return true; } })();
  const viewBtn = h('button', { class: 'pb-view', type: 'button', id: 'pbbymove' });
  viewBtn.onclick = () => { byMove = !byMove; try { localStorage.setItem('cc-pb-bymove', byMove ? '1' : '0'); } catch { /* no storage */ } paint(); };
  bar.insertBefore(viewBtn, search);
  let pieces: PieceInfo[] = [...STATIC_PIECES], section: Section = 'ground', shown = pieces[0];
  const tabBtn = new Map<Section, HTMLButtonElement>();
  const feat = (p: PieceInfo) => {
    shown = p; fImg.style.visibility = isMine(p) ? 'hidden' : ''; fImg.src = isMine(p) ? '' : `/assets/pieces/${p.id}-large.webp`; fImg.alt = p.name;
    fText.replaceChildren(h('h3', { textContent: p.name }), h('p', { textContent: p.does }), h('p', { class: 'from', textContent: p.from }), h('p', { class: 'hint', textContent: 'Click the picture card to add it to the world.' }));
    for (const c of grid.querySelectorAll<HTMLElement>('.pb-card')) c.classList.toggle('on', c.dataset.piece === p.id);
  };
  // pieces you made from your own photos (CC-247): the editor keeps one hidden button for each; they get cards in a group at the very top, whatever tab is open
  const mineOf = (): PieceInfo[] => [...menu.querySelectorAll<HTMLElement>('[data-from-photo]')].map((b) => ({ id: `mine-${b.dataset.object}`, section: 'real' as Section, name: (b.textContent ?? '').replace(/^\W*Mine:\s*/, '') || 'My piece', does: 'A 3D piece you made from your own photo. Click the card to add it to the world.', from: 'From your own photo', button: `[data-from-photo][data-object="${b.dataset.object}"]` }));
  const sharedOf = (): PieceInfo[] => [...menu.querySelectorAll<HTMLElement>('[data-shared-piece]')].map((b) => ({ id: `shared-${b.dataset.sharedPiece}`, section: 'real' as Section, name: (b.textContent ?? '').replace(/^\W*Shared:\s*/, '') || 'Shared piece', does: 'A 3D piece another player shared. Click the card to add it to the world.', from: 'Shared by a player', button: `[data-shared-piece="${b.dataset.sharedPiece}"]` }));
  const isMine = (p: PieceInfo) => p.id.startsWith('mine-') || p.id.startsWith('shared-');
  const press = (p: PieceInfo) => { const b = menu.querySelector<HTMLElement>(p.button); if (p.id === 'photo') { (window as unknown as { ccPickPhoto?: () => void }).ccPickPhoto?.(); return; } b?.click(); };
  const paint = () => {
    const q = search.value.trim().toLowerCase();
    const mine = mineOf().filter((p) => !q || p.name.toLowerCase().includes(q) || 'my pieces'.includes(q));
    const list = pieces.filter((p) => (q ? `${p.name} ${p.does} ${SECTION_NAME[p.section]}`.toLowerCase().includes(q) : p.section === section));
    const card = (p: PieceInfo) => {
      const c = h('button', { class: 'pb-card', type: 'button' }); c.dataset.piece = p.id; c.title = p.name;
      if (isMine(p)) c.append(h('div', { class: 'pb-mine', textContent: p.id.startsWith('shared-') ? '🌐' : '📷' }), h('span', { textContent: p.name }));
      else { const img = h('img', { src: `/assets/pieces/${p.id}.webp`, alt: '' }); img.loading = 'lazy'; img.onerror = () => { img.style.visibility = 'hidden'; }; c.append(img, h('span', { textContent: p.name })); }
      c.onmouseenter = c.onfocus = () => feat(p);
      c.onclick = () => press(p);
      return c;
    };
    // the Real objects tab can group its pieces by the move that gets past them (CC-110); the cards stay in the same order for the arrow keys
    const grouped = !q && section === 'real' && byMove;
    viewBtn.style.display = !q && section === 'real' ? '' : 'none';
    viewBtn.textContent = byMove ? 'Show all together' : 'Group by move';
    const sharedP = sharedOf().filter((p) => !q || p.name.toLowerCase().includes(q) || 'shared pieces'.includes(q));
    const mineCards: HTMLElement[] = [...(mine.length ? [h('div', { class: 'pb-group', textContent: 'My pieces', id: 'pb-mine' }), ...mine.map(card)] : []), ...(sharedP.length ? [h('div', { class: 'pb-group', textContent: 'Shared pieces', id: 'pb-shared' }), ...sharedP.map(card)] : [])];
    if (grouped) {
      const cards: HTMLElement[] = [], ordered: PieceInfo[] = [];
      for (const m of MOVE_ORDER) {
        const mine = list.filter((p) => p.move === m);
        const head = h('div', { class: 'pb-group', textContent: MOVE_NAME[m] }); head.dataset.move = m;
        cards.push(head);
        if (mine.length) { cards.push(...mine.map(card)); ordered.push(...mine); } else cards.push(h('div', { class: 'pb-group-none', textContent: MOVE_EMPTY[m] }));
      }
      const rest = list.filter((p) => !p.move);
      if (rest.length) { cards.push(h('div', { class: 'pb-group', textContent: 'Other' }), ...rest.map(card)); ordered.push(...rest); }
      grid.replaceChildren(...mineCards, ...cards);
      list.splice(0, list.length, ...ordered);
    } else grid.replaceChildren(...mineCards, ...list.map(card));
    list.unshift(...mine, ...sharedP);
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
  let mineCount = 0;
  new MutationObserver(() => { const n = mineOf().length * 1000 + sharedOf().length; if (n !== mineCount) { mineCount = n; paint(); } }).observe(menu, { childList: true });
  paint();
  // the real objects from photos arrive from the object list: their words come from piece-info, the credit from the index
  void fetch('/assets/objects/index.json').then((r) => r.json()).then((idx: { objects: { name: string; label: string; author: string; licence: string }[] }) => {
    pieces = [...STATIC_PIECES.filter((p) => p.section !== 'tools'), ...idx.objects.map(realInfo), ...STATIC_PIECES.filter((p) => p.section === 'tools')];
    paint();
  }).catch(() => { /* no objects on this site */ });
}
