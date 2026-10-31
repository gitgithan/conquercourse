import type { CourseData } from "../course/course";
import { DEFAULT_TIMING, binEdges, clampTiming, cdf, pInside, predictedRate, prepare, rateForWidth, runTiming, sweepSigma, BIN_MIN, BIN_MAX, BIN_MS, type Dist, type TimingConfig, type TimingResult } from "../labs/timing/core";
import { labsOn } from "../ui/labs";

// Lab 7: Statistics of timing. The player sets how shaky the button presses are, and reads how often a course clears over N runs of the real simulator.
// It shows facts about a course and a simulated presser, never a mark for a person. Equations come last. Behind the labs switch (?labs=1).
const COURSES: [string, string, string][] = [
  ["/assets/lab/search-trap.course.json", "Trap chain (3 jumps)", "Three gaps in a row; the farthest first jump strands the second."],
  ["/assets/demo/lane-1.course.json", "Lane 1 (3 jumps)", "A short lane of three plain gaps."],
  ["/assets/demo/park-rail-run.course.json", "Park rail run (5 jumps)", "Five jump presses in a row."],
  ["/assets/demo/park-run.course.json", "Park run (7 jumps)", "Seven jump presses in a row."],
];
const SHAPES: [Dist, string, string][] = [
  ["uniform", "Uniform", "Every error up to a limit is as likely as any other; none beyond it."],
  ["normal", "Normal", "Most presses are near on time; big misses are rare."],
  ["heavy", "Heavy tail", "Mostly near on time, but now and then a press is far off."],
];
const RUNS = [100, 400, 1000, 3000];
const SWEEP = [0, 15, 30, 50, 75, 100, 150, 220];
const INK = "#17201d", TEAL = "#0f6b5c", GREY = "#9aa5a0", BAD = "#b91c1c", AMBER = "#b45309";

interface Done { result: TimingResult; curve: { sigmaMs: number; rate: number; ci: { lo: number; hi: number }; predicted: number }[]; wallMs: number }
const pct = (x: number): string => `${(100 * x).toFixed(x > 0 && x < 0.1 ? 1 : 0)}%`;

export function startLabTiming(host: HTMLElement): { backend: "canvas2d" } {
  const root = document.createElement("div");
  root.id = "lab-timing";
  root.style.cssText = `position:fixed;inset:0;overflow:auto;background:#f5f7f4;color:${INK};font:15px/1.4 system-ui,sans-serif`;
  host.append(root);
  if (!labsOn()) {
    root.innerHTML = `<div style="max-width:520px;margin:12vh auto;padding:0 16px"><h1 style="font-size:22px">Lab 7: Statistics of timing</h1><p>Labs are switched off.</p><p><a href="?mode=lab-timing&labs=1" style="color:${TEAL}">Switch labs on</a></p></div>`;
    return { backend: "canvas2d" };
  }
  const style = document.createElement("style");
  style.textContent = `
    #lab-timing .wrap{max-width:1040px;margin:0 auto;padding:16px;display:grid;gap:14px}
    #lab-timing h1{font-size:22px;margin:0}#lab-timing h2{font-size:15px;margin:0 0 6px}
    #lab-timing .grid{display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr);gap:14px;align-items:start}
    #lab-timing .card{background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:12px}
    #lab-timing label{display:grid;gap:2px;margin:8px 0}#lab-timing input[type=range]{width:100%}#lab-timing select{font:14px system-ui;padding:6px;border-radius:6px;border:1px solid #b9c4bb}
    #lab-timing .seg{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
    #lab-timing .seg button{font:600 14px system-ui;padding:8px 4px;border:1px solid #b9c4bb;border-radius:8px;background:#fff;color:${INK};cursor:pointer}
    #lab-timing .seg button[aria-pressed=true]{border-color:${TEAL};background:#e6f2ee}
    #lab-timing .go{font:700 15px system-ui;padding:10px 14px;border:0;border-radius:8px;background:${TEAL};color:#fff;cursor:pointer;width:100%;margin-top:6px}
    #lab-timing .go:disabled{opacity:.6;cursor:default}
    #lab-timing .facts{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:0}
    #lab-timing .facts dt{color:#52605a}#lab-timing .facts dd{margin:0;font-weight:600}
    #lab-timing table{border-collapse:collapse;width:100%;font-size:13px}#lab-timing th,#lab-timing td{text-align:left;padding:3px 8px 3px 0;border-bottom:1px solid #e3e8e4}
    #lab-timing .small{color:#52605a;font-size:13px}
    #lab-timing .eq{font:14px/1.6 ui-monospace,Menlo,monospace;background:#f1f4f1;border-radius:8px;padding:8px 10px;white-space:pre-wrap;overflow-x:auto}
    #lab-timing button.link{background:none;border:0;color:${TEAL};font:600 14px system-ui;cursor:pointer;padding:0;text-decoration:underline}
    #lab-timing a.back{color:${TEAL};font-weight:600}
    #lab-timing canvas{width:100%;height:auto;display:block;border-radius:6px;background:#f7faf7}
  `;
  root.append(style);
  const wrap = document.createElement("div"); wrap.className = "wrap"; root.append(wrap);
  wrap.innerHTML = `
    <div><a class="back" href="/?welcome=0">Back to the game</a>
    <h1>Lab 7: Statistics of timing</h1>
    <p class="small" style="margin:4px 0 0">The goal: find how wide the press window must be for a shaky presser to clear a course half the time, and nine times in ten. A simulated presser is a little early or late on every jump. The real simulator plays the course again and again, and you read the facts. This is about the course and a simulated presser, never about you.</p></div>
    <div class="grid">
      <div class="card" id="lt-controls">
        <h2>Your choices</h2>
        <label>Course<select id="lt-course"></select></label>
        <p class="small" id="lt-course-about" style="margin:0"></p>
        <label>How shaky the presses are: <b id="lt-sigma-v"></b><input id="lt-sigma" type="range" min="0" max="200" step="5"></label>
        <div class="seg" id="lt-shape" role="group" aria-label="Shape of the shakiness"></div>
        <p class="small" id="lt-shape-about" style="margin:6px 0"></p>
        <label>Runs to play (N): <b id="lt-runs-v"></b><input id="lt-runs" type="range" min="0" max="${RUNS.length - 1}" step="1"></label>
        <button class="go" id="lt-run">Play the course N times</button>
        <p class="small" style="margin:6px 0 0">Same choices, same numbers: the random source is seeded.</p>
      </div>
      <div style="display:grid;gap:14px;min-width:0">
        <div class="card" id="lt-out"><h2>What happened</h2><p class="small" id="lt-none">Play the course to see facts here.</p><dl class="facts" id="lt-facts" hidden></dl></div>
        <div class="card" id="lt-wincard" hidden><h2>How much each press may be off (measured on the simulator, others on time, the presser aiming at the middle of each window)</h2><table><thead><tr><th>Press</th><th>Edge at</th><th>Early by up to</th><th>Late by up to</th><th>Window width</th><th>Aim moved by</th></tr></thead><tbody id="lt-wins"></tbody></table></div>
        <div class="card" id="lt-hcard" hidden><h2>How far off the press was when the run failed</h2>
          <canvas id="lt-hist" width="940" height="260"></canvas>
          <p class="small" style="margin:6px 0 0">Each bar counts failed runs by how early (left) or late (right) the press that lost the run was. The teal bars under the axis are the windows the simulator found for each press.</p></div>
        <div class="card" id="lt-ccard" hidden><h2>Clear rate as the presses get shakier</h2>
          <canvas id="lt-curve" width="940" height="260"></canvas>
          <p class="small" style="margin:6px 0 0">Dots: the simulator, with the 95% interval. Line: the maths from the measured windows. Dashed: 50% and 90%.</p></div>
        <div class="card" id="lt-wcard" hidden><h2>Window width and clear rate</h2>
          <canvas id="lt-width" width="940" height="260"></canvas>
          <p class="small" style="margin:6px 0 0">For a presser this shaky: the clear rate when every press has a window of this width, centred on the ideal press. The grey ticks mark the window of each press of this course.</p></div>
        <div class="card" id="lt-hist-card" hidden><h2>Your runs so far</h2><table><thead><tr><th>#</th><th>Course</th><th>Shaky (ms)</th><th>Shape</th><th>N</th><th>Clear rate</th><th>50% width</th><th>90% width</th></tr></thead><tbody id="lt-rows"></tbody></table></div>
        <div class="card" id="lt-ours" hidden><h2>What the game does</h2><p id="lt-ours-p" style="margin:0"></p></div>
        <div class="card" id="lt-eq" hidden><h2>The maths</h2><button class="link" id="lt-eq-btn">Show the maths behind your run</button><div class="eq" id="lt-eq-body" hidden></div></div>
      </div>
    </div>`;
  const $ = <T extends HTMLElement>(id: string): T => wrap.querySelector("#" + id) as T;
  const cfg: TimingConfig = { ...DEFAULT_TIMING };
  let courseIx = 0;
  const courses = new Map<string, CourseData>();
  let history = 0;

  const sync = () => {
    $("lt-sigma-v").textContent = `${cfg.sigmaMs} ms`;
    $("lt-runs-v").textContent = String(cfg.runs);
    $("lt-course-about").textContent = COURSES[courseIx][2];
    $("lt-shape-about").textContent = SHAPES.find(([d]) => d === cfg.dist)![2];
    const seg = $("lt-shape"); seg.innerHTML = "";
    for (const [d, label] of SHAPES) {
      const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.dataset.shape = d; b.setAttribute("aria-pressed", String(cfg.dist === d));
      b.onclick = () => { cfg.dist = d; sync(); };
      seg.append(b);
    }
  };
  const sel = $<HTMLSelectElement>("lt-course");
  COURSES.forEach(([, label], i) => { const o = document.createElement("option"); o.value = String(i); o.textContent = label; sel.append(o); });
  sel.onchange = () => { courseIx = Number(sel.value); sync(); };
  $<HTMLInputElement>("lt-sigma").value = String(cfg.sigmaMs);
  $<HTMLInputElement>("lt-sigma").addEventListener("input", (e) => { cfg.sigmaMs = Number((e.target as HTMLInputElement).value); sync(); });
  $<HTMLInputElement>("lt-runs").value = String(RUNS.indexOf(cfg.runs) >= 0 ? RUNS.indexOf(cfg.runs) : 1);
  $<HTMLInputElement>("lt-runs").addEventListener("input", (e) => { cfg.runs = RUNS[Number((e.target as HTMLInputElement).value)]; sync(); });
  sync();

  // ---- pictures ----
  const frame = (c: HTMLCanvasElement, xLabel: string, yLabel: string) => {
    const g = c.getContext("2d")!; g.clearRect(0, 0, c.width, c.height);
    const L = 54, R = 14, T = 12, B = 46;
    g.font = "12px system-ui"; g.fillStyle = INK; g.strokeStyle = "#c9d2cb"; g.lineWidth = 1;
    g.textAlign = "center"; g.fillText(xLabel, L + (c.width - L - R) / 2, c.height - 4);
    g.save(); g.translate(12, T + (c.height - T - B) / 2); g.rotate(-Math.PI / 2); g.fillText(yLabel, 0, 0); g.restore();
    return { g, L, R, T, B, w: c.width - L - R, h: c.height - T - B };
  };
  const drawHist = (r: TimingResult) => {
    const c = $<HTMLCanvasElement>("lt-hist"); const f = frame(c, "How late the press was (ms; negative is early)", "failed runs");
    const { g, L, T, w, h } = f;
    const n = r.failHist.length; // ends hold everything beyond
    const max = Math.max(1, ...r.failHist);
    const sx = (i: number) => L + (i / n) * w;
    g.fillStyle = BAD;
    r.failHist.forEach((v, i) => { const bh = (v / max) * h; g.fillRect(sx(i) + 1, T + h - bh, w / n - 2, bh); });
    g.strokeStyle = "#c9d2cb"; g.beginPath(); g.moveTo(L, T + h); g.lineTo(L + w, T + h); g.moveTo(L, T); g.lineTo(L, T + h); g.stroke();
    g.fillStyle = INK; g.textAlign = "right"; g.fillText(String(max), L - 4, T + 10); g.fillText("0", L - 4, T + h);
    g.textAlign = "center";
    const tick = (ms: number) => { const i = (ms - BIN_MIN) / BIN_MS + 1; g.fillText(String(ms), sx(i), T + h + 14); g.beginPath(); g.moveTo(sx(i), T + h); g.lineTo(sx(i), T + h + 4); g.stroke(); };
    [-400, -200, 0, 200, 400].forEach(tick);
    g.fillText("(ends: beyond ±400)", L + w - 60, T + h + 28);
    // windows
    const xMs = (ms: number) => sx(Math.max(0, Math.min(n, (ms - BIN_MIN) / BIN_MS + 1)));
    r.windows.forEach((win, i) => {
      const y = T + h + 22 + (i % 3) * 0; g.fillStyle = TEAL; g.globalAlpha = 0.55;
      g.fillRect(xMs(win.loMs), y - 5 + (i % 2) * 5, Math.max(2, xMs(win.hiMs) - xMs(win.loMs)), 4); g.globalAlpha = 1;
    });
  };
  const drawCurve = (d: Done) => {
    const c = $<HTMLCanvasElement>("lt-curve"); const f = frame(c, "How shaky the presses are (ms, standard deviation)", "clear rate");
    const { g, L, T, w, h } = f;
    const xmax = SWEEP[SWEEP.length - 1];
    const sx = (s: number) => L + (s / xmax) * w, sy = (p: number) => T + h - p * h;
    g.strokeStyle = "#c9d2cb"; g.fillStyle = INK; g.textAlign = "right";
    for (const p of [0, 0.5, 0.9, 1]) { g.setLineDash(p === 0.5 || p === 0.9 ? [5, 4] : []); g.beginPath(); g.moveTo(L, sy(p)); g.lineTo(L + w, sy(p)); g.stroke(); g.fillText(`${Math.round(p * 100)}%`, L - 4, sy(p) + 4); }
    g.setLineDash([]); g.textAlign = "center";
    for (const s of SWEEP) g.fillText(String(s), sx(s), T + h + 14);
    const wins = d.result.windows.map((x) => ({ loMs: x.loMs, hiMs: x.hiMs }));
    g.strokeStyle = TEAL; g.lineWidth = 2; g.beginPath();
    for (let s = 0; s <= xmax; s += 2) { const p = predictedRate(d.result.cfg.dist, s, wins); s ? g.lineTo(sx(s), sy(p)) : g.moveTo(sx(s), sy(p)); }
    g.stroke(); g.lineWidth = 1;
    g.fillStyle = INK; g.strokeStyle = INK;
    for (const p of d.curve) { g.beginPath(); g.moveTo(sx(p.sigmaMs), sy(p.ci.lo)); g.lineTo(sx(p.sigmaMs), sy(p.ci.hi)); g.stroke(); g.beginPath(); g.arc(sx(p.sigmaMs), sy(p.rate), 3.5, 0, 7); g.fill(); }
    g.fillStyle = AMBER; g.beginPath(); g.arc(sx(Math.min(xmax, d.result.cfg.sigmaMs)), sy(d.result.rate), 6, 0, 7); g.fill();
  };
  const drawWidth = (r: TimingResult) => {
    const c = $<HTMLCanvasElement>("lt-width"); const f = frame(c, "Window width per press (ms)", "clear rate");
    const { g, L, T, w, h } = f;
    const xmax = Math.max(400, Math.ceil((r.w90 * 1.2) / 100) * 100);
    const sx = (x: number) => L + (x / xmax) * w, sy = (p: number) => T + h - p * h;
    g.strokeStyle = "#c9d2cb"; g.fillStyle = INK; g.textAlign = "right";
    for (const p of [0, 0.5, 0.9, 1]) { g.setLineDash(p === 0.5 || p === 0.9 ? [5, 4] : []); g.beginPath(); g.moveTo(L, sy(p)); g.lineTo(L + w, sy(p)); g.stroke(); g.fillText(`${Math.round(p * 100)}%`, L - 4, sy(p) + 4); }
    g.setLineDash([]); g.textAlign = "center";
    for (let x = 0; x <= xmax; x += 100) g.fillText(String(x), sx(x), T + h + 14);
    g.strokeStyle = TEAL; g.lineWidth = 2; g.beginPath();
    for (let x = 0; x <= xmax; x += 4) { const p = rateForWidth(r.cfg.dist, r.cfg.sigmaMs, r.presses, x); x ? g.lineTo(sx(x), sy(p)) : g.moveTo(sx(x), sy(p)); }
    g.stroke(); g.lineWidth = 1;
    g.fillStyle = AMBER; g.strokeStyle = AMBER;
    for (const [x, p] of [[r.w50, 0.5], [r.w90, 0.9]] as [number, number][]) { g.beginPath(); g.arc(sx(x), sy(p), 5, 0, 7); g.fill(); g.textAlign = "left"; g.fillText(`${Math.round(x)} ms`, sx(x) + 8, sy(p) + 14); }
    g.strokeStyle = GREY;
    for (const win of r.windows) { const x = sx(Math.min(xmax, win.widthMs)); g.beginPath(); g.moveTo(x, T + h); g.lineTo(x, T + h - 10); g.stroke(); }
  };

  // ---- running ----
  let worker: Worker | null = null;
  let job = 0;
  const runBtn = $<HTMLButtonElement>("lt-run");
  const finish = (d: Done, label: string) => {
    const r = d.result;
    history++;
    $("lt-none").hidden = true;
    const facts = $("lt-facts"); facts.hidden = false;
    const rows: [string, string][] = [
      ["Clear rate", `${pct(r.rate)} (${r.clears} of ${r.runs} runs)`],
      ["95% interval", `${pct(r.ci.lo)} to ${pct(r.ci.hi)}`],
      ["Jump presses on the course", String(r.presses)],
      ["Narrowest window (the game's number)", `${Math.round(r.minWindowMs)} ms${r.windows.some((x) => x.capped) ? " (the early side is cut at 600 ms)" : ""}`],
      ["The maths says", `${pct(r.predicted)} if the presses are independent`],
      ...(r.predicted < r.ci.lo - 0.03 || r.predicted > r.ci.hi + 0.03 ? [["Maths and simulator differ", "the presses are not independent here: where one lands changes the next, so one press can make up for another"] as [string, string]] : []),
      ["Window for 50% clear", `${Math.round(r.w50)} ms per press`],
      ["Window for 90% clear", `${Math.round(r.w90)} ms per press`],
      ["Game time played", `${r.simSeconds} s in ${(d.wallMs / 1000).toFixed(1)} s on this device`],
    ];
    facts.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
    $("lt-wincard").hidden = false;
    $("lt-wins").innerHTML = r.windows.map((x) => `<tr><td>${x.index + 1}</td><td>${x.edgeX} m</td><td>${x.loMs <= -600 ? "600+" : Math.round(-x.loMs)} ms</td><td>${x.hiMs >= 600 ? "600+" : Math.round(x.hiMs)} ms</td><td><b>${Math.round(x.widthMs)}${x.capped ? "+" : ""} ms</b></td><td>${x.aimShiftMs ?? 0} ms</td></tr>`).join("");
    for (const id of ["lt-hcard", "lt-ccard", "lt-wcard", "lt-hist-card", "lt-ours", "lt-eq"]) $(id).hidden = false;
    drawHist(r); drawCurve(d); drawWidth(r);
    const fails = r.runs - r.clears;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${history}</td><td>${label}</td><td>${r.cfg.sigmaMs}</td><td>${SHAPES.find(([s]) => s === r.cfg.dist)![1]}</td><td>${r.runs}</td><td>${pct(r.rate)}${fails ? "" : ""}</td><td>${Math.round(r.w50)} ms</td><td>${Math.round(r.w90)} ms</td>`;
    $("lt-rows").prepend(tr);
    const narrow = Math.round(r.minWindowMs);
    $("lt-ours-p").textContent =
      `The game never asks how shaky a person is. It measures each press of a course as a window in milliseconds: how far a press can be early or late and still clear (src/sim/ideal.ts, the Window record). The narrowest window is the course's difficulty number; here it is ${narrow} ms. ` +
      `When a player keeps missing, Make it easier looks for the smallest change that widens that narrowest window by a quarter. The launcher's release is flagged when its window is under 250 ms, a quarter of a second, which we judged hard for a first-time player. ` +
      `We choose difficulty by window width, not by a shakiness setting, because the width is a fact about the course that the simulator measures exactly, while shakiness belongs to a person and we do not grade it. ` +
      `This Lab turns the width back into a rate for a simulated presser: at ${r.cfg.sigmaMs} ms of shakiness, ${r.presses} presses need about ${Math.round(r.w90)} ms each for nine clears in ten, and the narrowest press here is ${narrow} ms.`;
    document.documentElement.dataset.labDone = String(history);
    lastD = d;
    runBtn.disabled = false; runBtn.textContent = "Play the course N times";
  };
  let lastD: Done | null = null;
  const load = async (ix: number): Promise<CourseData> => {
    const url = COURSES[ix][0];
    if (!courses.has(url)) courses.set(url, (await (await fetch(url)).json()) as CourseData);
    return courses.get(url)!;
  };
  runBtn.onclick = async () => {
    const mine = clampTiming(cfg);
    const ix = courseIx, label = COURSES[ix][1];
    runBtn.disabled = true; runBtn.textContent = "Playing";
    const c = await load(ix);
    const id = ++job;
    const inline = () => {
      const t = Date.now(); const prep = prepare(c);
      const result = runTiming(c, mine, undefined, prep);
      if (!result) { runBtn.disabled = false; runBtn.textContent = "Play the course N times"; return; }
      finish({ result, curve: sweepSigma(c, mine, SWEEP, Math.max(100, Math.round(mine.runs / 4)), prep), wallMs: Date.now() - t }, label);
    };
    try { worker ??= new Worker(new URL("../labs/timing/worker.ts", import.meta.url), { type: "module" }); } catch { inline(); return; }
    worker.onmessage = (e: MessageEvent) => {
      const d = e.data as { id: number; progress?: number; done?: boolean } & Partial<Done>;
      if (d.id !== id) return;
      if (d.done) { if (d.result) finish(d as Done, label); else { runBtn.disabled = false; runBtn.textContent = "This course has no jump presses"; } } else runBtn.textContent = `Playing: ${d.progress} of ${mine.runs}`;
    };
    worker.onerror = () => { worker = null; inline(); };
    worker.postMessage({ id, course: c, courseKey: COURSES[ix][0], cfg: mine, sweep: SWEEP });
  };
  $<HTMLButtonElement>("lt-eq-btn").onclick = () => {
    const r = lastD?.result, b = $("lt-eq-body");
    b.hidden = false;
    $<HTMLButtonElement>("lt-eq-btn").hidden = true;
    const sd = r?.cfg.sigmaMs ?? cfg.sigmaMs;
    b.textContent =
`Your N runs: each run draws one jitter per press (a seeded random source) and the real simulator plays the course.
  c = clears, N = runs,  p̂ = c / N

95% interval for the clear rate (Wilson):
  centre = ( p̂ + z²/2N ) / ( 1 + z²/N ),   half-width = z · sqrt( p̂(1−p̂)/N + z²/4N² ) / ( 1 + z²/N ),   z = 1.96
  more runs make it narrower, about 1/sqrt(N).

One press lands inside its window [a, b] (early limit a, late limit b, measured on the simulator):
  P(press ok) = F(b) − F(a),   F = the cumulative chance of the jitter
  uniform:  F(x) = (x + s·√3) / (2·s·√3)
  normal:   F(x) = ½ · ( 1 + erf( x / (s·√2) ) )
  heavy:    F(x) = ½ + (1/π) · ( t/√3 / (1 + t²/3) + atan( t/√3 ) ),   t = x·√3 / s   (Student-t, 3 degrees of freedom)
  every shape has standard deviation s = ${sd} ms.

If the presses are independent, the course clears with chance
  P(clear) = Π P(press k ok)      ${r ? `(here ${pct(r.predicted)}; the simulator gave ${pct(r.rate)})` : ""}

Window for a target rate T with n presses, centred on the ideal press, width W:
  each press needs  q = T^(1/n)  and  F(W/2) − F(−W/2) = q,   so  W = 2 · F⁻¹( (1+q)/2 )  for a symmetric shape
  ${r ? `n = ${r.presses}: W(50%) = ${Math.round(r.w50)} ms, W(90%) = ${Math.round(r.w90)} ms` : ""}

Why windows widen with n: asking nine in ten of one press needs q = 0.9; of seven presses needs q = 0.9^(1/7) = 0.985.`;
  };
  void cdf; void pInside; void binEdges; void BIN_MAX;

  Promise.all(COURSES.map((_, i) => load(i).catch(() => null))).then(() => { document.documentElement.dataset.labReady = "true"; });
  return { backend: "canvas2d" };
}
