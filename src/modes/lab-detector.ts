import { mountLabsNav } from "../ui/labs-nav";
import { DEFAULT_DETECTOR, bestF1, byPrompt, evaluate, hardness, sweep, type DetectorConfig, type DetectorData, type Outcome } from "../lab/detector-lab";
import { labsOn } from "../ui/labs";
import { labDefaultNote, labPopulated } from "../ui/lab-default";

// Evaluating a detector (CC-49 data). The player picks the words to ask for and where the claim line sits, and reads hits, misses and made-up parts on hand-labelled objects.
// The detector's answers are recorded: no model runs on the page. Nothing talks or grades: it shows counts and a curve. The maths comes last, after a look at the numbers.
const DATA_URL = "/assets/lab/detector-partllm.json";
const INK = "#17201d", TEAL = "#0f6b5c", ORANGE = "#b45309", BAD = "#b91c1c", GRID = "#d5ddd6";
const PROMPT_ABOUT: Record<string, string> = { bar: "a thin bar a hand can wrap round", rail: "a handrail", ledge: "an edge a hand can hook", step: "a stair step" };
const OUTCOME_TEXT: Record<Outcome, [string, string]> = {
  found: ["found", TEAL],
  "missed-silent": ["missed (said nothing)", BAD],
  "missed-wrong-place": ["missed (wrong place)", BAD],
  "made-up": ["made up", BAD],
  "correct-empty": ["correctly empty", "#52605a"],
  "not-scored": ["not scored", "#52605a"],
};
const pct = (x: number) => `${Math.round(x * 100)}%`;
const f2 = (x: number) => x.toFixed(2);

export function startLabDetector(host: HTMLElement): { backend: "canvas2d" } {
  const root = document.createElement("div");
  root.id = "lab-detector";
  root.style.cssText = `position:fixed;inset:0;overflow:auto;background:#f5f7f4;color:${INK};font:15px/1.4 system-ui,sans-serif`;
  host.append(root);
  mountLabsNav(host, "lab-detector");
  if (!labsOn()) {
    root.innerHTML = `<div style="max-width:520px;margin:12vh auto;padding:0 16px"><h1 style="font-size:22px">Evaluating a detector</h1><p>Labs are switched off.</p><p><a href="?mode=lab-detector&labs=1" style="color:${TEAL}">Switch labs on</a></p></div>`;
    return { backend: "canvas2d" };
  }
  const style = document.createElement("style");
  style.textContent = `
    #lab-detector .wrap{max-width:1040px;margin:0 auto;padding:16px;display:grid;gap:14px}
    #lab-detector h1{font-size:22px;margin:0}#lab-detector h2{font-size:15px;margin:0 0 6px}
    #lab-detector .grid{display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr);gap:14px;align-items:start}
    #lab-detector .card{background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:12px}
    #lab-detector label{display:grid;gap:2px;margin:8px 0}#lab-detector input[type=range]{width:100%}
    #lab-detector .meth{display:grid;grid-template-columns:1fr 1fr;gap:6px}
    #lab-detector .meth button{font:600 14px system-ui;padding:8px;border:1px solid #b9c4bb;border-radius:8px;background:#fff;color:${INK};cursor:pointer}
    #lab-detector .meth button[aria-pressed=true]{border-color:${TEAL};background:#e6f2ee}
    #lab-detector .go{font:700 15px system-ui;padding:10px 14px;border:0;border-radius:8px;background:${TEAL};color:#fff;cursor:pointer;width:100%;margin-top:6px}
    #lab-detector .big{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:6px 0}
    #lab-detector .big div{background:#f1f4f1;border-radius:8px;padding:8px 10px}#lab-detector .big b{display:block;font-size:24px}
    #lab-detector table{border-collapse:collapse;width:100%;font-size:13px}#lab-detector th,#lab-detector td{text-align:left;padding:3px 8px 3px 0;border-bottom:1px solid #e3e8e4}
    #lab-detector table.conf td,#lab-detector table.conf th{text-align:center;padding:6px 8px}
    #lab-detector .small{color:#52605a;font-size:13px}
    #lab-detector .eq{font:14px/1.6 ui-monospace,Menlo,monospace;background:#f1f4f1;border-radius:8px;padding:8px 10px;white-space:pre-wrap;overflow-x:auto}
    #lab-detector button.link{background:none;border:0;color:${TEAL};font:600 14px system-ui;cursor:pointer;padding:0;text-decoration:underline}
    #lab-detector a.back{color:${TEAL};font-weight:600}
  `;
  root.append(style);
  const wrap = document.createElement("div"); wrap.className = "wrap"; root.append(wrap);
  wrap.innerHTML = `
    <div><a class="back" href="/?welcome=0">Back to the game</a>
    <h1>Evaluating a detector</h1>
    <p class="small" style="margin:4px 0 0">The goal: a helper program looked at six park objects and was asked to point at the part a hand could hold. Is it good enough to place holds for us? You choose the words it is asked for and how much painted surface counts as a claim, then read what it found, missed and made up. The helper ran once, before you came; its answers are recorded.</p></div>
    <div class="grid">
      <div class="card">
        <h2>Your choices</h2>
        <p class="small" style="margin:0 0 4px">Words the helper is asked for</p>
        <div class="meth" id="ld-prompts" role="group" aria-label="Words asked"></div>
        <label>It counts as a claim when it paints more than <b id="ld-claim-v"></b> of the object<input id="ld-claim" type="range" min="0" max="0.8" step="0.01"></label>
        <label>A claim counts as found when at least <b id="ld-in-v"></b> of it sits on the real hold<input id="ld-in" type="range" min="0" max="1" step="0.05"></label>
        <button class="go" id="ld-keep">Keep this setting in my list</button>
      </div>
      <div style="display:grid;gap:14px;min-width:0">
        <div class="card"><h2>What it did, in plain words</h2>
          <div class="big"><div><b id="ld-found"></b>found</div><div><b id="ld-missed"></b>missed</div><div><b id="ld-made"></b>made up</div></div>
          <p id="ld-words" style="margin:4px 0 0"></p></div>
        <div class="card"><h2>The confusion table</h2>
          <table class="conf" id="ld-conf"></table>
          <p class="small" style="margin:6px 0 0">Rows: what is really there (we labelled each object by hand). Columns: what the helper said.</p></div>
        <div class="card"><h2>Precision, recall and F1</h2>
          <table id="ld-prf"></table>
          <p class="small" id="ld-prf-note" style="margin:6px 0 0"></p></div>
        <div class="card"><h2>Sliding the claim line</h2>
          <canvas id="ld-curve" width="940" height="260" style="width:100%;height:auto;display:block;border-radius:6px;background:#fbfcfb"></canvas>
          <p class="small" style="margin:6px 0 0"><span style="color:${TEAL}">Recall</span> (of the real parts, how many found), <span style="color:${ORANGE}">precision</span> (of its claims, how many right), <b>F1</b> (both in one). Dashed line: where your slider is. <span id="ld-best"></span></p></div>
        <div class="card"><h2>Which words work</h2><table id="ld-byp"></table></div>
        <div class="card"><h2>Which labelled parts are hard</h2>
          <p class="small" style="margin:0 0 6px">Each row is one object and one word. "Right at" is the share of claim-line settings (0% to 80%) where the helper's call on that part is right. Hardest first.</p>
          <table id="ld-hard"></table></div>
        <div class="card" id="ld-hist" hidden><h2>Settings I kept</h2><table><thead><tr><th>#</th><th>Words</th><th>Claim line</th><th>On hold</th><th>Found</th><th>Made up</th><th>F1</th></tr></thead><tbody id="ld-rows"></tbody></table></div>
        <div class="card"><h2>The maths</h2><button class="link" id="ld-eq-btn">Show the maths behind these numbers</button><div class="eq" id="ld-eq-body" hidden></div></div>
        <div class="card" id="ld-ours" hidden><h2>What the game does, and why</h2><p id="ld-ours-p" style="margin:0"></p></div>
      </div>
    </div>`;
  const $ = <T extends HTMLElement>(id: string): T => wrap.querySelector("#" + id) as T;
  const cfg: DetectorConfig = { ...DEFAULT_DETECTOR, prompts: [...DEFAULT_DETECTOR.prompts] };
  let data: DetectorData | null = null;
  let kept = 0;
  let eqShown = false;
  const canvas = $<HTMLCanvasElement>("ld-curve");
  const g = canvas.getContext("2d")!;

  const drawCurve = () => {
    if (!data) return;
    const W = canvas.width, H = canvas.height, L = 44, R = 10, T = 10, B = 28;
    g.clearRect(0, 0, W, H);
    const X = (v: number) => L + (v / 0.8) * (W - L - R), Y = (v: number) => T + (1 - v) * (H - T - B);
    g.font = "12px system-ui"; g.fillStyle = "#52605a"; g.strokeStyle = GRID; g.lineWidth = 1; g.setLineDash([]);
    for (let i = 0; i <= 4; i++) { const v = i / 4; g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(W - R, Y(v)); g.stroke(); g.fillText(v.toFixed(2), 8, Y(v) + 4); }
    for (let i = 0; i <= 8; i += 2) { g.fillText(`${i * 10}%`, X(i / 10) - 10, H - 8); }
    g.fillText("claim line (share of the object painted)", W / 2 - 100, H - 8);
    const curve = sweep(data, cfg);
    const line = (get: (t: (typeof curve)[number]["tally"]) => number, colour: string, width: number) => {
      g.strokeStyle = colour; g.lineWidth = width; g.beginPath();
      curve.forEach((p, i) => (i ? g.lineTo(X(p.claimMin), Y(get(p.tally))) : g.moveTo(X(p.claimMin), Y(get(p.tally)))));
      g.stroke();
    };
    line((t) => t.recall, TEAL, 3); line((t) => t.precision, ORANGE, 3); line((t) => t.f1, INK, 3);
    g.strokeStyle = INK; g.lineWidth = 1.5; g.setLineDash([6, 5]); g.beginPath(); g.moveTo(X(cfg.claimMin), T); g.lineTo(X(cfg.claimMin), H - B); g.stroke(); g.setLineDash([]);
    const b = bestF1(curve);
    g.fillStyle = INK; g.beginPath(); g.arc(X(b.claimMin), Y(b.tally.f1), 5, 0, 7); g.fill();
    $("ld-best").textContent = `Best F1 on this curve: ${f2(b.tally.f1)} at a claim line of ${pct(b.claimMin)} (dot).`;
  };

  const render = () => {
    if (!data) return;
    $("ld-claim-v").textContent = pct(cfg.claimMin);
    $("ld-in-v").textContent = pct(cfg.insideMin);
    const pr = $("ld-prompts"); pr.innerHTML = "";
    for (const p of data.prompts) {
      const b = document.createElement("button"); b.type = "button"; b.dataset.prompt = p; b.textContent = p; b.title = PROMPT_ABOUT[p] ?? p;
      b.setAttribute("aria-pressed", String(cfg.prompts.includes(p)));
      b.onclick = () => { cfg.prompts = cfg.prompts.includes(p) ? cfg.prompts.filter((q) => q !== p) : [...cfg.prompts, p]; render(); };
      pr.append(b);
    }
    const { rows, tally: t } = evaluate(data, cfg);
    $("ld-found").textContent = String(t.found); $("ld-missed").textContent = String(t.missed); $("ld-made").textContent = String(t.madeUp);
    $("ld-words").textContent = !rows.length ? "Pick at least one word." :
      `Of ${t.real} real parts it found ${t.found} and missed ${t.missed}. Where no such part exists (${t.none} cases) it made one up ${t.madeUp} times and stayed empty ${t.correctEmpty} times.`;
    $("ld-conf").innerHTML = `<thead><tr><th></th><th>Said: a part, in the right place</th><th>Said: nothing, or the wrong place</th></tr></thead>
      <tbody><tr><th style="text-align:left">A part is really there</th><td id="ld-tp"><b>${t.found}</b><br><span class="small">found</span></td><td id="ld-fn"><b>${t.missed}</b><br><span class="small">missed</span></td></tr>
      <tr><th style="text-align:left">No such part</th><td id="ld-fp"><b>${t.madeUp}</b><br><span class="small">made up</span></td><td id="ld-tn"><b>${t.correctEmpty}</b><br><span class="small">correctly empty</span></td></tr></tbody>`;
    $("ld-prf").innerHTML = `
      <tr><th style="text-align:left">Precision</th><td><b>${f2(t.precision)}</b></td><td class="small">Of the parts it pointed at, how many were real and right: ${t.found} of ${t.found + t.madeUp}.</td></tr>
      <tr><th style="text-align:left">Recall</th><td><b>${f2(t.recall)}</b></td><td class="small">Of the real parts, how many it found: ${t.found} of ${t.real}.</td></tr>
      <tr><th style="text-align:left">F1</th><td><b>${f2(t.f1)}</b></td><td class="small">One number that is low if either of the two is low.</td></tr>`;
    $("ld-prf-note").textContent = t.found + t.madeUp === 0 ? "It claimed nothing, so precision is shown as 0 (there is nothing to be right about)." : "";
    $("ld-byp").innerHTML = `<thead><tr><th>Word</th><th>Found</th><th>Missed</th><th>Made up</th><th>Precision</th><th>Recall</th></tr></thead>` +
      byPrompt(data, cfg).map((b) => `<tr${cfg.prompts.includes(b.prompt) ? "" : ' style="opacity:.45"'}><td><b>${b.prompt}</b> <span class="small">${PROMPT_ABOUT[b.prompt] ?? ""}</span></td><td>${b.tally.found}</td><td>${b.tally.missed}</td><td>${b.tally.madeUp}</td><td>${f2(b.tally.precision)}</td><td>${f2(b.tally.recall)}</td></tr>`).join("");
    const here = new Map(rows.map((r) => [r.object + "/" + r.prompt, r.outcome]));
    $("ld-hard").innerHTML = `<thead><tr><th>Object</th><th>Word</th><th>Really there?</th><th>Right at</th><th>At your line</th><th>What it did</th></tr></thead>` +
      hardness(data, cfg).map((h) => { const o = here.get(h.object + "/" + h.prompt)!; const [txt, col] = OUTCOME_TEXT[o]; return `<tr><td>${h.object}</td><td>${h.prompt}</td><td>${h.expected === "present" ? "yes" : "no"}</td><td>${pct(h.rightShare)}</td><td style="color:${col};font-weight:600">${txt}</td><td class="small">${h.note ?? ""}</td></tr>`; }).join("");
    drawCurve();
    if (eqShown) showEq();
    $("ld-ours").hidden = false;
    $("ld-ours-p").textContent = "The game does not use this detector to place holds. It found 2 of 9 real parts, and both were the top tube of a handrail. It made up a part in 11 of 13 cases where none exists, because it has to answer for every word it is given and it was trained on furniture-like parts, not skate-park edges. Sliding the claim line cannot fix that: the curve above never gets near a safe F1, since the made-up parts and the real ones are painted in the same amounts. So holds stay as pieces placed by a person or by the bar tools whose results the simulator checks, and we will test a newer release before we think again.";
    document.documentElement.dataset.labReady = "true";
  };
  const showEq = () => {
    eqShown = true; $("ld-eq-btn").hidden = true; $("ld-eq-body").hidden = false;
    const t = evaluate(data!, cfg).tally;
    $("ld-eq-body").textContent =
`Counts: TP = found, FN = missed, FP = made up, TN = correctly empty.
  precision  P = TP / (TP + FP) = ${t.found} / ${t.found + t.madeUp}  = ${f2(t.precision)}
  recall     R = TP / (TP + FN) = ${t.found} / ${t.real}  = ${f2(t.recall)}
  F1         F = 2 P R / (P + R)  = ${f2(t.f1)}   (the harmonic mean: it sits near the smaller of P and R)

A claim: painted share a > ${cfg.claimMin.toFixed(2)} of the object's surface area.
Found: claim, and  inside = (painted area on the real hold) / (painted area) >= ${cfg.insideMin.toFixed(2)},
  and  cover = (painted area on the real hold) / (area of the real hold) >= 0.33.
Sliding the claim line moves a along the curve: a higher line cuts FP and TP together.
Here a "missed" part that was painted in the wrong place counts only as FN, not also as FP.
Only ${t.real + t.none} cases: one case moves recall by ${f2(1 / Math.max(1, t.real))} and F1 by a lot, so read the shape, not the third digit.`;
  };
  $<HTMLButtonElement>("ld-eq-btn").onclick = showEq;
  $<HTMLButtonElement>("ld-keep").onclick = () => {
    if (!data) return;
    const t = evaluate(data, cfg).tally;
    kept++; $("ld-hist").hidden = false;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${kept}</td><td>${cfg.prompts.join(", ") || "none"}</td><td>${pct(cfg.claimMin)}</td><td>${pct(cfg.insideMin)}</td><td>${t.found} of ${t.real}</td><td>${t.madeUp} of ${t.none}</td><td>${f2(t.f1)}</td>`;
    $("ld-rows").prepend(tr);
    document.documentElement.dataset.labDone = String(kept);
  };
  const bind = (id: string, set: (v: number) => void) => $<HTMLInputElement>(id).addEventListener("input", (e) => { set(Number((e.target as HTMLInputElement).value)); render(); });
  bind("ld-claim", (v) => (cfg.claimMin = v)); bind("ld-in", (v) => (cfg.insideMin = v));
  $<HTMLInputElement>("ld-claim").value = String(cfg.claimMin); $<HTMLInputElement>("ld-in").value = String(cfg.insideMin);

  fetch(DATA_URL).then((r) => r.json()).then((d: DetectorData) => { data = d; labDefaultNote(wrap, "live", wrap.querySelector("h1")); render(); labPopulated("lab-detector"); });
  return { backend: "canvas2d" };
}
