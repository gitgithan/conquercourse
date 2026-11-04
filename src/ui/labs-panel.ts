import { labHref } from './labs-nav-data';
import { layoutPanel, panelEdges } from './labs-panel-layout';
import { labIconSvg } from './labs-icons';
import { focusState, neighboursOf, type LabsMap } from './labs-map-layout';
import { LAB_LIST } from './labs-series';

// CC-133: the Labs panel. It slides down from the top bar and holds the whole map on one page:
// one grouped box per category (with its heading), a square-icon tile per Lab, and the dependency lines drawn between tiles across the boxes.
// Point at (or Tab to) a tile and everything except its neighbours dims. Esc, the close button or picking a Lab closes it.

/** Open or closed, as a tiny pure machine (the page and the tests share it). */
export type PanelEvent = 'open' | 'close' | 'toggle' | 'escape' | 'pick';
export const panelNext = (open: boolean, ev: PanelEvent): boolean => (ev === 'open' ? true : ev === 'toggle' ? !open : ev === 'escape' || ev === 'close' || ev === 'pick' ? false : open);

/** The lines and the dimming rule use the same connection data as the old map; the positions come from labs-panel-layout.ts. */
export function panelMap(): LabsMap {
  return { nodes: LAB_LIST.map((l, i) => ({ mode: l.mode, n: i + 1, name: l.name, tier: '', group: '', column: 0, x: 0, y: 0, w: 0, h: 0 })), edges: panelEdges(), columns: [], width: 0, height: 0 };
}

const STYLE = `
  #labs-panel-back{position:fixed;inset:0;z-index:58;background:rgba(23,32,29,.45);opacity:0;visibility:hidden;transition:opacity .25s,visibility 0s .25s}
  #labs-panel-back.open{opacity:1;visibility:visible;transition:opacity .25s}
  #labs-panel{position:fixed;top:0;left:0;right:0;z-index:59;max-height:100vh;display:flex;flex-direction:column;background:#f5f7f4;color:#17201d;font:14px/1.35 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.35);transform:translateY(-102%);visibility:hidden;transition:transform .3s cubic-bezier(.2,.8,.2,1),visibility 0s .3s}
  #labs-panel.open{transform:translateY(0);visibility:visible;transition:transform .3s cubic-bezier(.2,.8,.2,1)}
  #labs-panel .lp-head{display:flex;align-items:center;gap:14px;padding:10px 20px;border-bottom:1px solid #d5ddd6;background:#fff}
  #labs-panel .lp-head h2{margin:0;font-size:18px}#labs-panel .lp-key{color:#52605a;font-size:12px;display:flex;gap:14px;align-items:center;flex:1}
  #labs-panel .lp-key i{display:inline-block;width:24px;border-top:3px solid #0f6b5c;margin-right:5px;vertical-align:middle}#labs-panel .lp-key i.flow{border-top:3px dashed #d9741a}
  #labs-panel .lp-close{font:700 14px system-ui;color:#fff;background:#17201d;border:0;border-radius:6px;padding:6px 12px;cursor:pointer}
  #labs-panel .lp-body{overflow:auto;padding:8px 20px 14px}
  #labs-panel .lp-stage{position:relative}
  #labs-panel .lp-colhead{position:absolute;top:0;font:700 12px system-ui;letter-spacing:.08em;text-transform:uppercase;color:#52605a}
  #labs-panel .lp-box{position:absolute;box-sizing:border-box;background:#fff;box-shadow:inset 0 0 0 1.5px #b9c4bb;border-radius:12px}
  #labs-panel .lp-box[data-tier=pipelines]{background:#eef6f3;box-shadow:inset 0 0 0 1.5px #0f6b5c}
  #labs-panel .lp-box[data-tier=finale]{background:#fff6e4;box-shadow:inset 0 0 0 1.5px #d9741a}
  #labs-panel .lp-box h3{white-space:nowrap;margin:0;padding:6px 10px;font-size:14px;line-height:16px}
  #labs-panel a.lp-tile{position:absolute;z-index:2;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center;text-decoration:none;color:#17201d;font-size:11.5px;line-height:1.15;border-radius:8px;padding:2px 3px;background:#fff;transition:opacity .12s}
  #labs-panel a.lp-tile svg{flex:0 0 auto}
  #labs-panel .lp-box[data-tier=pipelines] a.lp-tile{background:#eef6f3}#labs-panel .lp-box[data-tier=finale] a.lp-tile{background:#fff6e4}
  #labs-panel a.lp-tile:hover,#labs-panel a.lp-tile:focus-visible{background:#e6f2ee;outline:none}#labs-panel a.lp-tile:focus-visible{box-shadow:0 0 0 2px #ffb347}
  #labs-panel a.lp-tile[aria-current=page]{background:#d7f0e4;box-shadow:inset 0 0 0 2px #0f6b5c}
  #labs-panel a.lp-tile.dim{opacity:.18}
  #labs-panel svg.lp-lines{position:absolute;left:0;top:0;pointer-events:none;overflow:visible;z-index:1}
  #labs-panel svg.lp-lines path{fill:none;stroke-width:1.6;opacity:.55;transition:opacity .12s}
  #labs-panel svg.lp-lines path.uses{stroke:#0f6b5c}#labs-panel svg.lp-lines path.flow{stroke:#d9741a;stroke-dasharray:6 4}
  #labs-panel.focused svg.lp-lines path.dim{opacity:.07}#labs-panel.focused svg.lp-lines path.hot{opacity:1;stroke-width:3}
  #labs-panel .lp-says{margin:0;color:#52605a;font-size:12px;min-height:16px}`;

export interface LabsPanel { el: HTMLElement; open(): void; close(): void; toggle(): void; isOpen(): boolean; focus(mode: string | null): void }

/** Build the panel into `host`; `current` is the Lab you are in (marked). Returns the controls. */
export function mountLabsPanel(host: HTMLElement, current: string | null, onChange: (open: boolean) => void = () => {}): LabsPanel {
  if (!document.getElementById('labs-panel-style')) { const st = document.createElement('style'); st.id = 'labs-panel-style'; st.textContent = STYLE; document.head.appendChild(st); }
  const map = panelMap();
  const back = document.createElement('div'); back.id = 'labs-panel-back';
  const el = document.createElement('div');
  el.id = 'labs-panel'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'All the Labs'); el.setAttribute('aria-hidden', 'true');
  const L = layoutPanel(), nameOf = (m: string): string => LAB_LIST.find((l) => l.mode === m)?.name ?? m;
  const tile = (tl: { mode: string; name: string; x: number; y: number; w: number; h: number }, bx: number, by: number): string =>
    `<a class="lp-tile" data-lab="${tl.mode}" href="${labHref(tl.mode)}"${tl.mode === current ? ' aria-current="page"' : ''} aria-label="${tl.name}" style="left:${tl.x - bx}px;top:${tl.y - by}px;width:${tl.w}px;height:${tl.h}px">${labIconSvg(tl.mode, 56)}<span>${tl.name}</span></a>`;
  const stage = `<div class="lp-stage" style="width:${L.width}px;height:${L.height}px">${L.columns.map((c) => `<div class="lp-colhead" data-tier="${c.id}" style="left:${c.x}px">${c.title}</div>`).join('')}<svg class="lp-lines" id="lp-lines" width="${L.width}" height="${L.height}" aria-hidden="true">${L.lines.map((l) => `<path class="${l.kind}" data-edge="${l.id}" d="${l.d}"><title>${l.reason}</title></path>`).join('')}</svg>${L.boxes.map((b) => `<section class="lp-box" data-group="${b.id}" data-tier="${b.tier}" style="left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px"><h3>${b.title}</h3>${b.tiles.map((tl) => tile(tl, b.x, b.y)).join('')}</section>`).join('')}</div>`;
  el.innerHTML = `<div class="lp-head"><h2>The Labs</h2><div class="lp-key"><span><i></i>uses</span><span><i class="flow"></i>feeds the next Lab</span><span class="lp-says" id="lp-says">Point at a Lab to see only its neighbours.</span></div><button class="lp-close" id="labs-panel-close" type="button">Close (Esc)</button></div><div class="lp-body" id="lp-body">${stage}</div>`;
  host.append(back, el);
  const says = el.querySelector<HTMLElement>('#lp-says')!;
  const tiles = new Map<string, HTMLAnchorElement>([...el.querySelectorAll<HTMLAnchorElement>('a.lp-tile')].map((a) => [a.dataset.lab!, a]));
  const paths = new Map<string, SVGPathElement>([...el.querySelectorAll<SVGPathElement>('#lp-lines path')].map((p) => [p.dataset.edge!, p]));
  const focus = (mode: string | null): void => {
    const st = focusState(map, mode);
    el.classList.toggle('focused', !!mode && tiles.has(mode));
    for (const [m, a] of tiles) a.classList.toggle('dim', st.dimNode(m));
    for (const [id, p] of paths) { p.classList.toggle('dim', st.dimEdge(id)); p.classList.toggle('hot', st.hot.has(id)); }
    says.textContent = mode && tiles.has(mode) ? `${nameOf(mode)}: next to ${[...neighboursOf(map, mode).modes].map(nameOf).join(', ') || 'no other Lab yet (a method on its own)'}` : 'Point at a Lab to see only its neighbours.';
  };
  for (const [m, a] of tiles) {
    a.addEventListener('mouseenter', () => focus(m)); a.addEventListener('mouseleave', () => focus(null));
    a.addEventListener('focus', () => focus(m)); a.addEventListener('blur', () => focus(null));
    a.addEventListener('click', () => set(panelNext(isOpen, 'pick')));
  }
  let isOpen = false;
  const set = (v: boolean): void => {
    if (v === isOpen) return;
    isOpen = v; el.classList.toggle('open', v); back.classList.toggle('open', v); el.setAttribute('aria-hidden', String(!v));
    if (v) el.querySelector<HTMLElement>('#labs-panel-close')!.focus({ preventScroll: true });
    onChange(v);
  };
  el.querySelector<HTMLButtonElement>('#labs-panel-close')!.onclick = () => set(panelNext(isOpen, 'close'));
  back.onclick = () => set(panelNext(isOpen, 'close'));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen) { e.preventDefault(); set(panelNext(isOpen, 'escape')); } });
  return { el, open: () => set(true), close: () => set(false), toggle: () => set(panelNext(isOpen, 'toggle')), isOpen: () => isOpen, focus };
}
