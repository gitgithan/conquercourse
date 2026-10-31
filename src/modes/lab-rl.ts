import type { CourseData } from "../course/course";
import { BIN_METRES, DEFAULT_RL, GAMMA, REWARD_PRESETS, clampRl, pathOfPlan, policyStrip, trainNoExplore, trainRl, type Block, type RlConfig, type RlResult } from "../lab/rl-lab";
import { labsOn } from "../ui/labs";

// Lab 12: Reinforcement learning. A game character learns the trap course by trial and error on the real simulator.
// The player writes the points (the reward), the learning rate and the exploration, then reads the curve, the learned run and the facts.
// Nothing here talks or grades: it shows numbers and pictures. The maths comes last, after a run. Behind the labs switch (?labs=1).
const COURSE_URL = "/assets/lab/search-trap.course.json";
const INK = "#17201d", TEAL = "#0f6b5c", AMBER = "#b45309", GHOST = "#9aa5a0", DECK = "#cbd5cd", WATER = "#b7d3ee", BAD = "#b91c1c";
const EPISODES = [200, 500, 1000, 2000, 3000, 5000];
interface Done { result: RlResult; found: { x: number; y: number }[]; ours: { x: number; y: number }[]; strip: number[]; wallMs: number }
type SliderDef = { id: string; label: string; min: number; max: number; step: number; get: (c: RlConfig) => number; set: (c: RlConfig, v: number) => void; fmt?: (v: number) => string };
const SLIDERS: SliderDef[] = [
  { id: "progress", label: "Points for each metre forward", min: 0, max: 3, step: 0.1, get: (c) => c.reward.progress, set: (c, v) => (c.reward.progress = v) },
  { id: "finish", label: "Bonus for finishing", min: 0, max: 100, step: 1, get: (c) => c.reward.finish, set: (c, v) => (c.reward.finish = v) },
  { id: "fall", label: "Penalty for a fall", min: 0, max: 100, step: 1, get: (c) => c.reward.fall, set: (c, v) => (c.reward.fall = v) },
  { id: "alive", label: "Bonus for each moment still playing", min: -1, max: 2, step: 0.05, get: (c) => c.reward.alive, set: (c, v) => (c.reward.alive = v) },
  { id: "edge", label: "Hint bonus for being near a gap", min: 0, max: 3, step: 0.1, get: (c) => c.reward.edge, set: (c, v) => (c.reward.edge = v) },
];
const MOVE_COLOURS = [TEAL, AMBER, BAD];

export function startLabRl(host: HTMLElement): { backend: "canvas2d" } {
  const root = document.createElement("div");
  root.id = "lab-rl";
  root.style.cssText = `position:fixed;inset:0;overflow:auto;background:#f5f7f4;color:${INK};font:15px/1.4 system-ui,sans-serif`;
  host.append(root);
  if (!labsOn()) {
    root.innerHTML = `<div style="max-width:520px;margin:12vh auto;padding:0 16px"><h1 style="font-size:22px">Lab 12: Reinforcement learning</h1><p>Labs are switched off.</p><p><a href="?mode=lab-rl&labs=1" style="color:${TEAL}">Switch labs on</a></p></div>`;
    return { backend: "canvas2d" };
  }
  const style = document.createElement("style");
  style.textContent = `
    #lab-rl .wrap{max-width:1040px;margin:0 auto;padding:16px;display:grid;gap:14px}
    #lab-rl h1{font-size:22px;margin:0}#lab-rl h2{font-size:15px;margin:0 0 6px}
    #lab-rl .grid{display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr);gap:14px;align-items:start}
    #lab-rl .card{background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:12px}
    #lab-rl label{display:grid;gap:2px;margin:7px 0}#lab-rl input[type=range]{width:100%}
    #lab-rl .pre{display:grid;grid-template-columns:1fr 1fr;gap:6px}
    #lab-rl .pre button{font:600 13px system-ui;padding:7px;border:1px solid #b9c4bb;border-radius:8px;background:#fff;color:${INK};cursor:pointer}
    #lab-rl .pre button[aria-pressed=true]{border-color:${TEAL};background:#e6f2ee}
    #lab-rl .go{font:700 15px system-ui;padding:10px 14px;border:0;border-radius:8px;background:${TEAL};color:#fff;cursor:pointer;width:100%;margin-top:8px}
    #lab-rl .go:disabled{opacity:.6;cursor:default}
    #lab-rl .facts{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:0}
    #lab-rl .facts dt{color:#52605a}#lab-rl .facts dd{margin:0;font-weight:600}
    #lab-rl table{border-collapse:collapse;width:100%;font-size:13px}#lab-rl th,#lab-rl td{text-align:left;padding:3px 8px 3px 0;border-bottom:1px solid #e3e8e4}
    #lab-rl .small{color:#52605a;font-size:13px}
    #lab-rl .eq{font:14px/1.6 ui-monospace,Menlo,monospace;background:#f1f4f1;border-radius:8px;padding:8px 10px;white-space:pre-wrap;overflow-x:auto}
    #lab-rl button.link{background:none;border:0;color:${TEAL};font:600 14px system-ui;cursor:pointer;padding:0;text-decoration:underline}
    #lab-rl a.back{color:${TEAL};font-weight:600}
    #lab-rl .key i{display:inline-block;width:10px;height:10px;border-radius:2px;margin:0 4px 0 10px;vertical-align:-1px}
    #lab-rl .note{border-left:3px solid ${AMBER};padding:4px 10px;background:#fbf4ea;border-radius:0 6px 6px 0}
  `;
  root.append(style);
  const wrap = document.createElement("div"); wrap.className = "wrap"; root.append(wrap);
  wrap.innerHTML = `
    <div><a class="back" href="/?welcome=0">Back to the game</a>
    <h1>Lab 12: Reinforcement learning</h1>
    <p class="small" style="margin:4px 0 0">The goal: a game character learns to clear a course by trial and error. You write the points it earns. It tries the course again and again, keeps a table of which move paid off at each place, and slowly gets better. It plays the game's real simulator. Its only moves are the real inputs: run, jump and wait.</p></div>
    <div class="grid">
      <div class="card" id="rl-controls">
        <h2>The points you write</h2>
        <div class="pre" id="rl-presets" role="group" aria-label="Points presets"></div>
        <p class="small" id="rl-about" style="margin:6px 0"></p>
        <div id="rl-sliders"></div>
        <h2 style="margin-top:10px">How it learns</h2>
        <label>Learning rate: <b id="rl-alpha-v"></b><input id="rl-alpha" type="range" min="0.02" max="1" step="0.02"></label>
        <label>Exploration (random moves): <b id="rl-eps-v"></b><input id="rl-eps" type="range" min="0" max="0.6" step="0.02"></label>
        <label style="display:flex;gap:6px;align-items:center"><input id="rl-decay" type="checkbox"> Explore less as it learns</label>
        <label>Episodes (tries): <b id="rl-ep-v"></b><input id="rl-ep" type="range" min="0" max="${EPISODES.length - 1}" step="1"></label>
        <label>Seed: <input id="rl-seed" type="number" min="0" max="999999" style="width:100%;box-sizing:border-box;padding:4px"></label>
        <button class="go" id="rl-run">Train the character</button>
      </div>
      <div style="display:grid;gap:14px;min-width:0">
        <div class="card"><h2>The learning curve</h2>
          <canvas id="rl-curve" width="940" height="220" style="width:100%;height:auto;display:block;border-radius:6px;background:#eef3ee"></canvas>
          <p class="small key" style="margin:6px 0 0"><i style="background:${TEAL}"></i>Points per try (average of each block)<i style="background:${AMBER}"></i>Share of tries that cleared<i style="background:${GHOST}"></i>Points of the game's own line</p></div>
        <div class="card"><h2>The course and the learned run</h2>
          <canvas id="rl-pic" width="940" height="300" style="width:100%;height:auto;display:block;border-radius:6px;background:#eef3ee"></canvas>
          <div style="display:flex;gap:12px;align-items:center;margin-top:6px;flex-wrap:wrap"><button class="link" id="rl-play" disabled>Play it back</button>
          <span class="small key">Teal line: the learned run. Grey: the game's own line. Strip on top, its best move at each place:<i style="background:${TEAL}"></i>run<i style="background:${AMBER}"></i>jump<i style="background:${BAD}"></i>wait</span></div></div>
        <div class="card" id="rl-out"><h2>What happened</h2><p class="small" id="rl-none">Train the character to see facts here.</p><dl class="facts" id="rl-facts" hidden></dl><p class="note" id="rl-hack" hidden style="margin:10px 0 0"></p></div>
        <div class="card" id="rl-hist" hidden><h2>Your trainings so far</h2><table><thead><tr><th>#</th><th>Points</th><th>Rate / explore</th><th>Seed</th><th>First clear</th><th>Result</th><th>Seconds</th></tr></thead><tbody id="rl-rows"></tbody></table></div>
        <div class="card" id="rl-ours" hidden><h2>What the game does</h2><p id="rl-ours-p" style="margin:0 0 8px"></p><p id="rl-ours-q" style="margin:0"></p></div>
        <div class="card" id="rl-eq" hidden><h2>The maths</h2><button class="link" id="rl-eq-btn">Show the maths behind your training</button><div class="eq" id="rl-eq-body" hidden></div></div>
      </div>
    </div>`;
  const $ = <T extends HTMLElement>(id: string): T => wrap.querySelector("#" + id) as T;
  const cfg: RlConfig = { ...DEFAULT_RL, reward: { ...DEFAULT_RL.reward } };
  let course: CourseData | null = null;
  let last: Done | null = null;
  let live: Block[] = [];
  let history = 0;
  let animFrame = 0;
  let preset = "honest";

  const sync = () => {
    const pre = $("rl-presets"); pre.innerHTML = "";
    for (const [k, p] of Object.entries(REWARD_PRESETS)) {
      const b = document.createElement("button"); b.type = "button"; b.textContent = p.label; b.dataset.preset = k; b.setAttribute("aria-pressed", String(preset === k));
      b.onclick = () => { preset = k; cfg.reward = { ...p.reward }; sync(); };
      pre.append(b);
    }
    $("rl-about").textContent = preset in REWARD_PRESETS ? REWARD_PRESETS[preset].about : "Your own mix of points.";
    for (const s of SLIDERS) { $<HTMLInputElement>("rl-s-" + s.id).value = String(s.get(cfg)); $("rl-sv-" + s.id).textContent = s.get(cfg).toFixed(s.step < 1 ? 2 : 0); }
    $("rl-alpha-v").textContent = cfg.alpha.toFixed(2); $("rl-eps-v").textContent = cfg.epsilon.toFixed(2); $("rl-ep-v").textContent = String(cfg.episodes);
  };
  $("rl-sliders").innerHTML = SLIDERS.map((s) => `<label>${s.label}: <b id="rl-sv-${s.id}"></b><input id="rl-s-${s.id}" type="range" min="${s.min}" max="${s.max}" step="${s.step}"></label>`).join("");
  for (const s of SLIDERS) $<HTMLInputElement>("rl-s-" + s.id).addEventListener("input", (e) => { s.set(cfg, Number((e.target as HTMLInputElement).value)); preset = "custom"; sync(); });
  const bind = (id: string, set: (v: number) => void) => $<HTMLInputElement>(id).addEventListener("input", (e) => { set(Number((e.target as HTMLInputElement).value)); sync(); });
  bind("rl-alpha", (v) => (cfg.alpha = v)); bind("rl-eps", (v) => (cfg.epsilon = v)); bind("rl-ep", (v) => (cfg.episodes = EPISODES[v]));
  $<HTMLInputElement>("rl-seed").addEventListener("input", (e) => { cfg.seed = Number((e.target as HTMLInputElement).value) || 0; });
  $<HTMLInputElement>("rl-decay").addEventListener("change", (e) => { cfg.decay = (e.target as HTMLInputElement).checked; });
  $<HTMLInputElement>("rl-alpha").value = String(cfg.alpha); $<HTMLInputElement>("rl-eps").value = String(cfg.epsilon); $<HTMLInputElement>("rl-ep").value = String(EPISODES.indexOf(cfg.episodes));
  $<HTMLInputElement>("rl-seed").value = String(cfg.seed); $<HTMLInputElement>("rl-decay").checked = cfg.decay;
  sync();

  // ---- the learning curve ----
  const curve = $<HTMLCanvasElement>("rl-curve");
  const cg = curve.getContext("2d")!;
  const drawCurve = (blocks: Block[], total: number, d: Done | null) => {
    const W = curve.width, H = curve.height, L = 56, R = 46, T = 14, B = 28;
    cg.clearRect(0, 0, W, H);
    cg.font = "12px system-ui"; cg.fillStyle = "#52605a"; cg.strokeStyle = "#d5ddd6"; cg.lineWidth = 1;
    const idealRet = d ? d.result.ideal.ret : null;
    const ys = blocks.map((b) => b.meanReturn).concat(idealRet !== null ? [idealRet] : [], [0]);
    const lo = Math.min(...ys), hi = Math.max(...ys, lo + 1);
    const px = (ep: number) => L + (ep / total) * (W - L - R), py = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B), pc = (v: number) => T + (1 - v) * (H - T - B);
    for (let i = 0; i <= 4; i++) { const y = T + (i / 4) * (H - T - B); cg.beginPath(); cg.moveTo(L, y); cg.lineTo(W - R, y); cg.stroke(); }
    cg.textAlign = "right"; cg.fillText(hi.toFixed(0), L - 6, T + 4); cg.fillText(lo.toFixed(0), L - 6, H - B + 4);
    cg.textAlign = "left"; cg.fillText("100%", W - R + 6, T + 4); cg.fillText("0%", W - R + 6, H - B + 4);
    cg.textAlign = "center"; cg.fillText("episodes", (L + W - R) / 2, H - 6); cg.fillText("0", L, H - B + 14); cg.fillText(String(total), W - R, H - B + 14);
    if (idealRet !== null) { cg.strokeStyle = GHOST; cg.setLineDash([8, 6]); cg.lineWidth = 2; cg.beginPath(); cg.moveTo(L, py(idealRet)); cg.lineTo(W - R, py(idealRet)); cg.stroke(); cg.setLineDash([]); }
    const line = (colour: string, f: (b: Block) => number) => {
      if (!blocks.length) return;
      cg.strokeStyle = colour; cg.lineWidth = 2.5; cg.beginPath();
      blocks.forEach((b, i) => (i ? cg.lineTo(px(b.episode), f(b)) : cg.moveTo(px(b.episode), f(b))));
      cg.stroke();
    };
    line(TEAL, (b) => py(b.meanReturn)); line(AMBER, (b) => pc(b.clearRate));
    if (d && d.result.firstClearEpisode !== null) {
      const x = px(d.result.firstClearEpisode); cg.strokeStyle = INK; cg.lineWidth = 1; cg.setLineDash([3, 3]); cg.beginPath(); cg.moveTo(x, T); cg.lineTo(x, H - B); cg.stroke(); cg.setLineDash([]);
      cg.fillStyle = INK; cg.textAlign = x > W - 150 ? "right" : "left"; cg.fillText(`first clear: try ${d.result.firstClearEpisode}`, x + (x > W - 150 ? -4 : 4), T + 12);
    }
  };

  // ---- the picture: side view of the course, the policy strip and the paths ----
  const canvas = $<HTMLCanvasElement>("rl-pic");
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
    if (last) {
      last.strip.forEach((m, i) => { if (m < 0) return; g.fillStyle = MOVE_COLOURS[m]; const a = sx(course!.startX + i * BIN_METRES); g.fillRect(a, 4, Math.max(1, sx(course!.startX + (i + 1) * BIN_METRES) - a - 0.5), 14); });
    }
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
  $<HTMLButtonElement>("rl-play").onclick = () => {
    if (!last) return;
    cancelAnimationFrame(animFrame);
    const total = last.found.length; let i = 0;
    const tick = () => { i += 1; draw(i); if (i < total) animFrame = requestAnimationFrame(tick); else draw(null); };
    tick();
  };

  // ---- running ----
  let worker: Worker | null = null;
  let job = 0;
  const runBtn = $<HTMLButtonElement>("rl-run");
  const pct = (v: number): string => `${Math.round(v * 100)}%`;
  const finish = (d: Done, used: RlConfig) => {
    last = d; history++;
    const r = d.result;
    $("rl-none").hidden = true;
    const facts = $("rl-facts"); facts.hidden = false;
    const learnedGap = r.finalSeconds != null && r.ideal.seconds != null ? r.finalSeconds - r.ideal.seconds : null;
    const rows: [string, string][] = [
      ["Learned run", r.finalCleared ? "Clears the course" : r.finalEnd === "out of time" ? `Does not clear: out of time at ${pct(r.finalProgress)} of the course` : `Does not clear: ${r.finalEnd} at ${pct(r.finalProgress)} of the course`],
      ["Tries until the first clear", r.firstClearEpisode !== null ? `${r.firstClearEpisode} (a clear while still making random moves)` : `none in ${r.episodes}`],
      ["Tries until its best guess clears", r.firstPolicyClearEpisode !== null ? `${r.firstPolicyClearEpisode} (checked every 10 tries)` : `never in ${r.episodes}`],
      ["Learned run time", r.finalSeconds != null ? `${r.finalSeconds.toFixed(2)} s` : "no clear"],
      ["Game's own line", r.ideal.seconds != null ? `${r.ideal.seconds.toFixed(2)} s (the stored line from the ideal-run search)` : "not stored"],
      ["Difference", learnedGap != null ? `${learnedGap >= 0 ? "+" : ""}${learnedGap.toFixed(2)} s` : "n/a"],
      ["Jumps it learned (x, m)", r.line.jumps.length ? r.line.jumps.join(", ") : "none"],
      ["Game's own jumps (x, m)", r.ideal.jumps.join(", ")],
      ["Points: learned run", r.finalReturn.toFixed(1)],
      ["Points: game's own line", r.ideal.ret.toFixed(1)],
      ["Random moves", `${pct(r.random.clearRate)} of ${r.random.episodes} tries cleared; on average ${pct(r.random.meanProgress)} of the course`],
      ["No exploring at all", `${r.greedy.clearRate ? "cleared" : "did not clear"}; ended at ${pct(r.greedy.meanProgress)} of the course`],
      ["Game time played", `${r.simSeconds} s in the simulator`],
      ["Time to compute", `${(d.wallMs / 1000).toFixed(2)} s on this device`],
    ];
    facts.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
    const hack = $("rl-hack");
    hack.hidden = !r.hacked;
    if (r.hacked) hack.textContent = `The points paid ${r.finalReturn.toFixed(1)} for what the character does now, and ${r.ideal.ret.toFixed(1)} for the game's own clear. By your rules the run that does not finish is the better one, so the character is doing what the points ask.`;
    $("rl-hist").hidden = false;
    const tr = document.createElement("tr");
    const name = preset in REWARD_PRESETS ? REWARD_PRESETS[preset].label : "Custom";
    tr.innerHTML = `<td>${history}</td><td>${name}</td><td>${used.alpha.toFixed(2)} / ${used.epsilon.toFixed(2)}${used.decay ? " (shrinks)" : ""}</td><td>${used.seed}</td><td>${r.firstClearEpisode ?? "-"}</td><td>${r.finalCleared ? "clears" : "no clear"}</td><td>${r.finalSeconds != null ? r.finalSeconds.toFixed(2) : "-"}</td>`;
    $("rl-rows").prepend(tr);
    // our setting comes last, after the player has a result of their own
    $("rl-ours").hidden = false;
    $("rl-ours-p").textContent = "The game does not use a learned character to decide whether a course can be cleared. It searches (src/sim/ideal.ts): it tries presses in the same simulator and keeps the ones that work. A search that finds a clear is a proof, and the same search gives the same line every time. A learning run only samples: if 2000 tries never clear, that shows nothing about the course, and a different seed or a different reward can change the answer. Learning also needs points that are right, which you have just seen is easy to get wrong.";
    $("rl-ours-q").textContent = "Where learning would help: a ghost that gets better. A ghost racer does not need a proof, only a plausible run that improves with every race, and trial and error with the real simulator makes one that is never faster than the best line the search can find.";
    $("rl-eq").hidden = false;
    $<HTMLButtonElement>("rl-play").disabled = d.found.length === 0;
    cancelAnimationFrame(animFrame);
    drawCurve(r.blocks, used.episodes, d);
    draw(null);
    document.documentElement.dataset.labDone = String(history);
    runBtn.disabled = false; runBtn.textContent = "Train the character";
  };
  runBtn.onclick = () => {
    if (!course) return;
    const mine = clampRl({ ...cfg, reward: { ...cfg.reward } });
    runBtn.disabled = true; runBtn.textContent = "Training";
    last = null; live = []; drawCurve([], mine.episodes, null); draw(null);
    const id = ++job;
    const c = course;
    const inline = () => {
      const t = Date.now();
      const r = trainRl(c, mine);
      r.greedy = trainNoExplore(c, mine);
      const { q, policyRun, ...result } = r;
      finish({ result, found: policyRun.path, ours: pathOfPlan(c), strip: policyStrip(q), wallMs: Date.now() - t }, mine);
    };
    try { worker ??= new Worker(new URL("../lab/rl-lab-worker.ts", import.meta.url), { type: "module" }); } catch { inline(); return; }
    worker.onmessage = (e: MessageEvent) => {
      const d = e.data as { id: number; block?: Block; done?: number | boolean } & Partial<Done>;
      if (d.id !== id) return;
      if (d.block) { live.push(d.block); drawCurve(live, mine.episodes, null); runBtn.textContent = `Training: try ${d.block.episode} of ${mine.episodes}`; }
      else if (d.done === true) finish(d as Done, mine);
    };
    worker.onerror = () => { worker = null; inline(); };
    worker.postMessage({ id, course: c, cfg: mine });
  };
  $<HTMLButtonElement>("rl-eq-btn").onclick = () => {
    const b = $("rl-eq-body");
    b.hidden = false;
    const w = cfg.reward;
    b.textContent =
`The points (reward) for one moment of play:
  r = p · Δx  +  a  +  h · [near a gap]   and  + F on the finish,  − P on a fall
  Your numbers: p = ${w.progress.toFixed(1)} per metre, a = ${w.alive.toFixed(2)}, h = ${w.edge.toFixed(1)}, F = ${w.finish.toFixed(0)}, P = ${w.fall.toFixed(0)}.

The return (what the character tries to make large), with discount γ = ${GAMMA}:
  G = r(0) + γ·r(1) + γ²·r(2) + …

The table Q(s, a): the value of move a at place s (s is the 0.25 m cell the feet are in; a is run, jump or wait).
  Update after each move that took k moments and landed at s':
  Q(s, a)  ←  Q(s, a)  +  α · [ r + γ^k · max over a' of Q(s', a')  −  Q(s, a) ]
  Your learning rate: α = ${cfg.alpha.toFixed(2)}.

Exploration, ε-greedy: with chance ε pick a random move, otherwise pick the move with the largest Q(s, a).
  ε = ${cfg.epsilon.toFixed(2)}${cfg.decay ? ", shrinking in a straight line to one tenth of that by the last try" : ", the same on every try"}.

Why a hint can be farmed:
  A hint like h is safe only if it is a difference of a "potential" Φ over places,  F = γ·Φ(s') − Φ(s)  (Ng, Harada and Russell, 1999). It then leaves the best policy as it was.
  "Near a gap" paid again on every moment is not of that form, so standing there collects  h / (1 − γ) = ${w.edge > 0 ? (w.edge / (1 - GAMMA)).toFixed(0) : "0"}  points in the limit.
  The same holds for the bonus for each moment still playing:  a / (1 − γ) = ${(w.alive / (1 - GAMMA)).toFixed(0)}.

The seed fixes every random choice, so the same seed and the same numbers give the same curve.`;
    $<HTMLButtonElement>("rl-eq-btn").hidden = true;
  };

  fetch(COURSE_URL).then((r) => r.json()).then((c: CourseData) => { course = c; drawCurve([], cfg.episodes, null); draw(null); document.documentElement.dataset.labReady = "true"; });
  return { backend: "canvas2d" };
}
