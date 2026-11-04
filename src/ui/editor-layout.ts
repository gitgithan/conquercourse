// CC-94: the World editor's controls, organised. One top bar read left to right (course, add a piece, undo and redo, view, moves, design partner, more),
// every "add a piece" button in one menu, rare actions in one more-menu, the Moves and Design partner cards docked in one place (one open at a time),
// and a command palette (/ or Ctrl+K) that finds any action by name. The buttons themselves (and their ids) are the editor's own: this only moves them.

import { PIECE_BROWSER_CSS, mountPieceBrowser } from './piece-browser';

const CSS = `
  .ed{--ink:#17201d;--muted:#58635d;--line:#cfd6d0;--brand:#0f6b5c;--soft:#f3f7f4;--card:#fff;--r:10px;grid-template-rows:auto minmax(0,1fr)}
  .ed .top{flex-wrap:nowrap;gap:8px;min-height:40px;position:relative;z-index:30}
  .ed .top h1{font-size:16px;white-space:nowrap;margin:0 4px 0 0}
  .ed .top .sp{flex:1 1 0;min-width:0}
  .ed .top button,.ed .top a.btn{white-space:nowrap;min-height:32px;display:inline-flex;align-items:center;gap:6px;flex:0 0 auto}
  .ed button:hover:not(:disabled):not([aria-pressed=true]),.ed a.btn:hover{background:var(--soft)}.ed .go:hover:not(:disabled){background:#0b5a4d}
  .ed button:disabled{opacity:.5;cursor:default}
  .ed button:focus-visible,.ed a.btn:focus-visible,.ed select:focus-visible,.ed input:focus-visible,.ed textarea:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
  .ed .seg{display:inline-flex;flex:0 0 auto}.ed .seg button{border-radius:0}.ed .seg button:first-child{border-radius:8px 0 0 8px}.ed .seg button:last-child{border-radius:0 8px 8px 0;margin-left:-1px}
  .ed .menuwrap{position:relative;flex:0 0 auto}
  .ed .addmenu,.ed .overflow{display:none;position:absolute;top:calc(100% + 6px);z-index:40;background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 10px 30px #0003;padding:12px;box-sizing:border-box}
  .ed .addmenu.open,.ed .overflow.open{display:flex}
  .ed .addmenu{left:0;width:min(640px,calc(100vw - 24px));max-height:calc(100vh - 72px);overflow:auto;flex-wrap:wrap;gap:6px;align-content:flex-start}
  .ed .addmenu strong{flex:0 0 100%;margin-top:8px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}.ed .addmenu strong:first-child{margin-top:0}
  .ed .addmenu button{min-width:88px;min-height:32px;white-space:nowrap}
  .ed .aside{grid-template-rows:none;grid-auto-rows:min-content;overflow-x:hidden;overflow-y:auto;scrollbar-width:thin}
  .ed .aside>.panel:last-child{order:-2}.ed .aside>.mach{order:-1}
  .ed .mach{display:none}.ed .mach.on{display:grid}.ed .mach label{display:flex;justify-content:space-between;align-items:center;gap:8px}.ed .mach input[type=number]{width:88px}.ed .mach span{display:grid;gap:5px}
  .ed .overflow{right:0;flex-direction:column;gap:2px;min-width:250px}
  .ed .overflow button{text-align:left;white-space:nowrap;border-color:transparent;background:transparent;min-height:34px;display:flex;justify-content:space-between;gap:16px}
  .ed .overflow button:hover{background:var(--soft)}.ed .overflow kbd,.ed #palette kbd{font:12px ui-monospace,monospace;color:var(--muted);background:#eef1ec;border-radius:5px;padding:1px 6px}
  .ed .moves,.ed .helper{position:absolute;right:10px;bottom:10px;left:auto;top:auto;width:min(400px,calc(100% - 20px));z-index:20}
  .ed .moves{max-height:calc(100% - 20px);padding:0;gap:0;overflow:auto}
  :root[data-dock=both] .ed .moves{left:10px;right:auto;top:10px;bottom:10px;max-height:none}
  .ed .helper{top:var(--partner-top,auto);height:auto;max-height:none}
  :root[data-dock=both] .ed .helper{height:auto}
  .ed .moves>.row:first-child{position:sticky;top:0;z-index:1;background:var(--card);padding:9px 12px;border-bottom:1px solid var(--line);justify-content:space-between;flex-wrap:nowrap}
  .ed .moves .mv{display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:2px 10px;align-items:start;padding:9px 12px;border-bottom:1px solid #eef1ec}
  .ed .moves .mvicon{grid-row:1/span 2;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:700;background:#eef1ec;color:var(--muted)}
  .ed .moves .mvicon.yes{background:#dff1ea;color:var(--brand)}.ed .moves .mvicon.no{background:#fdf1d8;color:#8a5a00}
  .ed .moves .mvtext{grid-column:2;font-size:13px;line-height:1.35}
  .ed .moves .mv .need{grid-column:2;grid-row:2;font-size:12px;color:var(--muted)}
  .ed .moves .mv button,.ed .moves .mv a.btn{grid-column:3;grid-row:1/span 2;align-self:center;white-space:nowrap;min-width:104px;text-align:center}
  .ed .moves .sg{padding:9px 12px;display:grid;gap:6px;border-bottom:1px solid #eef1ec}
  .ed .moves>strong{margin:10px 12px 2px}.ed .moves>button{margin:8px 12px;white-space:nowrap}.ed .moves>.muted{margin:0 12px}
  .ed .panel button{min-height:30px}
  #palette{position:fixed;inset:0;z-index:60;display:none;place-items:start center;padding-top:12vh;background:#10182080}#palette.open{display:grid}
  #palette .card{width:min(560px,92vw);background:#fff;color:#17201d;border-radius:14px;box-shadow:0 24px 80px #0006;overflow:hidden;font:14px/1.35 system-ui,sans-serif}
  #palette input{width:100%;box-sizing:border-box;border:0;border-bottom:1px solid #cfd6d0;padding:14px 16px;font:16px system-ui,sans-serif;outline:none}
  #palette .list{max-height:50vh;overflow:auto;padding:6px}
  #palette .pitem{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:12px;align-items:center;padding:8px 10px;border-radius:8px;cursor:pointer}
  #palette .pitem[aria-selected=true]{background:#e6f1ed}#palette .pitem .sec{color:#58635d;font-size:12px}
  #palette .none{padding:14px;color:#58635d}`+PIECE_BROWSER_CSS+`
  .ed #personchip{position:absolute;left:10px;bottom:10px;z-index:6;display:flex;gap:6px}
  .ed #personchip button{min-height:30px;padding:3px 12px;border-radius:999px;box-shadow:0 2px 8px #0003}
  .ed #personfind[aria-pressed=true]{background:#fff3c4;border-color:#e0a800;color:#17201d}`;

const SHORTCUTS: Record<string, string> = { undo: 'Ctrl+Z', redo: 'Ctrl+Y', del: 'Del', dup: 'D' };

export function organizeEditor(root: HTMLElement): void {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const q = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T | null;
  const top = q<HTMLElement>('.top'), addBar = q<HTMLElement>('.top ~ .top');
  if (!top || !addBar || addBar === top) return;
  const mk = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}) => Object.assign(document.createElement(tag), props) as HTMLElementTagNameMap[K];
  const title = q<HTMLElement>('.top h1'), back = q<HTMLElement>('#backcourse'), undo = q<HTMLElement>('#undo'), redo = q<HTMLElement>('#redo'), view = q<HTMLElement>('#viewmode');
  const movesBtn = q<HTMLElement>('#movesbtn'), partnerBtn = q<HTMLElement>('#helperbtn'), reset = q<HTMLElement>('#resetworld');
  const strays = [...top.children].filter((c) => ![title, back, undo, redo, view, partnerBtn, reset].includes(c as HTMLElement)); // for example a Courses button added by another module: it stays in the bar, after the course link

  // the add menu: the editor's whole row of "add" buttons, as one popover with headings
  const addWrap = mk('div', { className: 'menuwrap' });
  const addBtn = mk('button', { id: 'addpiece', textContent: 'Add piece ▾', title: 'Add a shape, a real object, a bar, a machine or a stack to the world' });
  addBtn.setAttribute('aria-haspopup', 'true'); addBtn.setAttribute('aria-expanded', 'false');
  addBar.className = 'addmenu'; addBar.id = 'addmenu';
  addWrap.append(addBtn, addBar);
  const heads: Record<string, string> = { 'Basic shapes:': 'Basic shapes', 'From real photos:': 'Real objects', 'Overhead:': 'Overhead bars', 'Stacks:': 'Cup stacks', 'Size references:': 'Size references' };
  addBar.querySelectorAll('strong').forEach((s) => { const t = s.textContent ?? ''; if (heads[t]) s.textContent = heads[t]; });
  // the machines (trebuchet, cannon, band, drone, plank) were listed under "Overhead:": they get their own heading, and the plank joins them
  const treb = addBar.querySelector('#addtreb'), stacksHead = [...addBar.querySelectorAll('strong')].find((h) => h.textContent === 'Cup stacks'), plank = addBar.querySelector('#addplank');
  if (treb) treb.before(mk('strong', { textContent: 'Machines' }));
  if (plank && stacksHead) stacksHead.before(plank);
  // the real-photo objects arrive after a fetch, at the end of the row: file them under their own heading, second after the basic shapes
  const filePhotos = () => {
    const h = [...addBar.querySelectorAll('strong')].find((x) => x.textContent === 'From real photos:');
    if (!h) return;
    h.textContent = 'Real objects';
    const anchor = [...addBar.querySelectorAll('strong')].find((x) => x.textContent === 'Overhead bars');
    const nodes: Node[] = []; for (let n: Node | null = h; n; n = n.nextSibling) nodes.push(n);
    if (anchor) for (const n of nodes) anchor.before(n);
  };
  filePhotos();
  new MutationObserver(filePhotos).observe(addBar, { childList: true });
  mountPieceBrowser(addBar); // CC-96: the picture grid and the featured view replace the old list of buttons (the buttons stay, hidden, and are pressed by the cards)

  // the machines' knobs (counterweight, ball, band, drone) stay on screen after the menu closes: a small panel above the lane, shown only while a machine is in the world
  const holder = (id: string): HTMLElement | null => { const l = addBar.querySelector(id)?.closest('label'); return l ? ((l.parentElement !== addBar ? l.parentElement : l) as HTMLElement) : null; };
  const knobs = ['#trebkg', '#recoilkg', '#bandk', '#dronekg'].map(holder).filter((h, i, a2) => h && a2.indexOf(h) === i) as HTMLElement[];
  const mach = mk('div', { className: 'panel mach', id: 'machinepanel' });
  mach.append(mk('strong', { textContent: 'Machine settings' }), ...knobs);
  q<HTMLElement>('.aside')?.children[0]?.after(mach);
  const showMach = () => mach.classList.toggle('on', knobs.some((k) => k.style.display !== 'none'));
  for (const k of knobs) new MutationObserver(showMach).observe(k, { attributes: true, attributeFilter: ['style'] });
  showMach();

  // the more menu: rare actions
  const moreWrap = mk('div', { className: 'menuwrap' });
  const moreBtn = mk('button', { id: 'overflow', textContent: '⋯', title: 'More: reset, search actions' });
  moreBtn.setAttribute('aria-haspopup', 'true'); moreBtn.setAttribute('aria-expanded', 'false'); moreBtn.setAttribute('aria-label', 'More actions');
  const more = mk('div', { className: 'overflow', id: 'overflowmenu' });
  const search = mk('button', { id: 'searchactions', title: 'Find any action by name' }); search.innerHTML = '<span>Search actions…</span><kbd>/</kbd>';
  more.append(search);
  for (const b of [reset]) if (b) { b.removeAttribute('style'); more.append(b); }
  moreWrap.append(moreBtn, more);

  // undo and redo as one segmented control
  const seg = mk('div', { className: 'seg' });
  if (undo && redo) seg.append(undo, redo);

  // the Moves chip moves from the picture into the bar
  if (movesBtn) movesBtn.removeAttribute('style');

  const spacer = mk('span', { className: 'sp' });
  const bar: (HTMLElement | null)[] = [title, back, ...strays as HTMLElement[], addWrap, seg, view, movesBtn, partnerBtn, spacer, moreWrap];
  top.replaceChildren(...(bar.filter(Boolean) as HTMLElement[]));
  root.style.gridTemplateRows = ''; // the stylesheet's two rows (bar, then the work area)

  // menus: open, close on outside click, Escape, or after a choice
  const menus: [HTMLElement, HTMLElement][] = [[addBtn, addBar], [moreBtn, more]];
  const closeMenus = (except?: HTMLElement) => { for (const [b, m] of menus) if (m !== except) { m.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); } };
  for (const [b, m] of menus) b.onclick = (e) => { e.stopPropagation(); const open = !m.classList.contains('open'); closeMenus(); m.classList.toggle('open', open); b.setAttribute('aria-expanded', String(open)); };
  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    for (const [, m] of menus) if (m.classList.contains('open') && (!m.contains(t) || (t.closest('button') && !t.closest('label') && !t.closest('.pb-bar') && t.closest('button') !== search))) closeMenus();
  });
  const isTyping = () => { const a = document.activeElement as HTMLElement | null; return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT'); };

  // the Moves and Design partner cards share one dock: opening one closes the other
  const helper = q<HTMLElement>('#helper'), moves = q<HTMLElement>('#moves');
  const sync = (opened: HTMLElement, other: HTMLElement, otherBtn: HTMLElement | null) => {
    if (document.documentElement.dataset.dock === 'both') return; // a preview opened from the Moves list keeps the list beside it
    if (!opened.classList.contains('closed') && !other.classList.contains('closed')) { other.classList.add('closed'); otherBtn?.setAttribute('aria-pressed', 'false'); }
  };
  // the Design partner takes the whole right column below the Simulator card, so it never covers the verdict
  if (helper) {
    const place = () => {
      const aside = helper.parentElement, lane = aside && [...aside.children].find((c) => c !== helper && /^Simulator/.test(c.textContent ?? ''));
      const card = lane && ([...lane.children].find((c) => /^Simulator/.test(c.textContent ?? '')) as HTMLElement | undefined);
      if (!aside || !card) return;
      const top = card.getBoundingClientRect().bottom - aside.getBoundingClientRect().top + 8;
      helper.style.setProperty('--partner-top', `${Math.max(10, Math.round(top))}px`);
    };
    new MutationObserver(place).observe(helper, { attributes: true, attributeFilter: ['class'] });
    addEventListener('resize', place);
    document.addEventListener('click', () => requestAnimationFrame(place), true);
  }
  if (helper && moves) {
    new MutationObserver(() => sync(helper, moves, movesBtn)).observe(helper, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(() => sync(moves, helper, partnerBtn)).observe(moves, { attributes: true, attributeFilter: ['class'] });
  }

  // the command palette
  const pal = mk('div', { id: 'palette' }); pal.setAttribute('role', 'dialog'); pal.setAttribute('aria-label', 'Search actions');
  const card = mk('div', { className: 'card' }); pal.append(card);
  const input = mk('input', { id: 'palettesearch', type: 'text', placeholder: 'Type an action: undo, trebuchet, play, fix it…' }); input.setAttribute('autocomplete', 'off');
  const list = mk('div', { className: 'list' }); list.setAttribute('role', 'listbox');
  card.append(input, list); root.append(pal);
  interface Item { label: string; section: string; keys: string; el: HTMLElement }
  let items: Item[] = [], shown: Item[] = [], sel = 0;
  const sectionOf = (b: HTMLElement) => b.closest('.addmenu') ? 'Add piece' : b.closest('.overflow') ? 'More' : b.closest('#helper') ? 'Design partner' : b.closest('#moves') ? 'Moves' : b.closest('#panel') ? 'Piece' : b.closest('.aside') ? 'Lane' : 'Top bar';
  const gather = () => {
    const seen = new Set<string>(); items = [];
    for (const b of root.querySelectorAll<HTMLElement>('button, a.btn')) {
      if (pal.contains(b) || b.dataset.proxy || (b as HTMLButtonElement).disabled || b === moreBtn || b === search) continue;
      const text = (b.textContent ?? '').replace(/\s+/g, ' ').trim(), label = text.length > 2 ? text : (b.title || b.getAttribute('aria-label') || '').trim();
      if (!label) continue;
      const section = sectionOf(b), key = `${section}|${label}`;
      if (seen.has(key)) continue; seen.add(key);
      items.push({ label, section, keys: SHORTCUTS[b.id] ?? '', el: b });
    }
  };
  const paint = () => {
    list.replaceChildren();
    if (!shown.length) { list.append(mk('div', { className: 'none', textContent: 'No action with that name.' })); return; }
    shown.forEach((it, i) => {
      const row = mk('div', { className: 'pitem' }); row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(i === sel));
      row.append(mk('span', { textContent: it.label }), mk('span', { className: 'sec', textContent: it.section }));
      if (it.keys) row.append(mk('kbd', { textContent: it.keys })); else row.append(mk('span'));
      row.onclick = () => run(it); row.onmousemove = () => { if (sel !== i) { sel = i; list.querySelectorAll('.pitem').forEach((r, j) => r.setAttribute('aria-selected', String(j === sel))); } };
      list.append(row);
    });
    list.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' });
  };
  const filter = () => {
    const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    shown = items.filter((it) => words.every((w) => `${it.label} ${it.section}`.toLowerCase().includes(w))).slice(0, 40);
    sel = 0; paint();
  };
  const openPalette = () => { closeMenus(); gather(); input.value = ''; pal.classList.add('open'); filter(); input.focus(); };
  const closePalette = () => { pal.classList.remove('open'); input.blur(); };
  const run = (it: Item) => {
    closePalette();
    const inHelper = it.el.closest('#helper') && helper?.classList.contains('closed'), inMoves = it.el.closest('#moves') && moves?.classList.contains('closed');
    if (inHelper) partnerBtn?.click(); else if (inMoves) movesBtn?.click();
    it.el.click();
  };
  input.oninput = filter;
  input.onkeydown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[sel]) run(shown[sel]); }
    e.stopPropagation(); // typing here must not move or delete pieces
  };
  pal.addEventListener('mousedown', (e) => { if (e.target === pal) closePalette(); });
  search.onclick = () => { closeMenus(); openPalette(); };
  const onKey = (e: KeyboardEvent) => {
    if (!root.isConnected) { removeEventListener('keydown', onKey, true); style.remove(); return; }
    if (e.key === 'Escape') { if (pal.classList.contains('open')) return; closeMenus(); return; }
    if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopPropagation(); pal.classList.contains('open') ? closePalette() : openPalette(); return; }
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping() && !pal.classList.contains('open')) { e.preventDefault(); e.stopPropagation(); openPalette(); }
  };
  addEventListener('keydown', onKey, true);
}
