import { labsOn } from '../ui/labs';
import { mountWorldGallery } from '../ui/world-picker';
import { LAB_GROUPS } from '../ui/labs-series';
import { DEFAULT_SOURCE, edgePath, focusState, layoutLabsMap, neighboursOf, type LabsMap, type MapNode } from '../ui/labs-map-layout';

// CC-133: the Labs as a dependency tree. Each Lab is a box in its tier's column; a line joins a Lab to the Labs it uses and the Lab that comes next in its pipeline.
// Point at a box (or Tab to it) and everything else dims; Click or Enter opens the Lab. Drawn from src/ui/labs-series.ts, so a new Lab appears by itself. Behind the labs switch (?labs=1).
const INK = '#17201d', TEAL = '#0f6b5c', ORANGE = '#d9741a', PALE = '#cdd8d1';
const SVGNS = 'http://www.w3.org/2000/svg';
const href = (mode: string): string => `?mode=${mode}&labs=1&welcome=0`;
const short = (s: string, max = 30): string => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/** Draw the map into a host element; returns a way to set the focus from code (the tests and the check script use it). */
export function drawLabsMap(host: HTMLElement, map: LabsMap = layoutLabsMap(DEFAULT_SOURCE, { groupGap: 20 })): { focus(mode: string | null): void } {
  const pad = 8, svg = svgEl('svg', { viewBox: `${-pad} 0 ${map.width + 2 * pad} ${map.height}`, width: map.width + 2 * pad, height: map.height, role: 'group', 'aria-label': 'Map of how the Labs depend on each other' });
  svg.id = 'lmap-svg';
  for (const c of map.columns) {
    const t = svgEl('text', { x: c.x, y: 16, class: 'colhead' }); t.textContent = c.title; svg.append(t);
    svg.append(svgEl('line', { x1: c.x, x2: c.x + c.w, y1: 22, y2: 22, stroke: PALE, 'stroke-width': 1 }));
  }
  const first = new Set<string>();
  for (const g of LAB_GROUPS) {
    const n = map.nodes.filter((x) => x.group === g.id && x.column === 0).sort((a, b) => a.y - b.y)[0];
    if (!n || first.has(g.id)) continue;
    first.add(g.id);
    const t = svgEl('text', { x: n.x, y: n.y - 6, class: 'grouphead' }); t.textContent = g.title; svg.append(t);
  }
  const byMode = new Map(map.nodes.map((n) => [n.mode, n]));
  const edgeEls = new Map<string, SVGPathElement>(), nodeEls = new Map<string, SVGGElement>();
  const edgeLayer = svgEl('g', { class: 'edges' }); svg.append(edgeLayer);
  for (const e of map.edges) {
    const p = svgEl('path', { d: edgePath(byMode.get(e.from)!, byMode.get(e.to)!), class: `edge ${e.kind}`, fill: 'none' });
    p.dataset.edge = e.id; p.dataset.from = e.from; p.dataset.to = e.to;
    const t = svgEl('title'); t.textContent = e.reason; p.append(t);
    edgeLayer.append(p); edgeEls.set(e.id, p);
  }
  const nodeLayer = svgEl('g', { class: 'nodes' }); svg.append(nodeLayer);
  for (const n of map.nodes) {
    const a = svgEl('a', { href: href(n.mode), class: 'node', tabindex: 0 }); a.dataset.lab = n.mode; a.dataset.tier = n.tier;
    a.setAttribute('aria-label', `Lab ${n.n}: ${n.name}. Opens the Lab.`);
    const g = a as unknown as SVGGElement;
    a.append(svgEl('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 8 }));
    const num = svgEl('text', { x: n.x + 10, y: n.y + n.h / 2 + 4.5, class: 'num' }); num.textContent = String(n.n);
    const nm = svgEl('text', { x: n.x + 34, y: n.y + n.h / 2 + 4.5, class: 'name' }); nm.textContent = short(n.name);
    const t = svgEl('title'); t.textContent = `Lab ${n.n}: ${n.name}`;
    a.append(num, nm, t); nodeLayer.append(a); nodeEls.set(n.mode, g);
  }
  host.append(svg);
  const says = host.ownerDocument.getElementById('lmap-says');
  const name = (m: string): string => { const n = byMode.get(m)!; return `Lab ${n.n}: ${n.name}`; };
  const focus = (mode: string | null): void => {
    const st = focusState(map, mode);
    svg.classList.toggle('focused', !!mode && byMode.has(mode));
    for (const [m, el] of nodeEls) { el.classList.toggle('dim', st.dimNode(m)); el.classList.toggle('on', m === mode); }
    for (const [id, el] of edgeEls) { el.classList.toggle('dim', st.dimEdge(id)); el.classList.toggle('hot', st.hot.has(id)); }
    if (!says) return;
    if (!mode || !byMode.has(mode)) { says.textContent = 'Point at a Lab to see the Labs it uses and the Labs that use it. Click one to open it.'; says.dataset.focus = ''; return; }
    says.dataset.focus = mode;
    const nb = neighboursOf(map, mode), lines = map.edges.filter((e) => nb.edges.has(e.id));
    const uses = lines.filter((e) => e.to === mode && e.kind === 'uses'), usedBy = lines.filter((e) => e.from === mode && e.kind === 'uses');
    const before = lines.filter((e) => e.to === mode && e.kind === 'flow'), after = lines.filter((e) => e.from === mode && e.kind === 'flow');
    const row = (label: string, es: typeof lines, other: 'from' | 'to'): string => (es.length ? `<li><b>${label}</b> ${es.map((e) => `${name(e[other])} <i>(${e.reason.replace(/^.*?for: /, '').replace(/^.*?: /, '')})</i>`).join('; ')}</li>` : '');
    says.innerHTML = `<b>${name(mode)}</b><ul>${row('Uses:', uses, 'from')}${row('Used by:', usedBy, 'to')}${row('Comes from:', before, 'from')}${row('Feeds:', after, 'to')}${lines.length ? '' : '<li>No lines yet: a method on its own.</li>'}</ul>`;
  };
  for (const [m, el] of nodeEls) {
    el.addEventListener('mouseenter', () => focus(m)); el.addEventListener('mouseleave', () => focus(null));
    el.addEventListener('focus', () => focus(m)); el.addEventListener('blur', () => focus(null));
  }
  focus(null);
  return { focus };
}

export function startLabsMap(host: HTMLElement): { backend: 'canvas2d' } {
  const root = document.createElement('div');
  root.id = 'labs-map';
  root.style.cssText = `position:fixed;inset:0;overflow:auto;background:#f5f7f4;color:${INK};font:15px/1.4 system-ui,sans-serif`;
  host.append(root);
  if (!labsOn()) {
    root.innerHTML = `<div style="max-width:520px;margin:12vh auto;padding:0 16px"><h1 style="font-size:22px">Map of the Labs</h1><p>Labs are switched off.</p><p><a href="?mode=labs-map&labs=1" style="color:${TEAL}">Switch labs on</a></p></div>`;
    return { backend: 'canvas2d' };
  }
  const style = document.createElement('style');
  style.textContent = `
    #labs-map .wrap{max-width:1264px;margin:0 auto;padding:12px 16px 24px;display:grid;gap:10px}
    #labs-map h1{font-size:22px;margin:0}#labs-map .small{color:#52605a;font-size:13px;margin:0}
    #labs-map a.back,#labs-map button.link{color:${TEAL};font:600 14px system-ui;background:none;border:0;padding:0;cursor:pointer;text-decoration:underline}
    #labs-map .bar{display:flex;gap:14px;align-items:center}
    #labs-map .card{background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:10px 12px}
    #labs-map .key{display:flex;gap:18px;align-items:center;font-size:13px;color:#52605a}
    #labs-map .key i{display:inline-block;width:26px;height:0;border-top:3px solid ${TEAL};vertical-align:middle;margin-right:6px}#labs-map .key i.flow{border-top:3px dashed ${ORANGE}}
    #labs-map svg{display:block;font:13px system-ui,sans-serif;overflow:visible}
    #labs-map .colhead{font:700 13px system-ui;fill:${INK};text-transform:uppercase;letter-spacing:.05em}
    #labs-map .grouphead{font:600 11px system-ui;fill:#6a776f}
    #labs-map .node{cursor:pointer;outline:none}
    #labs-map .node rect{fill:#fff;stroke:#b9c4bb;stroke-width:1.2}
    #labs-map .node[data-tier=pipelines] rect{fill:#e6f2ee;stroke:${TEAL}}
    #labs-map .node[data-tier=foundations] rect{fill:#fff}
    #labs-map .node .num{font-weight:700;fill:${TEAL}}#labs-map .node .name{fill:${INK}}
    #labs-map .node:focus-visible rect{stroke:#ffb347;stroke-width:3}
    #labs-map .node.on rect{stroke:${INK};stroke-width:2.5}
    #labs-map .edge{stroke-width:1.6;opacity:.55}
    #labs-map .edge.uses{stroke:${TEAL}}#labs-map .edge.flow{stroke:${ORANGE};stroke-dasharray:6 4}
    #labs-map svg.focused .dim{opacity:.14}#labs-map svg.focused .edge.hot{opacity:1;stroke-width:3}
    #labs-map svg .node,#labs-map svg .edge{transition:opacity .12s}
    #labs-map #lmap-says{height:112px;overflow:auto;box-sizing:border-box}
    #labs-map #lmap-says ul{margin:4px 0 0;padding-left:18px}#labs-map #lmap-says i{color:#52605a}
  `;
  root.append(style);
  const wrap = document.createElement('div'); wrap.className = 'wrap'; root.append(wrap);
  wrap.innerHTML = `
    <div class="bar"><a class="back" href="/?welcome=0">Back to the game</a><button class="link" id="lmap-courses" type="button" title="Pick a course, or one Lab from the list">The list of Labs</button></div>
    <h1>Map of the Labs</h1>
    <p class="small">Left to right: the skills first, then the things built from them. Point at a Lab (or Tab to it) to see only its neighbours. Click to open it.</p>
    <div class="key"><span><i></i>uses</span><span><i class="flow"></i>feeds the next Lab</span></div>
    <div class="card" id="lmap-says" aria-live="polite"></div>
    <div class="card" id="lmap-host" style="overflow:auto"></div>`;
  const gallery = mountWorldGallery(host, { current: { value: null }, place: 'display:none' });
  wrap.querySelector<HTMLButtonElement>('#lmap-courses')!.onclick = () => gallery.open();
  const api = drawLabsMap(wrap.querySelector<HTMLElement>('#lmap-host')!);
  (window as unknown as { __labsMap?: unknown }).__labsMap = api;
  document.documentElement.dataset.labPopulated = 'labs-map';
  return { backend: 'canvas2d' };
}
export type { MapNode };
