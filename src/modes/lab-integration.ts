import { labsOn } from "../ui/labs";
import { BOWL_START, GAME_STEPS_PER_SECOND, LENGTH_CHOICES, METHOD_INFO, STEP_CHOICES, bowlRails, clampCfg, runLab, type LabConfig, type LabResult, type Method } from "../labs/integration/engine";

// Lab 6: Numerical integration. The player picks the stepping rule and the step size, runs the cart's real equations in a worker, and reads the energy drift and whether a replay still matches.
// Nothing here talks or grades: it shows numbers and pictures. The equations sit in their own box. Behind the labs switch (?labs=1).
const INK = "#17201d", TEAL = "#0f6b5c", GHOST = "#8a958f", BAD = "#b91c1c", GRID = "#d9e0da";
const METHODS: Method[] = ["euler", "semi", "rk4"];

const pct = (n: number): string => (!Number.isFinite(n) ? "blew up" : Math.abs(n) === 0 ? "0 %" : Math.abs(n) < 1e-4 ? `${(n * 100).toExponential(1).replace("e-", " x 10^-")} %` : `${(n * 100).toPrecision(2)} %`);
const tEnd = (r: LabResult | null): number => (r ? Math.max(2, r.mine.leftTrackAt ?? r.cfg.seconds) : 10); // the picture runs to the moment your cart left the rails

export function startLabIntegration(host: HTMLElement): { backend: "canvas2d" } {
  const root = document.createElement("div");
  root.id = "lab-integration";
  root.style.cssText = `position:fixed;inset:0;overflow:auto;background:#f5f7f4;color:${INK};font:15px/1.4 system-ui,sans-serif`;
  host.append(root);
  if (!labsOn()) {
    root.innerHTML = `<div style="max-width:520px;margin:12vh auto;padding:0 16px"><h1 style="font-size:22px">Lab 6: Numerical integration</h1><p>Labs are switched off.</p><p><a href="?mode=lab-integration&labs=1" style="color:${TEAL}">Switch labs on</a></p></div>`;
    return { backend: "canvas2d" };
  }
  const style = document.createElement("style");
  style.textContent = `
    #lab-integration .wrap{max-width:1040px;margin:0 auto;padding:16px;display:grid;gap:14px}
    #lab-integration h1{font-size:22px;margin:0}#lab-integration h2{font-size:15px;margin:0 0 6px}
    #lab-integration .grid{display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr);gap:14px;align-items:start}
    #lab-integration .card{background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:12px}
    #lab-integration label{display:grid;gap:2px;margin:8px 0}#lab-integration input[type=range]{width:100%}
    #lab-integration .meth{display:grid;grid-template-columns:1fr;gap:6px}
    #lab-integration .meth button{font:600 14px system-ui;padding:8px;border:1px solid #b9c4bb;border-radius:8px;background:#fff;color:${INK};cursor:pointer;text-align:left}
    #lab-integration .meth button[aria-pressed=true]{border-color:${TEAL};background:#e6f2ee}
    #lab-integration .go{font:700 15px system-ui;padding:10px 14px;border:0;border-radius:8px;background:${TEAL};color:#fff;cursor:pointer;width:100%;margin-top:6px}
    #lab-integration .go:disabled{opacity:.6;cursor:default}
    #lab-integration .facts{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:0}
    #lab-integration .facts dt{color:#52605a}#lab-integration .facts dd{margin:0;font-weight:600}
    #lab-integration table{border-collapse:collapse;width:100%;font-size:13px}#lab-integration th,#lab-integration td{text-align:left;padding:3px 8px 3px 0;border-bottom:1px solid #e3e8e4}
    #lab-integration .small{color:#52605a;font-size:13px}
    #lab-integration .eq{font:14px/1.6 ui-monospace,Menlo,monospace;background:#f1f4f1;border-radius:8px;padding:8px 10px;white-space:pre-wrap;overflow-x:auto}
    #lab-integration button.link{background:none;border:0;color:${TEAL};font:600 14px system-ui;cursor:pointer;padding:0;text-decoration:underline}
    #lab-integration a.back{color:${TEAL};font-weight:600}
    #lab-integration .yes{color:${TEAL}}#lab-integration .no{color:${BAD}}
    #lab-integration canvas{width:100%;height:auto;display:block;border-radius:6px;background:#eef3ee}
  `;
  root.append(style);
  const wrap = document.createElement("div"); wrap.className = "wrap"; root.append(wrap);
  wrap.innerHTML = `
    <div><a class="back" href="/?welcome=0">Back to the game</a>
    <h1>Lab 6: Numerical integration</h1>
    <p class="small" style="margin:4px 0 0">The goal: a cart rolls in a smooth bowl with nothing to slow it, so its energy must never change. A computer only moves it in small steps. Pick how it steps and how big the steps are, then see how much energy it gains or loses, and whether a replay of the run still comes out exactly the same.</p></div>
    <div class="grid">
      <div class="card" id="li-controls">
        <h2>Your choices</h2>
        <div class="meth" id="li-methods" role="group" aria-label="Method"></div>
        <p class="small" id="li-about" style="margin:6px 0"></p>
        <label>Step size: <b id="li-step-v"></b><input id="li-step" type="range" min="0" max="${STEP_CHOICES.length - 1}" step="1"></label>
        <label>Target: run for <b id="li-len-v"></b><input id="li-len" type="range" min="0" max="${LENGTH_CHOICES.length - 1}" step="1"></label>
        <button class="go" id="li-run">Run the cart</button>
        <p class="small" id="li-hint" style="margin:6px 0 0"></p>
      </div>
      <div style="display:grid;gap:14px;min-width:0">
        <div class="card"><h2>The cart in the bowl</h2>
          <canvas id="li-bowl" width="940" height="190"></canvas>
          <label style="margin:6px 0 0">Time: <b id="li-t-v">0 s</b><input id="li-t" type="range" min="0" max="10" step="1" value="0" disabled></label>
          <span class="small">Teal: your run. Grey: the game's own recording. They start together.</span></div>
        <div class="card"><h2>Energy drift (should be zero)</h2>
          <canvas id="li-energy" width="940" height="260"></canvas>
          <span class="small">Up: the cart gained energy. Down: it lost some. The axis is stretched so that a tiny drift and a huge one can both be seen. Teal: yours. Grey dashed: the game's setting.</span></div>
        <div class="card"><h2>Does a replay match?</h2>
          <canvas id="li-div" width="940" height="220"></canvas>
          <span class="small">How far your cart is from the game's recording, in metres, as the run goes on (log scale; the dashed line is 1 mm).</span>
          <table style="margin-top:8px"><thead><tr><th>Replay</th><th>Hash</th><th>Same as the recording?</th><th>Apart by 1 mm at</th><th>Gap at the end</th></tr></thead><tbody id="li-replays"></tbody></table></div>
        <div class="card" id="li-out"><h2>What happened</h2><p class="small" id="li-none">Run the cart to see facts here.</p><dl class="facts" id="li-facts" hidden></dl></div>
        <div class="card" id="li-hist" hidden><h2>Your runs so far</h2><table><thead><tr><th>#</th><th>Rule</th><th>Steps a second</th><th>Seconds</th><th>Worst drift</th><th>Same as recording</th></tr></thead><tbody id="li-rows"></tbody></table></div>
        <div class="card" id="li-ours" hidden><h2>What the game does</h2><p id="li-ours-p" style="margin:0"></p></div>
        <div class="card" id="li-eq" hidden><h2>The maths</h2><button class="link" id="li-eq-btn">Show the maths behind your run</button><div class="eq" id="li-eq-body" hidden></div></div>
      </div>
    </div>`;
  const $ = <T extends HTMLElement>(id: string): T => wrap.querySelector("#" + id) as T;
  const cfg: LabConfig = { method: "euler", stepsPerSecond: 60, seconds: 300 };
  let last: LabResult | null = null;
  let history = 0;

  const sync = () => {
    const methods = $("li-methods");
    methods.innerHTML = "";
    for (const m of METHODS) {
      const b = document.createElement("button"); b.type = "button"; b.textContent = METHOD_INFO[m].label; b.dataset.method = m; b.setAttribute("aria-pressed", String(cfg.method === m));
      b.onclick = () => { cfg.method = m; sync(); };
      methods.append(b);
    }
    $("li-about").textContent = METHOD_INFO[cfg.method].about;
    $("li-step-v").textContent = `${cfg.stepsPerSecond} a second (${(1000 / cfg.stepsPerSecond).toFixed(1)} ms)`;
    $("li-len-v").textContent = `${cfg.seconds} s of game time`;
    $("li-hint").textContent = `This costs ${METHOD_INFO[cfg.method].evals * cfg.stepsPerSecond} looks at the push per game second.`;
  };
  $<HTMLInputElement>("li-step").addEventListener("input", (e) => { cfg.stepsPerSecond = STEP_CHOICES[Number((e.target as HTMLInputElement).value)]; sync(); });
  $<HTMLInputElement>("li-len").addEventListener("input", (e) => { cfg.seconds = LENGTH_CHOICES[Number((e.target as HTMLInputElement).value)]; sync(); });
  $<HTMLInputElement>("li-step").value = String(STEP_CHOICES.indexOf(cfg.stepsPerSecond));
  $<HTMLInputElement>("li-len").value = String(LENGTH_CHOICES.indexOf(cfg.seconds));
  sync();

  // ---- pictures (canvas) ----
  const ctxOf = (id: string) => $<HTMLCanvasElement>(id).getContext("2d")!;
  const axes = (g: CanvasRenderingContext2D, W: number, H: number, ml: number, mb: number, ticks: { y: number; label: string }[], tMax: number) => {
    g.clearRect(0, 0, W, H); g.font = "12px system-ui"; g.lineWidth = 1;
    for (const k of ticks) { g.strokeStyle = GRID; g.beginPath(); g.moveTo(ml, k.y); g.lineTo(W - 8, k.y); g.stroke(); g.fillStyle = GHOST; g.textAlign = "right"; g.fillText(k.label, ml - 4, k.y + 4); }
    g.fillStyle = GHOST; g.textAlign = "center";
    for (let i = 0; i <= 5; i++) { const x = ml + ((W - 8 - ml) * i) / 5; g.fillText(`${Math.round((tMax * i) / 5)} s`, x, H - mb + 14); }
  };
  // symmetric log axis: signed drift from 1e-12 up to 1
  const slog = (e: number) => Math.sign(e) * Math.max(0, Math.log10(Math.abs(e)) + 12);
  const drawEnergy = () => {
    const c = $<HTMLCanvasElement>("li-energy"), g = ctxOf("li-energy"), W = c.width, H = c.height, ml = 62, mb = 22, mt = 8;
    const ys = (e: number) => mt + ((H - mt - mb) / 2) * (1 - slog(e) / 12);
    const tMax = tEnd(last);
    const nm = (e: number) => (e === 1 ? "1" : `1e${Math.round(Math.log10(e))}`);
    const ticks = [1, 1e-3, 1e-6, 1e-9, 1e-12].flatMap((e) => [{ y: ys(e), label: `+${nm(e)}` }, ...(e === 1e-12 ? [] : [{ y: ys(-e), label: `-${nm(e)}` }])]);
    axes(g, W, H, ml, mb, ticks, tMax);
    g.strokeStyle = INK; g.beginPath(); g.moveTo(ml, ys(0)); g.lineTo(W - 8, ys(0)); g.stroke();
    if (!last) return;
    const xs = (t: number) => ml + (Math.min(t, tMax) / tMax) * (W - 8 - ml);
    const line = (pts: { t: number; e: number }[], col: string, dash: number[]) => { g.strokeStyle = col; g.lineWidth = 2.5; g.setLineDash(dash); g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(xs(p.t), ys(p.e)) : g.moveTo(xs(p.t), ys(p.e)))); g.stroke(); g.setLineDash([]); };
    line(last.game.drift, GHOST, [8, 6]); line(last.mine.drift, TEAL, []);
    if (last.mine.leftTrackAt !== null) { g.fillStyle = BAD; g.textAlign = "right"; g.fillText(`Left the rails at ${last.mine.leftTrackAt.toFixed(1)} s`, W - 12, mt + 14); }
  };
  const drawDiv = () => {
    const c = $<HTMLCanvasElement>("li-div"), g = ctxOf("li-div"), W = c.width, H = c.height, ml = 62, mb = 22, mt = 8;
    const lo = -12, hi = 2; // log10 metres
    const ys = (d: number) => mt + (H - mt - mb) * (1 - (Math.min(hi, Math.max(lo, Math.log10(Math.max(d, 1e-300)))) - lo) / (hi - lo));
    const tMax = tEnd(last);
    axes(g, W, H, ml, mb, [-12, -9, -6, -3, 0].map((p) => ({ y: ys(10 ** p), label: `1e${p} m` })), tMax);
    g.strokeStyle = BAD; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(ml, ys(0.001)); g.lineTo(W - 8, ys(0.001)); g.stroke(); g.setLineDash([]);
    if (!last) return;
    const xs = (t: number) => ml + (t / tMax) * (W - 8 - ml);
    const d = last.replays[1].div, step = Math.max(1, Math.floor(d.length / 300));
    g.strokeStyle = TEAL; g.lineWidth = 2.5; g.beginPath();
    d.forEach((p, i) => { if (i % step && i !== d.length - 1) return; const y = ys(p.d); if (i === 0) g.moveTo(xs(p.t), y); else g.lineTo(xs(p.t), y); });
    g.stroke();
    if (last.replays[1].equal) { g.fillStyle = TEAL; g.textAlign = "left"; g.fillText("Identical to the last bit: nothing to draw above the floor", ml + 8, ys(1e-12) - 8); }
  };
  const rails = bowlRails();
  const drawBowl = (t: number) => {
    const c = $<HTMLCanvasElement>("li-bowl"), g = ctxOf("li-bowl"), W = c.width, H = c.height;
    g.clearRect(0, 0, W, H);
    const sx = (x: number) => 20 + (x / 40) * (W - 40), sy = (y: number) => H - 20 - (y / 6.6) * (H - 40);
    g.strokeStyle = INK; g.lineWidth = 3; g.beginPath();
    for (let x = 0; x <= 40; x += 0.25) (x ? g.lineTo(sx(x), sy(rails.y(x))) : g.moveTo(sx(x), sy(rails.y(x))));
    g.stroke();
    const cart = (x: number, col: string, dy: number) => { g.fillStyle = col; g.beginPath(); g.arc(sx(x), sy(rails.y(x)) - 10 - dy, 8, 0, 7); g.fill(); };
    if (last) {
      const gx = last.game.xs[Math.min(t, last.game.xs.length - 1)], mx = last.mine.xs[Math.min(t, last.mine.xs.length - 1)];
      cart(gx, GHOST, 0); if (!(last.mine.leftTrackAt !== null && t >= last.mine.xs.length)) cart(mx, TEAL, 6);
    } else cart(BOWL_START.x, TEAL, 0);
  };
  const tSlider = $<HTMLInputElement>("li-t");
  tSlider.addEventListener("input", () => { $("li-t-v").textContent = `${tSlider.value} s`; drawBowl(Number(tSlider.value)); });
  drawEnergy(); drawDiv(); drawBowl(0);

  // ---- running ----
  let worker: Worker | null = null;
  let job = 0;
  const runBtn = $<HTMLButtonElement>("li-run");
  const finish = (r: LabResult) => {
    last = r; history++;
    const m = r.mine, mine = r.replays[1], again = r.replays[2];
    $("li-none").hidden = true;
    const facts = $("li-facts"); facts.hidden = false;
    const rows: [string, string][] = [
      ["Rule and step", `${METHOD_INFO[r.cfg.method].label}, ${r.cfg.stepsPerSecond} steps a second`],
      ["Result", m.leftTrackAt !== null ? `The cart left the rails at ${m.leftTrackAt.toFixed(1)} s` : `Stayed on the rails for ${r.cfg.seconds} s`],
      ["Worst energy drift", pct(m.maxDrift)],
      ["Energy drift at the end", pct(m.finalDrift)],
      ["Cost", `${r.costPerSecond} looks at the push per game second`],
      ["Same run twice", again.trace.hash === m.hash ? `Yes, hash ${m.hash} both times` : "No"],
      ["Same as the game's recording", mine.equal ? "Yes" : `No, hash ${m.hash} against ${r.game.hash}`],
      ["Measured order of accuracy", r.order.order === null ? "too small to measure" : r.order.order.toFixed(2)],
      ["Time to compute", `${(r.wallMs / 1000).toFixed(2)} s on this device`],
    ];
    facts.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
    $("li-replays").innerHTML = r.replays.map((p) => `<tr><td>${p.label}</td><td>${p.trace.hash}</td><td class="${p.equal ? "yes" : "no"}">${p.equal ? "Equal" : "Different"}</td><td>${p.apartAt === null ? "never" : p.apartAt + " s"}</td><td>${p.endGap === null ? "-" : p.endGap === 0 ? "0 m" : p.endGap.toExponential(1) + " m"}</td></tr>`).join("");
    $("li-hist").hidden = false;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${history}</td><td>${METHOD_INFO[r.cfg.method].label}</td><td>${r.cfg.stepsPerSecond}</td><td>${r.cfg.seconds}</td><td>${pct(m.maxDrift)}</td><td>${mine.equal ? "yes" : "no"}</td>`;
    $("li-rows").prepend(tr);
    // our setting comes last, after the player has a result of their own
    $("li-ours").hidden = false;
    $("li-ours-p").textContent = `The game uses RK4 at ${GAME_STEPS_PER_SECOND} steps a second, always, on every device. On this bowl that kept the energy within ${pct(r.game.maxDrift)} for ${r.cfg.seconds} s. It is not the smallest drift on offer (smaller steps give less), and it is not the cheapest rule. It is fixed because a replay is only the key presses played again: the replay judge, the ghost and a shared run all need the same presses to give the same run, bit for bit, on every machine. A step that changes with the frame rate, or a rule that is switched, would give a different run each time. So the step size is a promise, not a setting. RK4 at that step is accurate enough that the drift cannot be seen in play.`;
    $("li-eq").hidden = false;
    tSlider.disabled = false; tSlider.max = String(Math.max(r.game.xs.length - 1, m.xs.length - 1)); tSlider.value = "0"; $("li-t-v").textContent = "0 s";
    drawEnergy(); drawDiv(); drawBowl(0);
    document.documentElement.dataset.labDone = String(history);
    document.documentElement.dataset.labHashEqual = String(mine.equal);
    runBtn.disabled = false; runBtn.textContent = "Run the cart";
  };
  runBtn.onclick = () => {
    const mine = clampCfg(cfg);
    runBtn.disabled = true; runBtn.textContent = "Running";
    const id = ++job;
    const inline = () => finish(runLab(mine));
    try { worker ??= new Worker(new URL("../labs/integration/worker.ts", import.meta.url), { type: "module" }); } catch { inline(); return; }
    worker.onmessage = (e: MessageEvent) => { const d = e.data as { id: number; done?: boolean; result?: LabResult }; if (d.id === id && d.done && d.result) finish(d.result); };
    worker.onerror = () => { worker = null; inline(); };
    worker.postMessage({ id, cfg: mine });
  };
  $<HTMLButtonElement>("li-eq-btn").onclick = () => {
    const b = $("li-eq-body");
    b.hidden = false;
    const c = last!.cfg;
    b.textContent =
`The cart (per kilogram), x along the bowl, y(x) the height of the rail, v the speed along the rail:
  dx/dt = v / sqrt(1 + y'(x)^2)
  dv/dt = -g · y'(x) / sqrt(1 + y'(x)^2)         (no friction, no drag in this Lab)

Energy, the check:
  E = g · y(x) + v^2 / 2        and        dE/dt = 0 on the true motion.
  Plotted: (E - E0) / E0, where E0 is the energy at the start, measured from the bottom of the bowl.

Your rule, with h = 1/${c.stepsPerSecond} s:
  Euler:           x' = x + h·f(x, v)         v' = v + h·a(x, v)
  Semi-implicit:   v' = v + h·a(x, v)         x' = x + h·f(x, v')
  RK4:             four slopes k1..k4 inside the step, then  s' = s + h/6 · (k1 + 2·k2 + 2·k3 + k4)

Error orders (h is the step):
  local error (one step):     Euler and semi-implicit O(h^2)      RK4 O(h^5)
  global error (whole run):   Euler and semi-implicit O(h)        RK4 O(h^4)
  halve h:  Euler error ~ 1/2,  RK4 error ~ 1/16.
  Measured here for your rule:  p = log2( e(h) / e(h/2) ) = ${last!.order.order === null ? "too small to measure" : last!.order.order.toFixed(2)}   (error in x after 3 s against RK4 at 3840 steps a second)

Energy as a check:
  Euler multiplies the energy by about (1 + h^2 · w^2) every step on a swing of frequency w, so it grows without end.
  Semi-implicit Euler is built to hold the energy of a plain swing steady. Here the slope of the rail is in the position update too, so a slow creep upward is left: far slower than Euler, but not zero.
  RK4 wobbles by about O(h^4) and, on this bowl, shows almost no creep.

The replay hash:
  FNV-1a over the 64 bits of x and v at every whole second of game time.
  Two runs share a hash only if every one of those numbers is the same to the last bit.`;
    $<HTMLButtonElement>("li-eq-btn").hidden = true;
  };
  document.documentElement.dataset.labReady = "true";
  return { backend: "canvas2d" };
}
