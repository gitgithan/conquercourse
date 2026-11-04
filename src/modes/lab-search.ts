import { mountLabsNav } from "../ui/labs-nav";
import type { CourseData } from "../course/course";
import { DEFAULT_CONFIG, clampCfg, runLabSearch, pathOf, planFor, type LabConfig, type LabResult, type Method } from "../lab/search-lab";
import { labsOn } from "../ui/labs";
import { labDefaultNote, labPopulated } from "../ui/lab-default";

// Search (CC-118). The player picks how the game looks for a clear run, mixes a heuristic, sets a budget, runs the real simulator and reads facts.
// Nothing here talks or grades: it shows numbers and a picture. The equations come last, after a run. Behind the labs switch (?labs=1).
const COURSE_URL = "/assets/lab/search-trap.course.json";
const INK = "#17201d", TEAL = "#0f6b5c", GHOST = "#9aa5a0", DECK = "#cbd5cd", WATER = "#b7d3ee", BAD = "#b91c1c";
const METHODS: [Method, string, string][] = [
  ["greedy", "Greedy", "At each edge keep only the press whose landing scores best, then move on."],
  ["beam", "Beam", "Keep the best few presses at each edge, not just one."],
  ["astar", "A*", "Always continue the branch with the least time so far plus the time still to go, as guessed from the heuristic."],
  ["exhaustive", "Exhaustive", "Try every press at every edge; keep the fastest clear."],
];
const BUDGETS = [20, 50, 100, 300, 1000, 3000];
// Our setting (CC-118): a beam of 8 clears the trap with the fewest simulator runs (77 against 121 for A* and exhaustive) and as fast as the game's line; greedy is stranded and a beam of 2 too.
const OUR: Partial<LabConfig> = { method: "beam", beam: 8, wDist: 1, wSpeed: 0, wHeight: 0, budget: 3000 };

interface Done { result: LabResult; found: { x: number; y: number }[]; ours: { x: number; y: number }[]; wallMs: number }

export function startLabSearch(host: HTMLElement): { backend: "canvas2d" } {
  const root = document.createElement("div");
  root.id = "lab-search";
  root.style.cssText = `position:fixed;inset:0;overflow:auto;background:#f5f7f4;color:${INK};font:15px/1.4 system-ui,sans-serif`;
  host.append(root);
  mountLabsNav(host, "lab-search");
  if (!labsOn()) {
    root.innerHTML = `<div style="max-width:520px;margin:12vh auto;padding:0 16px"><h1 style="font-size:22px">Search</h1><p>Labs are switched off.</p><p><a href="?mode=lab-search&labs=1" style="color:${TEAL}">Switch labs on</a></p></div>`;
    return { backend: "canvas2d" };
  }
  const style = document.createElement("style");
  style.textContent = `
    #lab-search .wrap{max-width:1040px;margin:0 auto;padding:16px;display:grid;gap:14px}
    #lab-search h1{font-size:22px;margin:0}#lab-search h2{font-size:15px;margin:0 0 6px}
    #lab-search .grid{display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr);gap:14px;align-items:start}
    @media (max-width:760px){#lab-search .grid{grid-template-columns:minmax(0,1fr)}}
    #lab-search .card{background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:12px}
    #lab-search label{display:grid;gap:2px;margin:8px 0}#lab-search input[type=range]{width:100%}
    #lab-search .meth{display:grid;grid-template-columns:1fr 1fr;gap:6px}
    #lab-search .meth button{font:600 14px system-ui;padding:8px;border:1px solid #b9c4bb;border-radius:8px;background:#fff;color:${INK};cursor:pointer}
    #lab-search .meth button[aria-pressed=true]{border-color:${TEAL};background:#e6f2ee}
    #lab-search .go{font:700 15px system-ui;padding:10px 14px;border:0;border-radius:8px;background:${TEAL};color:#fff;cursor:pointer;width:100%;margin-top:6px}
    #lab-search .go:disabled{opacity:.6;cursor:default}
    #lab-search .facts{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:0}
    #lab-search .facts dt{color:#52605a}#lab-search .facts dd{margin:0;font-weight:600}
    #lab-search table{border-collapse:collapse;width:100%;font-size:13px}#lab-search th,#lab-search td{text-align:left;padding:3px 8px 3px 0;border-bottom:1px solid #e3e8e4}
    #lab-search .small{color:#52605a;font-size:13px}
    #lab-search .eq{font:14px/1.6 ui-monospace,Menlo,monospace;background:#f1f4f1;border-radius:8px;padding:8px 10px;white-space:pre-wrap;overflow-x:auto}
    #lab-search button.link{background:none;border:0;color:${TEAL};font:600 14px system-ui;cursor:pointer;padding:0;text-decoration:underline}
    #lab-search a.back{color:${TEAL};font-weight:600}
  `;
  root.append(style);
  const wrap = document.createElement("div"); wrap.className = "wrap"; root.append(wrap);
  wrap.innerHTML = `
    <div><a class="back" href="/?welcome=0">Back to the game</a>
    <h1 id="ls-h1">Search</h1>
    <p class="small" style="margin:4px 0 0">The goal: find a clear run through three gaps. Each gap needs one jump press. The game tries presses in the real simulator, and you decide how it chooses which to try.</p></div>
    <div class="grid">
      <div class="card" id="ls-controls">
        <h2>Your choices</h2>
        <div class="meth" id="ls-methods" role="group" aria-label="Method"></div>
        <p class="small" id="ls-about" style="margin:6px 0"></p>
        <label id="ls-beam-row">Beam width: <b id="ls-beam-v"></b><input id="ls-beam" type="range" min="1" max="20" step="1"></label>
        <div id="ls-heur">
          <label>Value distance gained: <b id="ls-wd-v"></b><input id="ls-wd" type="range" min="0" max="1" step="0.05"></label>
          <label>Value speed kept: <b id="ls-ws-v"></b><input id="ls-ws" type="range" min="0" max="1" step="0.05"></label>
          <label>Value height kept: <b id="ls-wh-v"></b><input id="ls-wh" type="range" min="0" max="1" step="0.05"></label>
        </div>
        <label>Target: use at most <b id="ls-bud-v"></b> simulator runs<input id="ls-bud" type="range" min="0" max="${BUDGETS.length - 1}" step="1"></label>
        <button class="go" id="ls-run">Run the search</button>
      </div>
      <div style="display:grid;gap:14px;min-width:0">
        <div class="card"><h2>The course and the line found</h2>
          <canvas id="ls-pic" width="940" height="300" style="width:100%;height:auto;display:block;border-radius:6px;background:#eef3ee"></canvas>
          <div style="display:flex;gap:12px;align-items:center;margin-top:6px"><button class="link" id="ls-play" disabled>Play it back</button><span class="small">Teal: the line you found. Grey: the game's own line.</span></div></div>
        <div class="card" id="ls-out"><h2>What happened</h2><p class="small" id="ls-none">Run the search to see facts here.</p><dl class="facts" id="ls-facts" hidden></dl></div>
        <div class="card" id="ls-hist" hidden><h2>Your runs so far</h2><table><thead><tr><th>#</th><th>Method</th><th>Mix</th><th>Runs</th><th>Result</th><th>Seconds</th></tr></thead><tbody id="ls-rows"></tbody></table></div>
        <div class="card" id="ls-ours" hidden><h2>What the game does</h2><p id="ls-ours-p" style="margin:0"></p></div>
        <div class="card" id="ls-eq" hidden><h2>The equations</h2><button class="link" id="ls-eq-btn">Show the equations behind your run</button><div class="eq" id="ls-eq-body" hidden></div></div>
      </div>
    </div>`;
  const $ = <T extends HTMLElement>(id: string): T => wrap.querySelector("#" + id) as T;
  const cfg: LabConfig = { ...DEFAULT_CONFIG, ...OUR };
  let course: CourseData | null = null;
  let last: Done | null = null;
  let history = 0;
  let animFrame = 0;

  const sync = () => {
    const methods = $("ls-methods");
    methods.innerHTML = "";
    for (const [m, label] of METHODS) {
      const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.dataset.method = m; b.setAttribute("aria-pressed", String(cfg.method === m));
      b.onclick = () => { cfg.method = m; sync(); };
      methods.append(b);
    }
    $("ls-about").textContent = METHODS.find(([m]) => m === cfg.method)![2];
    $("ls-beam-row").hidden = cfg.method !== "beam";
    $("ls-heur").hidden = cfg.method === "exhaustive";
    $("ls-beam-v").textContent = String(cfg.beam);
    $("ls-wd-v").textContent = cfg.wDist.toFixed(2); $("ls-ws-v").textContent = cfg.wSpeed.toFixed(2); $("ls-wh-v").textContent = cfg.wHeight.toFixed(2);
    $("ls-bud-v").textContent = String(cfg.budget);
  };
  const bind = (id: string, set: (v: number) => void) => { $<HTMLInputElement>(id).addEventListener("input", (e) => { set(Number((e.target as HTMLInputElement).value)); sync(); }); };
  bind("ls-beam", (v) => (cfg.beam = v)); bind("ls-wd", (v) => (cfg.wDist = v)); bind("ls-ws", (v) => (cfg.wSpeed = v)); bind("ls-wh", (v) => (cfg.wHeight = v));
  bind("ls-bud", (v) => (cfg.budget = BUDGETS[v]));
  $<HTMLInputElement>("ls-beam").value = String(cfg.beam); $<HTMLInputElement>("ls-wd").value = String(cfg.wDist); $<HTMLInputElement>("ls-ws").value = String(cfg.wSpeed); $<HTMLInputElement>("ls-wh").value = String(cfg.wHeight);
  $<HTMLInputElement>("ls-bud").value = String(BUDGETS.indexOf(cfg.budget));
  sync();

  // ---- the picture: side view of the course and the paths ----
  const canvas = $<HTMLCanvasElement>("ls-pic");
  const g = canvas.getContext("2d")!;
  const draw = (upTo: number | null) => {
    if (!course) return;
    const W = canvas.width, H = canvas.height;
    g.clearRect(0, 0, W, H);
    const x0 = -2, x1 = course.finishX + 3, y0 = -2.2, y1 = 3.2;
    const sx = (x: number) => ((x - x0) / (x1 - x0)) * W, sy = (y: number) => H - ((y - y0) / (y1 - y0)) * H;
    g.fillStyle = WATER; g.fillRect(0, sy(course.terrain.waterY ?? -2), W, H);
    g.fillStyle = DECK;
    for (const p of course.terrain.platforms) { const a = Math.max(p.x0, x0), b = Math.min(p.x1, x1); g.fillRect(sx(a), sy(p.top), sx(b) - sx(a), sy(y0) - sy(p.top)); }
    g.strokeStyle = BAD; g.lineWidth = 2; g.beginPath(); g.moveTo(sx(course.finishX), sy(-0.3)); g.lineTo(sx(course.finishX), sy(2.2)); g.stroke();
    const line = (pts: { x: number; y: number }[], colour: string, dash: number[], n: number | null) => {
      if (!pts.length) return;
      const m = n === null ? pts.length : Math.min(pts.length, n);
      g.strokeStyle = colour; g.lineWidth = 3; g.setLineDash(dash); g.beginPath();
      pts.slice(0, m).forEach((p, i) => (i ? g.lineTo(sx(p.x), sy(p.y + 0.9)) : g.moveTo(sx(p.x), sy(p.y + 0.9))));
      g.stroke(); g.setLineDash([]);
      if (n !== null && m > 0) { g.fillStyle = colour; g.beginPath(); g.arc(sx(pts[m - 1].x), sy(pts[m - 1].y + 0.9), 6, 0, 7); g.fill(); }
    };
    if (last) { line(last.ours, GHOST, [8, 6], null); line(last.found, TEAL, [], upTo); }
  };
  $<HTMLButtonElement>("ls-play").onclick = () => {
    if (!last) return;
    cancelAnimationFrame(animFrame);
    const total = last.found.length; let i = 0;
    const tick = () => { i += 1; draw(i); if (i < total) animFrame = requestAnimationFrame(tick); else draw(null); };
    tick();
  };

  // ---- running ----
  let worker: Worker | null = null;
  let job = 0;
  const runBtn = $<HTMLButtonElement>("ls-run");
  const finish = (d: Done, used: LabConfig) => {
    last = d; history++;
    const r = d.result;
    $("ls-none").hidden = true;
    const facts = $("ls-facts"); facts.hidden = false;
    const rows: [string, string][] = [
      ["Result", r.cleared ? "Cleared the course" : r.budgetHit ? "Stuck: the budget ran out" : "Stuck: every branch fell"],
      ["Simulator runs", `${r.steps} (target ${used.budget})${r.steps <= used.budget && r.cleared ? ", inside the target" : ""}`],
      ["Game time played", `${r.simSeconds} s`],
      ["Time to compute", `${(d.wallMs / 1000).toFixed(2)} s on this device`],
      ["Edges passed", `${r.reach} of ${r.edgeCount}`],
      ["Presses (m)", r.line.length ? r.line.join(", ") : "none"],
      ["Run time", r.runSeconds != null ? `${r.runSeconds.toFixed(2)} s` : "no clear"],
      ["Game's own line", r.bestSeconds != null ? `${r.bestSeconds.toFixed(2)} s` : "not stored"],
      ["Difference", r.gap != null ? `${r.gap >= 0 ? "+" : ""}${r.gap.toFixed(2)} s` : "n/a"],
    ];
    facts.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
    $("ls-hist").hidden = false;
    const tr = document.createElement("tr");
    const mix = used.method === "exhaustive" ? "all" : `${used.wDist.toFixed(1)} / ${used.wSpeed.toFixed(1)} / ${used.wHeight.toFixed(1)}`;
    tr.innerHTML = `<td>${history}</td><td>${METHODS.find(([m]) => m === used.method)![1]}${used.method === "beam" ? " " + used.beam : ""}</td><td>${mix}</td><td>${r.steps}</td><td>${r.cleared ? "cleared" : "stuck"}</td><td>${r.runSeconds != null ? r.runSeconds.toFixed(2) : "-"}</td>`;
    $("ls-rows").prepend(tr);
    // our setting comes last, after the player has a result of their own
    $("ls-ours").hidden = false;
    $("ls-ours-p").textContent = "The game searches greedily first: at each edge it takes the middle of the presses that carry the runner farthest through the whole course. When that run does not clear, it tries other presses at its last two take-off edges. It does this because a full search of every press grows very fast with each edge, while a greedy pass with a repair is cheap and clears every course in the menu. It gives up some certainty: a layout where the first edge is the trap would defeat it.";
    $("ls-eq").hidden = false;
    $<HTMLButtonElement>("ls-play").disabled = d.found.length === 0;
    cancelAnimationFrame(animFrame);
    draw(null);
    document.documentElement.dataset.labDone = String(history);
    if (history === 1) labPopulated("lab-search");
    runBtn.disabled = false; runBtn.textContent = "Run the search";
  };
  runBtn.onclick = () => {
    if (!course) return;
    const mine = clampCfg(cfg);
    runBtn.disabled = true; runBtn.textContent = "Searching";
    const id = ++job;
    const c = course;
    const inline = () => { const t = Date.now(); const result = runLabSearch(c, mine); finish({ result, found: result.line.length ? pathOf(c, planFor(result.line)) : [], ours: c.plan ? pathOf(c, c.plan) : [], wallMs: Date.now() - t }, mine); };
    try { worker ??= new Worker(new URL("../lab/search-lab-worker.ts", import.meta.url), { type: "module" }); } catch { inline(); return; }
    worker.onmessage = (e: MessageEvent) => {
      const d = e.data as { id: number; steps?: number; done?: boolean } & Partial<Done>;
      if (d.id !== id) return;
      if (d.done) finish(d as Done, mine); else runBtn.textContent = `Searching: ${d.steps} runs`;
    };
    worker.onerror = () => { worker = null; inline(); };
    worker.postMessage({ id, course: c, cfg: mine });
  };
  $<HTMLButtonElement>("ls-eq-btn").onclick = () => {
    const b = $("ls-eq-body");
    b.hidden = false;
    b.textContent =
`Landing score of a node (a list of presses):
  V = ( wd · (x − x0) / L  +  ws · min(1, vx / vmax)  +  wh · (y − ymin) / (ymax − ymin) ) / (wd + ws + wh)
  x, vx, y: where the runner lands after the last press and how fast; L: course length; vmax: top speed.
  Your weights: wd = ${cfg.wDist.toFixed(2)}, ws = ${cfg.wSpeed.toFixed(2)}, wh = ${cfg.wHeight.toFixed(2)}

Greedy and beam: keep the nodes with the largest V (1 for greedy, ${cfg.beam} for beam).

A*: expand the node with the smallest  f = g + h
  g = seconds of game time at the landing
  h = (L / vmax) · (1 − V)   a guess of the time to go; it is only safe (never too high) if V never over-states progress.

Exhaustive: all presses at all edges, so  N = n1 · n2 · … · nk  runs without pruning
  (here ${last?.result.edgeCount ?? 3} edges and about 11 presses each).`;
    $<HTMLButtonElement>("ls-eq-btn").hidden = true;
  };

  fetch(COURSE_URL).then((r) => r.json()).then((c: CourseData) => { course = c; draw(null); document.documentElement.dataset.labReady = "true"; labDefaultNote(wrap, "live", $("ls-h1")); runBtn.click(); });
  return { backend: "canvas2d" };
}
