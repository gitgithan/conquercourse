// The growth strip on the course picker (CC-108): small numbers for all time with a tiny line each, and one chart behind a click.
// One metric at a time (a menu), because players, runs and assets live on different scales; the range buttons cut the time axis.
// No data, no chart: a young game says so honestly, and nothing here is made up.
import { countriesTile, loadWorldStats } from './world-stats';
import { METRIC_WORDS, isEmpty, linePoints, niceMax, sliceRange, type DailyStats, type Metric, type Range } from '../slice/daily-stats';

export const GROWTH_ON = true;
export const growthOn = (params: URLSearchParams, build = GROWTH_ON): boolean => build && params.get('growth') !== '0';

const COLOR: Record<Metric, string> = { players: '#4aa3ff', runs: '#f0a020', assets: '#3ac47d', clears: '#c58bff' };
const TILES: Metric[] = ['players', 'runs', 'clears', 'assets'];
const RANGES: [Range, string][] = [['7', '7 days'], ['30', '30 days'], ['all', 'All time']];
const NS = 'http://www.w3.org/2000/svg';
const n = (x: number): string => x.toLocaleString('en-US');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-10-31" as "Oct 31". */
export const dayText = (iso: string): string => `${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ''} ${Number(iso.slice(8, 10))}`.trim();
const THING: Record<Metric, [string, string]> = { players: ['player', 'players'], runs: ['run', 'runs'], assets: ['asset made', 'assets made'], clears: ['course cleared', 'courses cleared'] };
/** "5 players", "1 run": the value with its word. */
export const countText = (metric: Metric, x: number): string => `${n(x)} ${THING[metric][x === 1 ? 0 : 1]}`;

const STYLE = `
.gr{margin:.5em 0 .8em;padding:.8em .9em;border:1px solid #5566;border-radius:12px;background:#ffffff08}
.gr-tiles{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.6em}
.gr-tile{display:flex;flex-direction:column;gap:.15em;padding:.55em .7em;border-radius:10px;border:1.5px solid #5566;background:#ffffff0d;color:inherit;font:inherit;cursor:pointer;text-align:left;transition:border-color .12s,background .12s}
.gr-tile.gr-plain{cursor:default}
.gr-tile.gr-plain:hover{background:#ffffff0d;border-color:#5566}
.gr-note2{font-size:.7em;opacity:.7;margin-top:.2em}
.gr-tile:hover{background:#ffffff1a;border-color:var(--c)}
.gr-tile[aria-pressed=true]{background:#ffffff1f;border-color:var(--c);box-shadow:inset 0 -3px 0 var(--c)}
.gr-tile:focus-visible,.gr-r button:focus-visible,.gr-more:focus-visible{outline:3px solid #f0a020;outline-offset:1px}
.gr-v{font-size:1.9em;font-weight:800;line-height:1.05;color:var(--c)}
.gr-l{font-size:.72em;opacity:.8;text-transform:uppercase;letter-spacing:.05em}
.gr-spark{display:block;margin-top:.2em;width:100%;height:20px}
.gr .ws-tiles{display:none!important}
.gr .ws-hl{margin-top:.7em!important}
.gr-foot{display:flex;gap:.6em;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-top:.7em}
.gr-more{border:0;background:none;color:inherit;font:inherit;font-size:.85em;opacity:.85;cursor:pointer;text-decoration:underline;padding:.2em 0}
.gr-r{display:inline-flex;border:1px solid #5566;border-radius:8px;overflow:hidden}
.gr-r button{font:inherit;font-size:.85em;padding:.25em .8em;border:0;border-left:1px solid #5566;background:none;color:inherit;cursor:pointer}
.gr-r button:first-child{border-left:0}
.gr-r button[aria-pressed=true]{background:#ffffff2e;font-weight:700}
.gr-panel{margin-top:.5em;border-top:1px solid #5564;padding-top:.6em}
.gr-sum{font-size:.95em;margin:0 0 .3em}
.gr-note{font-size:.8em;opacity:.75;margin:.3em 0 0}
.gr-wrap{position:relative}
.gr-chart{display:block;width:100%;height:150px}
.gr-tip{position:absolute;pointer-events:none;transform:translate(-50%,-110%);padding:.2em .6em;border-radius:6px;background:#111d;color:#fff;font-size:.8em;white-space:nowrap;border:1px solid #fff4}
.gr-empty{font-size:.95em;padding:.3em 0}
`;

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/** Where day `i` of `count` sits across a plot `w` wide: one day alone is centred, so its dot is always inside the box. */
export const dotX = (i: number, count: number, w: number): number => (count > 1 ? (i * w) / (count - 1) : w / 2);

/**
 * The chart for one metric.
 * Every day is a visible dot with a hover note; a line and a soft area join the dots only when there are two or more.
 * One day alone is a centred dot with its value; no data at all is a dot at 0.
 */
export function drawChart(d: DailyStats, metric: Metric, W = 720): SVGSVGElement {
  const H = 150, L = 34, B = 22, T = 26, R = 14, w = W - L - R, h = H - B - T;
  const xs = d.series[metric].length ? d.series[metric] : [0], top = niceMax(Math.max(...xs, 0)), color = COLOR[metric];
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'gr-chart', role: 'img', 'aria-label': `${METRIC_WORDS[metric].menu} per day` });
  const g = svg('g', { transform: `translate(${L},${T})` });
  for (const f of [0, 0.5, 1]) {
    g.append(svg('line', { x1: 0, x2: w, y1: h - f * h, y2: h - f * h, stroke: 'currentColor', 'stroke-opacity': f === 0 ? 0.5 : 0.15 }));
    const t = svg('text', { x: -6, y: h - f * h + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'currentColor', 'fill-opacity': 0.75 }); t.textContent = n(Math.round(top * f)); g.append(t);
  }
  const X = (i: number) => dotX(i, xs.length, w), Y = (x: number) => h - (x / top) * h;
  if (xs.length > 1) {
    const pts = xs.map((x, i) => `${X(i).toFixed(1)},${Y(x).toFixed(1)}`).join(' ');
    g.append(svg('polygon', { points: `0,${h} ${pts} ${w},${h}`, fill: color, 'fill-opacity': 0.18 }));
    g.append(svg('polyline', { points: pts, fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  }
  const labelled = new Set<number>(xs.length <= 8 ? xs.map((_, i) => i) : [xs.indexOf(Math.max(...xs)), xs.length - 1]);
  const dotR = xs.length <= 14 ? 5 : xs.length <= 31 ? 3.5 : 2.5;
  xs.forEach((x, i) => {
    g.append(svg('circle', { class: 'gr-dot', cx: X(i).toFixed(1), cy: Y(x).toFixed(1), r: dotR, fill: color, stroke: '#0007', 'stroke-width': 1.5, 'data-i': i }));
    if (labelled.has(i)) {
      const t = svg('text', { class: 'gr-val', x: X(i).toFixed(1), y: (Y(x) - dotR - 5).toFixed(1), 'text-anchor': i === 0 && xs.length > 1 ? 'start' : i === xs.length - 1 && xs.length > 1 ? 'end' : 'middle', 'font-size': 12, 'font-weight': 700, fill: 'currentColor' });
      t.textContent = n(x); g.append(t);
    }
  });
  const step = xs.length > 1 ? w / (xs.length - 1) : w;
  xs.forEach((x, i) => { // a wide invisible strip per day, so the hover works on the whole column
    g.append(svg('rect', { class: 'gr-hit', x: (X(i) - step / 2).toFixed(1), y: 0, width: step.toFixed(1), height: h, fill: 'transparent', 'data-i': i, 'data-tip': `${dayText(d.days[i] ?? '')}: ${countText(metric, x)}` }));
  });
  const edge = (i: number, x: number, anchor: string) => { const t = svg('text', { x, y: h + 16, 'text-anchor': anchor, 'font-size': 11, fill: 'currentColor', 'fill-opacity': 0.75 }); t.textContent = dayText(d.days[i] ?? ''); g.append(t); };
  if (d.days.length > 1) { edge(0, 0, 'start'); edge(d.days.length - 1, w, 'end'); } else if (d.days.length === 1) edge(0, w / 2, 'middle');
  s.append(g);
  return s;
}

/** The plain sentence above the chart. */
export function summaryText(cut: DailyStats, metric: Metric): string {
  const xs = cut.series[metric], total = xs.reduce((a, b) => a + b, 0);
  if (cut.days.length <= 1) return `${countText(metric, xs[0] ?? 0)} on ${dayText(cut.days[0] ?? '') || 'the first day'}.`;
  return `${countText(metric, total)} in the last ${cut.days.length} days.`;
}

function spark(xs: number[], color: string): SVGSVGElement {
  const last = xs.slice(-14), s = svg('svg', { viewBox: '0 0 100 20', preserveAspectRatio: 'none', class: 'gr-spark', 'aria-hidden': 'true' });
  const top = niceMax(Math.max(...last, 0));
  if (last.length > 1) s.append(svg('polyline', { points: linePoints(last, 96, 16, top).split(' ').map((p) => { const [x, y] = p.split(','); return `${Number(x) + 2},${Number(y) + 2}`; }).join(' '), fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }));
  else s.append(svg('line', { x1: 2, x2: 98, y1: 10, y2: 10, stroke: color, 'stroke-opacity': 0.35, 'stroke-width': 2, 'stroke-dasharray': '3 4', 'vector-effect': 'non-scaling-stroke' }));
  return s;
}

export async function loadDaily(): Promise<DailyStats | null> {
  try { const r = await fetch('/api/daily-stats'); return r.ok ? await r.json() as DailyStats : null; } catch { return null; }
}

/** Builds the card; hidden until the numbers arrive (or fail), so the cards never wait for it. The world strip, if there, moves in as the highlights. */
export function mountGrowth(host: HTMLElement, load: () => Promise<DailyStats | null> = loadDaily): void {
  host.style.display = 'none';
  void load().then((d) => {
    if (!d || !d.days.length) return;
    if (!document.getElementById('growth-style')) { const st = document.createElement('style'); st.id = 'growth-style'; st.textContent = STYLE; document.head.append(st); }
    host.className = 'gr'; host.replaceChildren();
    if (isEmpty(d)) { const p = document.createElement('div'); p.className = 'gr-empty'; p.textContent = 'Just starting: be one of the first. Your runs will start this chart.'; host.append(p); host.style.display = ''; return; }
    let metric: Metric = 'players', range: Range = '30', open = false;
    const tiles = document.createElement('div'); tiles.className = 'gr-tiles';
    const panel = document.createElement('div'); panel.className = 'gr-panel'; panel.hidden = true;
    const rg = document.createElement('div'); rg.className = 'gr-r'; rg.setAttribute('role', 'group'); rg.setAttribute('aria-label', 'Time range');
    const more = document.createElement('button'); more.type = 'button'; more.className = 'gr-more'; more.onclick = () => { open = !open; draw(); };
    const draw = () => {
      for (const b of tiles.querySelectorAll<HTMLButtonElement>('.gr-tile')) b.setAttribute('aria-pressed', String(open && b.dataset.metric === metric));
      for (const b of rg.querySelectorAll<HTMLButtonElement>('button')) b.setAttribute('aria-pressed', String(b.dataset.range === range));
      panel.hidden = !open; rg.hidden = !open; more.textContent = open ? 'Hide the chart' : 'Show the chart'; more.setAttribute('aria-expanded', String(open));
      if (!open) return;
      const cut = sliceRange(d, range);
      const sum = document.createElement('p'); sum.className = 'gr-sum'; sum.textContent = summaryText(cut, metric);
      const wrap = document.createElement('div'); wrap.className = 'gr-wrap';
      const chart = drawChart(cut, metric, Math.max(360, Math.round(host.clientWidth - 40) || 720));
      const tip = document.createElement('div'); tip.className = 'gr-tip'; tip.hidden = true; tip.setAttribute('role', 'status');
      for (const r of chart.querySelectorAll<SVGRectElement>('.gr-hit')) {
        const show = () => {
          const dot = chart.querySelector<SVGCircleElement>(`.gr-dot[data-i="${r.dataset.i}"]`)!;
          const a = dot.getBoundingClientRect(), b = wrap.getBoundingClientRect();
          tip.textContent = r.dataset.tip ?? ''; tip.hidden = false; tip.style.left = `${a.left - b.left + a.width / 2}px`; tip.style.top = `${a.top - b.top}px`;
        };
        r.addEventListener('pointerenter', show); r.addEventListener('pointerleave', () => { tip.hidden = true; });
      }
      wrap.append(chart, tip);
      panel.replaceChildren(sum, wrap);
      if (cut.days.length === 1) { const note = document.createElement('p'); note.className = 'gr-note'; note.textContent = 'The line grows as days pass: each new day adds a dot.'; panel.append(note); }
    };
    for (const [r, label] of RANGES) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.range = r; b.onclick = () => { range = r; draw(); }; rg.append(b); }
    for (const m of TILES) {
      const xs = d.series[m], today = m === 'players' && d.players !== undefined ? d.players : xs.reduce((a, b) => a + b, 0); // all time, so every visitor sees the total grow
      const b = document.createElement('button'); b.type = 'button'; b.className = 'gr-tile'; b.dataset.metric = m; b.style.setProperty('--c', COLOR[m]); b.setAttribute('aria-pressed', 'false');
      b.title = `${METRIC_WORDS[m].menu} each day, and the total so far above. Click to see the chart.`;
      const v = document.createElement('div'); v.className = 'gr-v'; v.textContent = n(today);
      const l = document.createElement('div'); l.className = 'gr-l'; l.textContent = today === 1 ? METRIC_WORDS[m].one : METRIC_WORDS[m].chip;
      b.append(v, l, spark(xs, COLOR[m]));
      b.onclick = () => { open = !(open && metric === m); metric = m; draw(); };
      tiles.append(b);
    }
    void loadWorldStats().then((w) => { // the fifth tile: all-time countries; a plain box, as there is no daily line for it
      const c = countriesTile(w); if (!c) return;
      const b = document.createElement('div'); b.className = 'gr-tile gr-plain'; b.dataset.metric = 'countries'; b.style.setProperty('--c', '#ff6f91'); b.title = c.title;
      const v = document.createElement('div'); v.className = 'gr-v'; v.textContent = c.value;
      const l = document.createElement('div'); l.className = 'gr-l'; l.textContent = `${c.label} (all time)`;
      b.append(v, l); if (c.note) { const t = document.createElement('div'); t.className = 'gr-note2'; t.textContent = c.note; b.append(t); }
      tiles.append(b);
    });
    const foot = document.createElement('div'); foot.className = 'gr-foot'; foot.append(more, rg);
    host.append(tiles);
    const world = document.getElementById('world-stats'); // its facts become chips inside this card
    if (world && world !== host) { world.removeAttribute('style'); world.className = 'ws-in-card'; host.append(world); }
    host.append(foot, panel); draw();
    host.style.display = '';
  });
}
