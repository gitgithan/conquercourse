// The growth strip on the course picker (CC-108): three small numbers for today with a tiny line each, and one chart behind a click.
// One metric at a time (a menu), because players, runs and assets live on different scales; the range buttons cut the time axis.
// No data, no chart: a young game says so honestly, and nothing here is made up.
import { METRICS, METRIC_WORDS, isEmpty, linePoints, niceMax, sliceRange, type DailyStats, type Metric, type Range } from '../slice/daily-stats';

export const GROWTH_ON = true;
export const growthOn = (params: URLSearchParams, build = GROWTH_ON): boolean => build && params.get('growth') !== '0';

const COLOR: Record<Metric, string> = { players: '#4aa3ff', runs: '#f0a020', assets: '#3ac47d', clears: '#c58bff' };
const CHIPS: Metric[] = ['players', 'runs', 'assets'];
const RANGES: [Range, string][] = [['7', '7 days'], ['30', '30 days'], ['all', 'All time']];
const NS = 'http://www.w3.org/2000/svg';
const n = (x: number): string => x.toLocaleString('en-US');

const STYLE = `
.gr{margin:.5em 0 .8em;padding:.5em .7em;border:1px solid #556;border-radius:8px}
.gr-row{display:flex;gap:.6em;align-items:stretch;flex-wrap:wrap}
.gr-chip{flex:1 1 9em;display:flex;align-items:center;gap:.6em;padding:.35em .6em;border-radius:8px;border:1px solid #5566;background:#ffffff0d;color:inherit;font:inherit;cursor:pointer;text-align:left}
.gr-chip:hover,.gr-chip[aria-pressed=true]{background:#ffffff1f;border-color:var(--c)}
.gr-chip:focus-visible,.gr select:focus-visible,.gr-r button:focus-visible{outline:3px solid #f0a020;outline-offset:1px}
.gr-v{font-size:1.7em;font-weight:800;line-height:1;color:var(--c)}
.gr-l{font-size:.72em;opacity:.8;text-transform:uppercase;letter-spacing:.05em}
.gr-spark{margin-left:auto;flex:none}
.gr-more{align-self:center;border:0;background:none;color:inherit;font:inherit;font-size:.85em;opacity:.85;cursor:pointer;text-decoration:underline}
.gr-panel{margin-top:.6em}
.gr-bar{display:flex;gap:.6em;align-items:center;flex-wrap:wrap;margin-bottom:.3em}
.gr select{font:inherit;padding:.2em .4em;border-radius:6px}
.gr-r{display:flex;gap:2px}
.gr-r button{font:inherit;font-size:.85em;padding:.2em .6em;border-radius:6px;border:1px solid #5566;background:none;color:inherit;cursor:pointer}
.gr-r button[aria-pressed=true]{background:#ffffff26;border-color:#fff8;font-weight:700}
.gr-sum{font-size:.85em;opacity:.85;margin-left:auto}
.gr-chart{display:block;width:100%;height:140px}
.gr-empty{font-size:.95em;padding:.3em 0}
`;

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/** The chart for one metric: line, soft area, a top label and the first and last day; each day has a hover note. */
export function drawChart(d: DailyStats, metric: Metric): SVGSVGElement {
  const W = 600, H = 140, L = 34, B = 20, T = 8, w = W - L - 8, h = H - B - T;
  const xs = d.series[metric], top = niceMax(Math.max(...xs, 0)), color = COLOR[metric];
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', class: 'gr-chart', role: 'img', 'aria-label': `${METRIC_WORDS[metric].menu} per day` });
  const g = svg('g', { transform: `translate(${L},${T})` });
  for (const f of [0, 0.5, 1]) {
    g.append(svg('line', { x1: 0, x2: w, y1: h - f * h, y2: h - f * h, stroke: 'currentColor', 'stroke-opacity': f === 0 ? 0.5 : 0.15 }));
    const t = svg('text', { x: -4, y: h - f * h + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'currentColor', 'fill-opacity': 0.75 }); t.textContent = n(Math.round(top * f)); g.append(t);
  }
  const pts = linePoints(xs, w, h, top);
  g.append(svg('polygon', { points: `0,${h} ${pts} ${xs.length > 1 ? w : 0},${h}`, fill: color, 'fill-opacity': 0.18 }));
  g.append(svg('polyline', { points: pts, fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }));
  const step = xs.length > 1 ? w / (xs.length - 1) : 0;
  xs.forEach((x, i) => {
    const r = svg('rect', { x: i * step - Math.max(step, 6) / 2, y: 0, width: Math.max(step, 6), height: h, fill: 'transparent' });
    const t = svg('title', {}); t.textContent = `${d.days[i]}: ${n(x)} ${METRIC_WORDS[metric].menu.toLowerCase()}`; r.append(t); g.append(r);
  });
  for (const [i, anchor] of [[0, 'start'], [d.days.length - 1, 'end']] as const) {
    if (i === 0 && d.days.length < 2) continue;
    const t = svg('text', { x: i === 0 ? 0 : w, y: h + 15, 'text-anchor': anchor, 'font-size': 11, fill: 'currentColor', 'fill-opacity': 0.75 }); t.textContent = d.days[i].slice(5); g.append(t);
  }
  s.append(g);
  return s;
}

function spark(xs: number[], color: string): SVGSVGElement {
  const last = xs.slice(-14), s = svg('svg', { viewBox: '0 0 56 22', width: 56, height: 22, class: 'gr-spark', 'aria-hidden': 'true' });
  s.append(svg('polyline', { points: linePoints(last.length > 1 ? last : [0, ...last], 56, 22), fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
  return s;
}

export async function loadDaily(): Promise<DailyStats | null> {
  try { const r = await fetch('/api/daily-stats'); return r.ok ? await r.json() as DailyStats : null; } catch { return null; }
}

/** Builds the strip; hidden until the numbers arrive (or fail), so the cards never wait for it. */
export function mountGrowth(host: HTMLElement, load: () => Promise<DailyStats | null> = loadDaily): void {
  host.style.display = 'none';
  void load().then((d) => {
    if (!d || !d.days.length) return;
    if (!document.getElementById('growth-style')) { const st = document.createElement('style'); st.id = 'growth-style'; st.textContent = STYLE; document.head.append(st); }
    host.className = 'gr'; host.replaceChildren();
    if (isEmpty(d)) { const p = document.createElement('div'); p.className = 'gr-empty'; p.textContent = 'Just starting: be one of the first. Your runs will start this chart.'; host.append(p); host.style.display = ''; return; }
    let metric: Metric = 'players', range: Range = '30', open = false;
    const row = document.createElement('div'); row.className = 'gr-row';
    const panel = document.createElement('div'); panel.className = 'gr-panel'; panel.hidden = true;
    const draw = () => {
      for (const b of row.querySelectorAll<HTMLButtonElement>('.gr-chip')) b.setAttribute('aria-pressed', String(open && b.dataset.metric === metric));
      panel.hidden = !open; more.textContent = open ? 'Hide the chart' : 'Show the chart';
      if (!open) return;
      const cut = sliceRange(d, range), xs = cut.series[metric], total = xs.reduce((a, b) => a + b, 0);
      const bar = document.createElement('div'); bar.className = 'gr-bar';
      const sel = document.createElement('select'); sel.setAttribute('aria-label', 'What to show');
      for (const m of METRICS) { const o = document.createElement('option'); o.value = m; o.textContent = METRIC_WORDS[m].menu; o.selected = m === metric; sel.append(o); }
      sel.onchange = () => { metric = sel.value as Metric; draw(); sel.focus(); };
      const rg = document.createElement('div'); rg.className = 'gr-r'; rg.setAttribute('role', 'group'); rg.setAttribute('aria-label', 'Time range');
      for (const [r, label] of RANGES) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.setAttribute('aria-pressed', String(r === range)); b.onclick = () => { range = r; draw(); }; rg.append(b); }
      const sum = document.createElement('span'); sum.className = 'gr-sum'; sum.textContent = `${n(total)} in ${cut.days.length === 1 ? '1 day' : `${cut.days.length} days`}`;
      bar.append(sel, rg, sum);
      panel.replaceChildren(bar, drawChart(cut, metric));
    };
    for (const m of CHIPS) {
      const xs = d.series[m], today = xs[xs.length - 1] ?? 0;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'gr-chip'; b.dataset.metric = m; b.style.setProperty('--c', COLOR[m]); b.setAttribute('aria-pressed', 'false');
      b.title = `${METRIC_WORDS[m].menu} each day. Click for the chart.`;
      const t = document.createElement('div');
      const v = document.createElement('div'); v.className = 'gr-v'; v.textContent = n(today);
      const l = document.createElement('div'); l.className = 'gr-l'; l.textContent = today === 1 ? METRIC_WORDS[m].one : METRIC_WORDS[m].chip;
      t.append(v, l); b.append(t, spark(xs, COLOR[m]));
      b.onclick = () => { open = !(open && metric === m); metric = m; draw(); };
      row.append(b);
    }
    const more = document.createElement('button'); more.type = 'button'; more.className = 'gr-more'; more.onclick = () => { open = !open; draw(); };
    row.append(more); host.append(row, panel); draw();
    host.style.display = '';
  });
}
