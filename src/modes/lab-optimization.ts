import { mountLabsNav } from "../ui/labs-nav";
import type { CourseData } from "../course/course";
import { playPlan } from "../sim/ideal";
import { TICKS_PER_SECOND } from "../sim/units";
import { labsOn } from "../ui/labs";
import { labDefaultNote, labPopulated } from "../ui/lab-default";
import { DEFAULTS, FAIL_BASE, PROBLEMS, findPeaks, peakOf, tableScore, valueAt, type Method, type Peak, type Problem, type Settings, type Table, type Trace } from "../labs/optimization/core";

// Optimization (CC-118). The player picks which two settings to tune and how to search, the REAL simulator scores each try (in a worker), and the page shows the whole map of finishing time.
// Nothing here talks or grades: it shows numbers and a picture. The maths is in a box that starts closed. Behind the labs switch (?labs=1).
const INK = "#17201d", TEAL = "#0f6b5c";
const METHODS: [Method, string, string][] = [
  ["grid", "Grid", "Try settings on an even lattice, every few steps along each axis, and keep the fastest."],
  ["hill", "Hill-climb", "Start from the cell you click, look at the 8 neighbours, step to the fastest one, and stop when none is faster."],
  ["random", "Random restarts", "Hill-climb again and again from random cells; keep the fastest place any of them stopped."],
];
const SHAPE: Record<Method, "square" | "circle" | "triangle"> = { grid: "square", hill: "circle", random: "triangle" };
const DASH: Record<Method, number[]> = { grid: [], hill: [], random: [5, 4] };
const PEAK_NOTE = "A local peak is a setting that beats all 8 neighbours. A hill-climb that reaches one has nowhere better to step, even if a faster peak exists elsewhere.";

// colour-blind safe: a viridis-style ramp (fast = light yellow, slow = dark purple); cells that never clear are hatched grey
const RAMP: [number, number, number][] = [[253, 231, 37], [94, 201, 98], [33, 145, 140], [59, 82, 139], [68, 1, 84]];
const rampAt = (u: number): string => {
  const x = Math.max(0, Math.min(1, u)) * (RAMP.length - 1), k = Math.min(RAMP.length - 2, Math.floor(x)), f = x - k;
  const c = RAMP[k].map((v, n) => Math.round(v + (RAMP[k + 1][n] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};
interface Loaded { problem: Problem; course: CourseData; table: Table; score: (i: number, j: number) => number; peaks: Peak[]; lo: number; hi: number }

export function startLabOptimization(host: HTMLElement): { backend: "canvas2d" } {
  const root = document.createElement("div");
  root.id = "lab-optimization";
  root.style.cssText = `position:fixed;inset:0;overflow:auto;background:#f5f7f4;color:${INK};font:15px/1.4 system-ui,sans-serif`;
  host.append(root);
  mountLabsNav(host, "lab-optimization");
  if (!labsOn()) {
    root.innerHTML = `<div style="max-width:520px;margin:12vh auto;padding:0 16px"><h1 style="font-size:22px">Optimization</h1><p>Labs are switched off.</p><p><a href="?mode=lab-optimization&labs=1" style="color:${TEAL}">Switch labs on</a></p></div>`;
    return { backend: "canvas2d" };
  }
  const style = document.createElement("style");
  style.textContent = `
    #lab-optimization .wrap{max-width:1080px;margin:0 auto;padding:16px;display:grid;gap:14px}
    #lab-optimization h1{font-size:22px;margin:0}#lab-optimization h2{font-size:15px;margin:0 0 6px}
    #lab-optimization .grid{display:grid;grid-template-columns:minmax(260px,330px) minmax(0,1fr);gap:14px;align-items:start}
    #lab-optimization .card{background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:12px}
    #lab-optimization label{display:grid;gap:2px;margin:8px 0}#lab-optimization input[type=range]{width:100%}
    #lab-optimization .opts{display:grid;gap:6px}
    #lab-optimization .opts button{font:600 14px system-ui;text-align:left;padding:8px;border:1px solid #b9c4bb;border-radius:8px;background:#fff;color:${INK};cursor:pointer}
    #lab-optimization .opts button[aria-pressed=true]{border-color:${TEAL};background:#e6f2ee}
    #lab-optimization .opts small{display:block;font-weight:400;color:#52605a}
    #lab-optimization .go{font:700 15px system-ui;padding:10px 14px;border:0;border-radius:8px;background:${TEAL};color:#fff;cursor:pointer;width:100%;margin-top:6px}
    #lab-optimization .go:disabled{opacity:.6;cursor:default}
    #lab-optimization table{border-collapse:collapse;width:100%;font-size:13px}#lab-optimization th,#lab-optimization td{text-align:left;padding:3px 8px 3px 0;border-bottom:1px solid #e3e8e4;vertical-align:top}
    #lab-optimization .small{color:#52605a;font-size:13px}
    #lab-optimization .eq{font:14px/1.6 ui-monospace,Menlo,monospace;background:#f1f4f1;border-radius:8px;padding:8px 10px;white-space:pre-wrap;overflow-x:auto;margin:6px 0}
    #lab-optimization summary{cursor:pointer;font-weight:700}
    #lab-optimization a.back{color:${TEAL};font-weight:600}
    #lab-optimization .legend{display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-top:6px}
  `;
  root.append(style);
  const wrap = document.createElement("div"); wrap.className = "wrap"; root.append(wrap);
  wrap.innerHTML = `
    <div><a class="back" href="/?welcome=0">Back to the game</a>
    <h1 id="lo-h1">Optimization</h1>
    <p class="small" style="margin:4px 0 0">The goal: find the settings that finish the course fastest, without trying every one. Pick which settings to tune and how to search. Each try is a real run of the game's simulator.</p></div>
    <div class="grid">
      <div class="card">
        <h2>Your choices</h2>
        <div class="opts" id="lo-problems" role="group" aria-label="Settings to tune"></div>
        <h2 style="margin-top:12px">Search method</h2>
        <div class="opts" id="lo-methods" role="group" aria-label="Search method"></div>
        <label id="lo-grid-row">Grid spacing: every <b id="lo-grid-v"></b> steps<input id="lo-grid" type="range" min="2" max="12" step="1"></label>
        <label id="lo-rest-row">Random restarts: <b id="lo-rest-v"></b><input id="lo-rest" type="range" min="2" max="20" step="1"></label>
        <label>Most simulator runs a method may use: <b id="lo-bud-v"></b><input id="lo-bud" type="range" min="0" max="5" step="1"></label>
        <p class="small" id="lo-start" style="margin:6px 0">Click the map to choose where the hill-climb starts.</p>
        <button class="go" id="lo-run">Run the chosen searches</button>
      </div>
      <div style="display:grid;gap:14px;min-width:0">
        <div class="card"><h2 id="lo-title">The map</h2>
          <p class="small" id="lo-goal" style="margin:0 0 6px"></p>
          <canvas id="lo-map" width="900" height="460" style="width:100%;height:auto;display:block;border-radius:6px;background:#eef3ee;cursor:crosshair"></canvas>
          <div class="legend small" id="lo-legend"></div>
          <p class="small" id="lo-hover" style="margin:6px 0 0;min-height:1.4em"></p></div>
        <div class="card" id="lo-out"><h2>What each method did</h2><p class="small" id="lo-none">Run a search to see the numbers here.</p><table id="lo-table" hidden><thead><tr><th>Method</th><th>Runs used</th><th>Stopped at</th><th>Best time found</th><th>Seconds slower than the map's best</th><th>Matched the fastest peak?</th></tr></thead><tbody id="lo-rows"></tbody></table><p class="small" id="lo-note" style="margin:8px 0 0" hidden></p></div>
        <div class="card" id="lo-peaks"><h2>The local peaks on this map</h2><p class="small" style="margin:0 0 6px">${PEAK_NOTE}</p><table><thead><tr><th>Peak</th><th>Settings</th><th>Time</th><th>Cells that lead down to it</th></tr></thead><tbody id="lo-peak-rows"></tbody></table></div>
        <div class="card"><details id="lo-maths"><summary>The maths</summary>
          <p class="small">The objective: the finishing time as a function of the two settings.</p>
          <div class="eq">T(a, b) = ticks(a, b) / 120   if the run clears
T(a, b) = ${FAIL_BASE} + (metres still to go)   if it does not</div>
          <p class="small">A gradient step would move against the slope: (a, b) ← (a, b) − η ∇T. The simulator gives no formula for ∇T, so the climb here uses finite differences, the same idea.</p>
          <div class="eq">∂T/∂a ≈ ( T(a + h, b) − T(a − h, b) ) / 2h
step to the neighbour n with the lowest T(n), if T(n) &lt; T(here)</div>
          <p class="small">Why a hill-climb sticks: it stops at a point where no neighbour is lower, ∇T ≈ 0 and every direction goes up. That is a local minimum of time (a local peak of speed). Another basin can hold a lower value, and a climb never crosses the ridge between them, because crossing means first getting slower.</p>
          <div class="eq">cost of a grid:  runs = ⌈n<sub>a</sub> / s⌉ × ⌈n<sub>b</sub> / s⌉     (spacing s)
cost of restarts:  runs ≈ k × (steps per climb × 8)</div>
          <p class="small">A coarse grid is cheap and sees every basin, but its answer is only as fine as the spacing. Hill-climbing is fine-grained but sees only the basin it starts in. Random restarts spend several climbs to see several basins.</p></details></div>
        <div class="card" id="lo-ours" hidden><h2>What the game picks</h2><p id="lo-ours-p" style="margin:0 0 6px"></p><p id="lo-ours-why" class="small" style="margin:0"></p></div>
      </div>
    </div>`;
  const $ = <T extends HTMLElement>(id: string): T => wrap.querySelector("#" + id) as T;
  const BUDGETS = [50, 100, 200, 400, 1000, 3000];
  const cfg: Settings = { ...DEFAULTS, grid: 6, restarts: 8, budget: 400 };
  const chosen = new Set<Method>(["grid", "hill", "random"]);
  let cur: Loaded | null = null;
  let probIdx = 1; // the drone map has exactly two peaks: the clearest first lesson
  let traces: Trace[] = [];
  let hover: { i: number; j: number } | null = null;
  const loaded = new Map<string, Loaded>();

  const load = async (p: Problem): Promise<Loaded> => {
    const hit = loaded.get(p.id); if (hit) return hit;
    const [course, table] = await Promise.all([fetch(p.courseUrl).then((r) => r.json() as Promise<CourseData>), fetch(`/assets/lab/opt-${p.id}.table.json`).then((r) => r.json() as Promise<Table>)]);
    const score = tableScore(table, course.finishX);
    let lo = Infinity, hi = -Infinity;
    for (let j = 0; j < table.ny; j++) for (let i = 0; i < table.nx; i++) { const s = score(i, j); if (s < FAIL_BASE) { lo = Math.min(lo, s); hi = Math.max(hi, s); } }
    const L = { problem: p, course, table, score, peaks: findPeaks(score, table.nx, table.ny), lo, hi };
    loaded.set(p.id, L); return L;
  };

  // ---- the map ----
  const canvas = $<HTMLCanvasElement>("lo-map");
  const g = canvas.getContext("2d")!;
  const M = { l: 70, r: 12, t: 10, b: 44 };
  const plot = () => ({ w: canvas.width - M.l - M.r, h: canvas.height - M.t - M.b });
  const cellXY = (L: Loaded, i: number, j: number) => { const { w, h } = plot(); return { x: M.l + ((i + 0.5) / L.table.nx) * w, y: M.t + h - ((j + 0.5) / L.table.ny) * h }; };
  const marker = (x: number, y: number, shape: "square" | "circle" | "triangle" | "diamond", size: number, fill: string, stroke = "#000") => {
    g.beginPath();
    if (shape === "square") g.rect(x - size, y - size, size * 2, size * 2);
    else if (shape === "circle") g.arc(x, y, size, 0, 7);
    else if (shape === "triangle") { g.moveTo(x, y - size * 1.2); g.lineTo(x + size * 1.1, y + size * 0.9); g.lineTo(x - size * 1.1, y + size * 0.9); g.closePath(); }
    else { g.moveTo(x, y - size * 1.3); g.lineTo(x + size * 1.3, y); g.lineTo(x, y + size * 1.3); g.lineTo(x - size * 1.3, y); g.closePath(); }
    g.fillStyle = fill; g.fill(); g.lineWidth = 2; g.strokeStyle = stroke; g.stroke();
  };
  const hatch = (() => { const c = document.createElement("canvas"); c.width = c.height = 8; const q = c.getContext("2d")!; q.fillStyle = "#e4e8e5"; q.fillRect(0, 0, 8, 8); q.strokeStyle = "#9aa5a0"; q.lineWidth = 1.2; q.beginPath(); q.moveTo(0, 8); q.lineTo(8, 0); q.stroke(); return c; })();
  const draw = () => {
    const L = cur; if (!L) return;
    const { w, h } = plot(), W = canvas.width, H = canvas.height;
    g.clearRect(0, 0, W, H); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
    const cw = w / L.table.nx, ch = h / L.table.ny;
    const pat = g.createPattern(hatch, "repeat")!;
    for (let j = 0; j < L.table.ny; j++) for (let i = 0; i < L.table.nx; i++) {
      const s = L.score(i, j);
      g.fillStyle = s >= FAIL_BASE ? pat : rampAt((s - L.lo) / (L.hi - L.lo));
      g.fillRect(M.l + i * cw, M.t + h - (j + 1) * ch, Math.ceil(cw), Math.ceil(ch));
    }
    g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(M.l, M.t, w, h);
    g.fillStyle = INK; g.font = "12px system-ui"; g.textAlign = "center";
    const [ax, ay] = L.problem.axes;
    for (let i = 0; i < L.table.nx; i += Math.ceil(L.table.nx / 8)) { const p = cellXY(L, i, 0); g.fillText(String(valueAt(ax, i)), p.x, M.t + h + 14); }
    g.fillText(`${ax.label} (${ax.unit})`, M.l + w / 2, H - 8);
    g.textAlign = "right";
    for (let j = 0; j < L.table.ny; j += Math.ceil(L.table.ny / 8)) { const p = cellXY(L, 0, j); g.fillText(String(valueAt(ay, j)), M.l - 6, p.y + 4); }
    g.save(); g.translate(14, M.t + h / 2); g.rotate(-Math.PI / 2); g.textAlign = "center"; g.fillText(`${ay.label} (${ay.unit})`, 0, 0); g.restore();
    // the hill-climb start
    const sp = cellXY(L, cfg.start[0], cfg.start[1]);
    g.strokeStyle = "#000"; g.lineWidth = 3; g.beginPath(); g.moveTo(sp.x - 8, sp.y); g.lineTo(sp.x + 8, sp.y); g.moveTo(sp.x, sp.y - 8); g.lineTo(sp.x, sp.y + 8); g.stroke();
    g.strokeStyle = "#fff"; g.lineWidth = 1.2; g.stroke();
    // the paths
    for (const t of traces) {
      g.strokeStyle = "#fff"; g.lineWidth = 3; g.setLineDash(DASH[t.method]);
      if (t.method !== "grid") { g.beginPath(); t.path.forEach((p, n) => { const c = cellXY(L, p.i, p.j); n ? g.lineTo(c.x, c.y) : g.moveTo(c.x, c.y); }); g.stroke(); }
      g.setLineDash([]);
      if (t.method === "grid") for (const p of t.path) { const c = cellXY(L, p.i, p.j); g.fillStyle = "#fff"; g.fillRect(c.x - 1.5, c.y - 1.5, 3, 3); }
    }
    for (const t of traces) for (const s of t.stops) { const c = cellXY(L, s.i, s.j); marker(c.x, c.y, SHAPE[t.method], 6, s.score >= FAIL_BASE ? "#e4e8e5" : "#fff"); }
    // the local peaks, lettered
    for (const p of L.peaks) { const c = cellXY(L, p.i, p.j); g.fillStyle = "#000"; g.fillRect(c.x + 8, c.y - 22, 18, 18); g.fillStyle = "#fff"; g.font = "bold 13px system-ui"; g.textAlign = "center"; g.fillText(p.label, c.x + 17, c.y - 9); }
    // our pick, last
    const ours = oursCell(L);
    if (ours && shownOurs) { const c = cellXY(L, ours.i, ours.j); marker(c.x, c.y, "diamond", 7, "#CC79A7"); }
    if (hover) { const c = cellXY(L, hover.i, hover.j); g.strokeStyle = "#000"; g.lineWidth = 1.5; g.strokeRect(c.x - cw / 2, c.y - ch / 2, cw, ch); }
  };
  let shownOurs = false;
  const oursCell = (L: Loaded): { i: number; j: number } | null => {
    const plan = L.course.plan; if (!plan) return null;
    const x = L.problem.id === "rope" ? plan.jumpXs[0] : plan.droneBrakeX!, y = L.problem.id === "rope" ? plan.releaseAfter : plan.droneDescendX!;
    const [ax, ay] = L.problem.axes;
    return { i: Math.round((x - ax.min) / ax.step), j: Math.round((y - ay.min) / ay.step) };
  };
  const cellAt = (e: MouseEvent): { i: number; j: number } | null => {
    const L = cur; if (!L) return null;
    const r = canvas.getBoundingClientRect(), k = canvas.width / r.width;
    const px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k, { w, h } = plot();
    const i = Math.floor(((px - M.l) / w) * L.table.nx), j = Math.floor(((M.t + h - py) / h) * L.table.ny);
    return i >= 0 && j >= 0 && i < L.table.nx && j < L.table.ny ? { i, j } : null;
  };
  const describe = (L: Loaded, i: number, j: number): string => { const s = L.score(i, j), [ax, ay] = L.problem.axes; return `${ax.label} ${valueAt(ax, i)} ${ax.unit}, ${ay.label} ${valueAt(ay, j)} ${ay.unit}: ${s >= FAIL_BASE ? "does not clear" : s.toFixed(2) + " s"}`; };
  canvas.addEventListener("mousemove", (e) => { hover = cellAt(e); $("lo-hover").textContent = cur && hover ? describe(cur, hover.i, hover.j) : ""; draw(); });
  canvas.addEventListener("mouseleave", () => { hover = null; draw(); });
  canvas.addEventListener("click", (e) => { const c = cellAt(e); if (c && cur) { cfg.start = [c.i, c.j]; sync(); draw(); } });

  // ---- the page's controls ----
  const sync = () => {
    const probs = $("lo-problems"); probs.innerHTML = "";
    PROBLEMS.forEach((p, n) => { const b = document.createElement("button"); b.type = "button"; b.dataset.problem = p.id; b.setAttribute("aria-pressed", String(n === probIdx)); b.innerHTML = `${p.title}<small>${p.settings}</small>`; b.onclick = () => { probIdx = n; traces = []; shownOurs = false; $("lo-ours").hidden = true; $("lo-table").hidden = true; $("lo-note").hidden = true; $("lo-none").hidden = false; void open(); }; probs.append(b); });
    const ms = $("lo-methods"); ms.innerHTML = "";
    for (const [m, label, about] of METHODS) { const b = document.createElement("button"); b.type = "button"; b.dataset.method = m; b.setAttribute("aria-pressed", String(chosen.has(m))); b.innerHTML = `${label}<small>${about}</small>`; b.onclick = () => { if (chosen.has(m)) { if (chosen.size > 1) chosen.delete(m); } else chosen.add(m); sync(); }; ms.append(b); }
    $("lo-grid-row").hidden = !chosen.has("grid"); $("lo-rest-row").hidden = !chosen.has("random");
    $("lo-grid-v").textContent = String(cfg.grid); $("lo-rest-v").textContent = String(cfg.restarts); $("lo-bud-v").textContent = String(cfg.budget);
    if (cur) $("lo-start").textContent = `Hill-climb start: ${cur.problem.axes[0].label} ${valueAt(cur.problem.axes[0], cfg.start[0])}, ${cur.problem.axes[1].label} ${valueAt(cur.problem.axes[1], cfg.start[1])}. Click the map to move it.`;
  };
  const bind = (id: string, set: (v: number) => void) => $<HTMLInputElement>(id).addEventListener("input", (e) => { set(Number((e.target as HTMLInputElement).value)); sync(); });
  bind("lo-grid", (v) => (cfg.grid = v)); bind("lo-rest", (v) => (cfg.restarts = v)); bind("lo-bud", (v) => (cfg.budget = BUDGETS[v]));
  $<HTMLInputElement>("lo-grid").value = String(cfg.grid); $<HTMLInputElement>("lo-rest").value = String(cfg.restarts); $<HTMLInputElement>("lo-bud").value = String(BUDGETS.indexOf(cfg.budget));

  const open = async () => {
    const p = PROBLEMS[probIdx];
    cur = await load(p);
    cfg.start = [...p.start];
    $("lo-title").textContent = `The map: ${p.title}`;
    $("lo-goal").textContent = `Every cell is one pair of settings, played in the real simulator. Colour is the finishing time: light is fast, dark is slow. Hatched cells never finish. Click to place the hill-climb start; hover to read a cell.`;
    $("lo-legend").innerHTML = `<span><svg width="120" height="14" style="vertical-align:middle"><defs><linearGradient id="lo-g">${RAMP.map((c, n) => `<stop offset="${(n / (RAMP.length - 1)) * 100}%" stop-color="rgb(${c})"/>`).join("")}</linearGradient></defs><rect width="120" height="14" fill="url(#lo-g)" stroke="#000"/></svg> ${cur.lo.toFixed(1)} s to ${cur.hi.toFixed(1)} s</span><span>Stops: square = grid, circle = hill-climb, triangle = random restarts</span><span>Black letter box = local peak</span><span>Pink diamond = what the game picks</span>`;
    const rows = $("lo-peak-rows"); rows.innerHTML = "";
    for (const k of cur.peaks) { const tr = document.createElement("tr"); tr.innerHTML = `<td><b>${k.label}</b>${k === cur.peaks[0] ? " (fastest)" : ""}</td><td>${valueAt(p.axes[0], k.i)} ${p.axes[0].unit}, ${valueAt(p.axes[1], k.j)} ${p.axes[1].unit}</td><td>${k.score.toFixed(2)} s</td><td>${k.basin} of ${cur.table.nx * cur.table.ny}</td>`; rows.append(tr); }
    sync(); draw();
    runBtn.click(); // CC-118: opens already run at our setting: all three searches, from the problem's own start
  };

  // ---- running ----
  let worker: Worker | null = null;
  let job = 0;
  const runBtn = $<HTMLButtonElement>("lo-run");
  const roundNote = (L: Loaded, t: Trace): string => t.stops.map((s) => { const k = peakOf(L.peaks, s.i, s.j); return s.score >= FAIL_BASE ? "a place that never clears" : k ? `peak ${k.label}` : "a small bump"; }).filter((v, n, a) => a.indexOf(v) === n).join(", ") || "-";
  const finish = (L: Loaded, ts: Trace[], wallMs: number) => {
    traces = ts; shownOurs = true;
    $("lo-none").hidden = true; $("lo-table").hidden = false;
    const rows = $("lo-rows"); rows.innerHTML = "";
    const best = L.peaks[0];
    for (const t of ts) {
      const bk = peakOf(L.peaks, t.best.i, t.best.j);
      const gap = t.best.score < FAIL_BASE ? t.best.score - best.score : null;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${METHODS.find(([m]) => m === t.method)![1]}</td><td>${t.evals}${t.budgetHit ? " (budget hit)" : ""}</td><td>${roundNote(L, t)}${t.stops.length > 1 ? ` (${t.stops.length} stops)` : ""}</td><td>${t.best.score < FAIL_BASE ? t.best.score.toFixed(2) + " s" : "nothing cleared"}</td><td>${gap === null ? "-" : gap.toFixed(2)}</td><td>${gap !== null && gap <= 0.05 ? "yes" : "no" + (bk ? `, best is in peak ${bk.label}'s slope` : "")}</td>`;
      rows.append(tr);
    }
    $("lo-note").hidden = false;
    $("lo-note").textContent = `The whole map has ${L.table.nx * L.table.ny} cells, so trying all of them would cost ${L.table.nx * L.table.ny} runs. The searches took ${wallMs} ms.`;
    const ours = oursCell(L)!; const p = L.course.plan!; const prob = L.problem;
    const ob = playPlan(L.course, prob.planFor(prob.id === "rope" ? p.jumpXs[0] : p.droneBrakeX!, prob.id === "rope" ? p.releaseAfter : p.droneDescendX!), prob.cap);
    const oursS = ob.world.outcome === "cleared" ? ob.world.runner.tick / TICKS_PER_SECOND : null;
    let ok = 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const a = ours.i + di, b = ours.j + dj; if (a >= 0 && b >= 0 && a < L.table.nx && b < L.table.ny && L.score(a, b) < FAIL_BASE) ok++; }
    const settings = prob.id === "rope" ? `jump press at ${p.jumpXs[0]} m, let go ${p.releaseAfter} ticks after catching the rope` : `brake from ${p.droneBrakeX} m, climb down from ${p.droneDescendX} m`;
    $("lo-ours").hidden = false;
    $("lo-ours-p").textContent = `The game picks: ${settings}. That finishes in ${oursS === null ? "no time (it does not clear)" : oursS.toFixed(2) + " s"}, against ${best.score.toFixed(2)} s for the fastest peak on the map. ${ok} of its 8 neighbouring cells also clear.`;
    $("lo-ours-why").textContent = prob.id === "rope"
      ? "Why: the game's search tries every jump press with 21 different release times, keeps the presses that reach farthest, and takes the middle of that run of presses; it then centres the release in its window of working values. It trades a little time for a pick that still clears when a press is a little early or late. The fastest cell sits right against a cliff of failures."
      : "Why: the game's search tries a lattice of brake and climb-down points two metres apart (about 210 runs), then a finer half-metre lattice (81 runs) around the fastest clear, and keeps the fastest. The ridge of working settings is narrow here, so the fastest line runs close to the cliff on purpose: a ferry has no rider timing to forgive.";
    draw();
    labPopulated("lab-optimization");
  };
  runBtn.onclick = async () => {
    if (!cur) return;
    const L = cur; runBtn.disabled = true; runBtn.textContent = "Running the simulator...";
    worker?.terminate();
    worker = new Worker(new URL("../labs/optimization/worker.ts", import.meta.url), { type: "module" });
    const id = ++job;
    worker.onmessage = (e) => {
      const d = e.data;
      if (d.id !== id) return;
      if (d.done) { finish(L, d.traces as Trace[], d.wallMs); runBtn.disabled = false; runBtn.textContent = "Run the chosen searches"; worker?.terminate(); worker = null; }
      else runBtn.textContent = `Running: ${d.method} has used ${d.evals} runs`;
    };
    worker.postMessage({ id, problem: L.problem.id, course: L.course, methods: METHODS.map(([m]) => m).filter((m) => chosen.has(m)), cfg });
  };
  labDefaultNote(wrap, "live", $("lo-h1"));
  void open();
  return { backend: "canvas2d" };
}
