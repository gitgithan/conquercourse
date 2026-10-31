import { DEFAULT_CONFIG, DEFAULT_RULES, REASONS, buildProposals, clampRules, tally, testProposal, type Config, type Proposal, type Source, type Tally, type Verdict } from "../labs/gentest/core";
import type { Layout } from "../slice/photo-course";
import { itemLength } from "../slice/course-agent";
import { labsOn } from "../ui/labs";

// Lab 9: Generate and test. A helper proposes courses; the player sets what it may propose; the real simulator throws out the ones that cannot be cleared.
// The page makes no model call: the "Muse" proposals are recorded replies (public/assets/lab/gentest-proposals.json) and a built-in random proposer.
// It shows facts and pictures only. Behind the labs switch (?labs=1).
const URL_POOL = "/assets/lab/gentest-proposals.json";
const INK = "#17201d", TEAL = "#0f6b5c", WARN = "#b45309", BAD = "#b91c1c", DECK = "#9fb0a5", WATER = "#b7d3ee";
const SOURCES: [Source, string, string][] = [
  ["recorded", "Recorded Muse", "100 course ideas an AI model wrote earlier, replayed here. Nothing is asked of a model now."],
  ["random", "Random draw", "A built-in dice-roller: pieces and sizes chosen at random inside your rules."],
  ["both", "Both", "The recorded ideas first, then the random ones."],
];

interface Done { verdicts: Verdict[]; wallMs: number; cfg: Config; tally: Tally }
type Pool = { id: string; theme: string; layout: Layout | null }[];

export function startLabGentest(host: HTMLElement): { backend: "canvas2d" } {
  const root = document.createElement("div");
  root.id = "lab-gentest";
  root.style.cssText = `position:fixed;inset:0;overflow:auto;background:#f5f7f4;color:${INK};font:15px/1.4 system-ui,sans-serif`;
  host.append(root);
  if (!labsOn()) {
    root.innerHTML = `<div style="max-width:520px;margin:12vh auto;padding:0 16px"><h1 style="font-size:22px">Lab 9: Generate and test</h1><p>Labs are switched off.</p><p><a href="?mode=lab-gentest&labs=1" style="color:${TEAL}">Switch labs on</a></p></div>`;
    return { backend: "canvas2d" };
  }
  const style = document.createElement("style");
  style.textContent = `
    #lab-gentest .wrap{max-width:1040px;margin:0 auto;padding:16px;display:grid;gap:14px}
    #lab-gentest h1{font-size:22px;margin:0}#lab-gentest h2{font-size:15px;margin:0 0 6px}
    #lab-gentest .grid{display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr);gap:14px;align-items:start}
    #lab-gentest .card{background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:12px}
    #lab-gentest label{display:grid;gap:2px;margin:8px 0}#lab-gentest input[type=range]{width:100%}
    #lab-gentest .chk{display:flex;gap:6px;align-items:center;margin:4px 0}
    #lab-gentest .seg{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
    #lab-gentest .seg button{font:600 13px system-ui;padding:8px 4px;border:1px solid #b9c4bb;border-radius:8px;background:#fff;color:${INK};cursor:pointer}
    #lab-gentest .seg button[aria-pressed=true]{border-color:${TEAL};background:#e6f2ee}
    #lab-gentest .go{font:700 15px system-ui;padding:10px 14px;border:0;border-radius:8px;background:${TEAL};color:#fff;cursor:pointer;width:100%;margin-top:6px}
    #lab-gentest .go:disabled{opacity:.6;cursor:default}
    #lab-gentest .facts{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:0}
    #lab-gentest .facts dt{color:#52605a}#lab-gentest .facts dd{margin:0;font-weight:600}
    #lab-gentest table{border-collapse:collapse;width:100%;font-size:13px}#lab-gentest th,#lab-gentest td{text-align:left;padding:3px 8px 3px 0;border-bottom:1px solid #e3e8e4}
    #lab-gentest .small{color:#52605a;font-size:13px}
    #lab-gentest .eq{font:14px/1.6 ui-monospace,Menlo,monospace;background:#f1f4f1;border-radius:8px;padding:8px 10px;white-space:pre-wrap;overflow-x:auto}
    #lab-gentest button.link{background:none;border:0;color:${TEAL};font:600 14px system-ui;cursor:pointer;padding:0;text-decoration:underline}
    #lab-gentest a.back{color:${TEAL};font-weight:600}
    #lab-gentest .strip{display:flex;flex-wrap:wrap;gap:3px}
    #lab-gentest .strip button{width:16px;height:16px;border:0;border-radius:3px;padding:0;cursor:pointer;background:#c9d1cb}
    #lab-gentest .strip button[aria-pressed=true]{outline:2px solid ${INK};outline-offset:1px}
    #lab-gentest .bar{display:inline-block;height:10px;background:${WARN};border-radius:3px;vertical-align:middle}
    #lab-gentest .key{display:inline-block;width:11px;height:11px;border-radius:3px;vertical-align:-1px;margin:0 3px 0 8px}
  `;
  root.append(style);
  const wrap = document.createElement("div"); wrap.className = "wrap"; root.append(wrap);
  wrap.innerHTML = `
    <div><a class="back" href="/?welcome=0">Back to the game</a>
    <h1>Lab 9: Generate and test</h1>
    <p class="small" style="margin:4px 0 0">The goal: let a helper propose courses, and count how many the simulator throws out. You decide what the helper may propose. The simulator decides what is allowed to stay.</p></div>
    <div class="grid">
      <div class="card" id="gt-controls">
        <h2>Your choices</h2>
        <div class="seg" id="gt-source" role="group" aria-label="Who proposes"></div>
        <p class="small" id="gt-about" style="margin:6px 0"></p>
        <h2 style="margin-top:10px">Pieces it may use</h2>
        <div class="small" style="margin-bottom:2px">Ground is always allowed.</div>
        <label class="chk"><input type="checkbox" id="gt-gap"> Gaps</label>
        <label class="chk"><input type="checkbox" id="gt-block"> Blocks (steps and walls)</label>
        <label class="chk"><input type="checkbox" id="gt-bar"> Bars to swing from</label>
        <h2 style="margin-top:10px">Sizes it may use</h2>
        <label>Gap width, at least <b id="gt-gmin-v"></b> m<input id="gt-gmin" type="range" min="1.2" max="9" step="0.1"></label>
        <label>Gap width, at most <b id="gt-gmax-v"></b> m<input id="gt-gmax" type="range" min="1.2" max="9" step="0.1"></label>
        <label>Block height, at least <b id="gt-bmin-v"></b> m<input id="gt-bmin" type="range" min="0.2" max="2.5" step="0.05"></label>
        <label>Block height, at most <b id="gt-bmax-v"></b> m<input id="gt-bmax" type="range" min="0.2" max="2.5" step="0.05"></label>
        <label>Pieces in one proposal, at most <b id="gt-items-v"></b><input id="gt-items" type="range" min="3" max="12" step="1"></label>
        <h2 style="margin-top:10px">Test, then repair</h2>
        <label>Repairs allowed per proposal: <b id="gt-rep-v"></b><input id="gt-rep" type="range" min="0" max="4" step="1"></label>
        <button class="go" id="gt-run">Test the proposals</button>
      </div>
      <div style="display:grid;gap:14px;min-width:0">
        <div class="card" id="gt-out"><h2>What the simulator decided</h2><p class="small" id="gt-none">Run the test to see facts here.</p><dl class="facts" id="gt-facts" hidden></dl></div>
        <div class="card" id="gt-strip-card" hidden><h2>Every proposal, in order</h2>
          <div class="strip" id="gt-strip"></div>
          <p class="small" style="margin:6px 0 0"><span class="key" style="background:${TEAL};margin-left:0"></span>cleared as proposed<span class="key" style="background:#7fb7a8"></span>cleared after a repair<span class="key" style="background:${BAD}"></span>thrown out<span class="key" style="background:#c9d1cb"></span>not tested yet. Click one to see it.</p>
          <canvas id="gt-pic" width="940" height="170" style="width:100%;height:auto;display:block;border-radius:6px;background:#eef3ee;margin-top:8px"></canvas>
          <p class="small" id="gt-pic-note" style="margin:4px 0 0"></p></div>
        <div class="card" id="gt-why-card" hidden><h2>Why they were thrown out</h2><table><tbody id="gt-why"></tbody></table><p class="small" style="margin:6px 0 0">The reason is where the runner's best try stopped on the first test.</p></div>
        <div class="card" id="gt-hist" hidden><h2>Your runs so far</h2><table><thead><tr><th>#</th><th>Who</th><th>Tested</th><th>Cleared first try</th><th>After repairs</th><th>Thrown out</th><th>Tries to one clear</th></tr></thead><tbody id="gt-rows"></tbody></table></div>
        <div class="card" id="gt-ours" hidden><h2>What the game does</h2><p id="gt-ours-p" style="margin:0 0 6px"></p><p class="small" id="gt-ours-n" style="margin:0"></p></div>
        <div class="card" id="gt-eq" hidden><h2>The maths</h2><button class="link" id="gt-eq-btn">Show the maths behind your run</button><div class="eq" id="gt-eq-body" hidden></div></div>
      </div>
    </div>`;
  const $ = <T extends HTMLElement>(id: string): T => wrap.querySelector("#" + id) as T;
  const cfg: Config = { ...DEFAULT_CONFIG, rules: { ...DEFAULT_RULES } };
  let pool: Pool = [];
  let last: Done | null = null;
  let history = 0;
  let chosen = 0;
  const num = (id: string) => Number($<HTMLInputElement>(id).value);

  const sync = () => {
    const seg = $("gt-source");
    seg.innerHTML = "";
    for (const [s, label] of SOURCES) {
      const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.dataset.source = s; b.setAttribute("aria-pressed", String(cfg.source === s));
      b.onclick = () => { cfg.source = s; sync(); };
      seg.append(b);
    }
    $("gt-about").textContent = SOURCES.find(([s]) => s === cfg.source)![2];
    const r = cfg.rules;
    $("gt-gmin-v").textContent = r.gapMin.toFixed(1); $("gt-gmax-v").textContent = r.gapMax.toFixed(1);
    $("gt-bmin-v").textContent = r.blockMin.toFixed(2); $("gt-bmax-v").textContent = r.blockMax.toFixed(2);
    $("gt-items-v").textContent = String(r.maxItems); $("gt-rep-v").textContent = String(cfg.repairs);
    for (const id of ["gt-gmin", "gt-gmax"]) $<HTMLInputElement>(id).disabled = !r.gap;
    for (const id of ["gt-bmin", "gt-bmax"]) $<HTMLInputElement>(id).disabled = !r.block;
  };
  const read = () => {
    cfg.rules = clampRules({ ...cfg.rules, gap: $<HTMLInputElement>("gt-gap").checked, block: $<HTMLInputElement>("gt-block").checked, bar: $<HTMLInputElement>("gt-bar").checked, gapMin: num("gt-gmin"), gapMax: num("gt-gmax"), blockMin: num("gt-bmin"), blockMax: num("gt-bmax"), maxItems: num("gt-items") });
    cfg.repairs = num("gt-rep");
    for (const [id, v] of [["gt-gmin", cfg.rules.gapMin], ["gt-gmax", cfg.rules.gapMax], ["gt-bmin", cfg.rules.blockMin], ["gt-bmax", cfg.rules.blockMax]] as [string, number][]) $<HTMLInputElement>(id).value = String(v);
    sync();
  };
  const r0 = cfg.rules;
  $<HTMLInputElement>("gt-gap").checked = r0.gap; $<HTMLInputElement>("gt-block").checked = r0.block; $<HTMLInputElement>("gt-bar").checked = r0.bar;
  $<HTMLInputElement>("gt-gmin").value = String(r0.gapMin); $<HTMLInputElement>("gt-gmax").value = String(r0.gapMax);
  $<HTMLInputElement>("gt-bmin").value = String(r0.blockMin); $<HTMLInputElement>("gt-bmax").value = String(r0.blockMax);
  $<HTMLInputElement>("gt-items").value = String(r0.maxItems); $<HTMLInputElement>("gt-rep").value = String(cfg.repairs);
  for (const id of ["gt-gap", "gt-block", "gt-bar", "gt-gmin", "gt-gmax", "gt-bmin", "gt-bmax", "gt-items", "gt-rep"]) $(id).addEventListener("input", read);
  sync();

  // ---- the picture: one proposal, side view ----
  const canvas = $<HTMLCanvasElement>("gt-pic");
  const g = canvas.getContext("2d")!;
  const drawLayout = (v: Verdict | null) => {
    const W = canvas.width, H = canvas.height;
    g.clearRect(0, 0, W, H);
    if (!v || !v.layout) { g.fillStyle = "#52605a"; g.font = "14px system-ui"; g.fillText(v ? "This reply was not a course, so there is nothing to draw." : "Click a proposal above.", 12, 28); return; }
    const draw = (l: Layout, dy: number, scaleH: number, label: string, stop: number) => {
      const total = l.items.reduce((s, it) => s + itemLength(it), 0) || 1;
      const sx = (W - 24) / Math.max(total, 30), base = dy + scaleH - 6;
      const sy = (scaleH - 24) / 4;
      let x = 12;
      l.items.forEach((it, i) => {
        const w = itemLength(it) * sx;
        g.fillStyle = DECK;
        if (it.kind === "ground") g.fillRect(x, base - 3, w, 3);
        else if (it.kind === "block") g.fillRect(x, base - it.height * sy, w, it.height * sy);
        else if (it.kind === "gap") { g.fillStyle = WATER; g.fillRect(x, base - 2, w, 8); }
        else { g.fillStyle = INK; g.fillRect(x - 3, base - it.height * sy, 6, 6); g.fillRect(x - 1, base - it.height * sy, 2, it.height * sy - 3); }
        if (i === stop && !v.cleared) { g.strokeStyle = BAD; g.lineWidth = 2; g.strokeRect(x - 2, base - (it.kind === "block" ? it.height * sy : 2.5 * sy) - 4, Math.max(w, 6) + 4, (it.kind === "block" ? it.height * sy : 2.5 * sy) + 14); }
        x += w;
      });
      g.fillStyle = "#52605a"; g.font = "12px system-ui"; g.fillText(label, 12, dy + 12);
    };
    if (v.fixed) { draw(v.layout, 0, H / 2, "As proposed (thrown out)", v.stoppedAt); draw(v.fixed, H / 2, H / 2, `After ${v.repairsUsed} repair${v.repairsUsed === 1 ? "" : "s"} (cleared)`, -1); }
    else draw(v.layout, 0, H, v.firstClear ? "As proposed (cleared)" : "As proposed (thrown out; red box: where the best try stopped)", v.stoppedAt);
    const note = v.firstClear ? "Cleared as proposed." : v.cleared ? `Cleared after ${v.repairsUsed} repair${v.repairsUsed === 1 ? "" : "s"}: the piece where the runner stopped was eased by a fifth each time.` : `Thrown out: ${v.why!.toLowerCase()}${v.repairsUsed ? `, and ${v.repairsUsed} repair${v.repairsUsed === 1 ? "" : "s"} did not save it` : ""}.`;
    $("gt-pic-note").textContent = `${v.id} (${v.source}, ${v.theme}). ${note}`;
  };
  const colour = (v: Verdict) => (v.firstClear ? TEAL : v.cleared ? "#7fb7a8" : BAD);
  const buildStrip = (vs: Verdict[], total: number) => {
    const strip = $("gt-strip"); strip.innerHTML = "";
    for (let i = 0; i < total; i++) {
      const b = document.createElement("button"); b.type = "button"; b.title = vs[i] ? `${vs[i].id}: ${vs[i].firstClear ? "cleared" : vs[i].cleared ? "cleared after repair" : "thrown out"}` : "not tested yet";
      if (vs[i]) { b.style.background = colour(vs[i]); const k = i; b.onclick = () => { chosen = k; mark(); drawLayout(vs[k]); }; }
      b.setAttribute("aria-pressed", String(i === chosen)); strip.append(b);
    }
  };
  const mark = () => { [...$("gt-strip").children].forEach((c, i) => c.setAttribute("aria-pressed", String(i === chosen))); };

  // ---- running ----
  let worker: Worker | null = null;
  let job = 0;
  const runBtn = $<HTMLButtonElement>("gt-run");
  const finish = (verdicts: Verdict[], wallMs: number, used: Config) => {
    const t = tally(verdicts);
    last = { verdicts, wallMs, cfg: used, tally: t }; history++;
    $("gt-none").hidden = true;
    const facts = $("gt-facts"); facts.hidden = false;
    const skipped = used.source === "random" ? 0 : pool.length - verdicts.filter((v) => v.source === "recorded").length;
    const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
    const rows: [string, string][] = [
      ["Proposals tested", used.source === "random" ? String(t.tested) : `${t.tested}${skipped ? `, and ${skipped} recorded ones left out because they break your rules` : ""}`],
      ["Cleared as proposed", `${t.first} (${pct(t.pFirst)})`],
      ["Cleared after repairs", used.repairs ? `${t.afterRepair} more, so ${t.first + t.afterRepair} in all (${pct(t.pRepair)})` : "repairs are off"],
      ["Thrown out", `${t.thrown} (${pct(t.tested ? t.thrown / t.tested : 0)})`],
      ["Proposals until the first clear", t.firstIndex ? `${t.firstIndex}${used.repairs && t.firstIndexRepair !== t.firstIndex ? ` (${t.firstIndexRepair} with repairs)` : ""}` : "none cleared"],
      ["Expected tries for one clear", t.triesFirst ? `${t.triesFirst.toFixed(1)} as proposed${used.repairs && t.triesRepair ? `, ${t.triesRepair.toFixed(1)} with repairs` : ""}` : "no clear, so no estimate"],
      ["Simulator work", `${(t.ticks / 1000).toFixed(0)} thousand ticks, ${(wallMs / 1000).toFixed(1)} s on this device`],
    ];
    facts.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
    $("gt-strip-card").hidden = false; $("gt-why-card").hidden = false;
    chosen = Math.max(0, verdicts.findIndex((v) => !v.firstClear));
    buildStrip(verdicts, verdicts.length); drawLayout(verdicts[chosen] ?? null);
    const most = Math.max(1, ...Object.values(t.reasons));
    $("gt-why").innerHTML = REASONS.filter((r) => t.reasons[r]).map((r) => `<tr><td>${r}</td><td>${t.reasons[r]}</td><td style="width:50%"><span class="bar" style="width:${(t.reasons[r] / most) * 100}%"></span></td></tr>`).join("") || `<tr><td>Nothing was thrown out.</td></tr>`;
    $("gt-hist").hidden = false;
    const tr = document.createElement("tr");
    const who = SOURCES.find(([s]) => s === used.source)![1];
    tr.innerHTML = `<td>${history}</td><td>${who}, ${used.repairs} repair${used.repairs === 1 ? "" : "s"}</td><td>${t.tested}</td><td>${t.first}</td><td>${t.afterRepair}</td><td>${t.thrown}</td><td>${t.triesRepair ? t.triesRepair.toFixed(1) : "-"}</td>`;
    $("gt-rows").prepend(tr);
    // our setting comes last, after the player has a result of their own
    $("gt-ours").hidden = false;
    $("gt-ours-p").textContent = "In the game the models only propose and the simulator decides, last. A course idea never reaches a player until the real ideal-run search has cleared it, and a repair is kept only if it is cleared too. We chose this because a model can write a course that sounds fine and cannot be cleared, and only the simulator can tell, while a rejected idea costs nothing but one test.";
    $("gt-ours-n").textContent = "Recorded run of 100 asks (Muse Spark Open): 95 gave a course, 20 cleared as drawn, 33 cleared after the editor's Fix it. The pool the game draws from holds only cleared ones.";
    $("gt-eq").hidden = false;
    document.documentElement.dataset.labDone = String(history);
    runBtn.disabled = false; runBtn.textContent = "Test the proposals";
  };
  runBtn.onclick = () => {
    if (!pool.length) return;
    read();
    const used: Config = { ...cfg, rules: { ...cfg.rules } };
    const proposals: Proposal[] = buildProposals(pool, used);
    if (!proposals.length) { $("gt-none").hidden = false; $("gt-none").textContent = "Your rules leave nothing to test. Allow more pieces or wider sizes."; return; }
    runBtn.disabled = true; runBtn.textContent = "Testing";
    $("gt-strip-card").hidden = false;
    buildStrip([], proposals.length);
    const id = ++job;
    const inline = () => { const t = Date.now(); finish(proposals.map((p) => testProposal(p, used.rules, used.repairs)), Date.now() - t, used); };
    try { worker ??= new Worker(new URL("../labs/gentest/worker.ts", import.meta.url), { type: "module" }); } catch { inline(); return; }
    worker.onmessage = (e: MessageEvent) => {
      const d = e.data as { id: number; i?: number; n?: number; done?: boolean; verdicts?: Verdict[]; wallMs?: number };
      if (d.id !== id) return;
      if (d.done) finish(d.verdicts!, d.wallMs!, used); else runBtn.textContent = `Testing: ${d.i} of ${d.n}`;
    };
    worker.onerror = () => { worker = null; inline(); };
    worker.postMessage({ id, proposals, rules: used.rules, repairs: used.repairs });
  };
  $<HTMLButtonElement>("gt-eq-btn").onclick = () => {
    const b = $("gt-eq-body"); const t = last?.tally;
    b.hidden = false;
    b.textContent =
`Each proposal is tested once, and it either clears or it does not.
  p = cleared / tested        your run: p = ${t ? t.first : "?"} / ${t ? t.tested : "?"}${t ? " = " + t.pFirst.toFixed(3) : ""}

If every proposal clears with the same chance p, the number of tries until the first clear is geometric:
  P(first clear on try k) = (1 - p)^(k-1) · p
  E[tries] = 1 / p${t && t.triesFirst ? "                   your run: 1 / " + t.pFirst.toFixed(3) + " = " + t.triesFirst.toFixed(1) : ""}

A repair gives each thrown-out proposal another chance, so the clear rate rises:
  p_repaired = p + (1 - p) · q       q = share of thrown-out proposals a repair saves${t ? "\n  your run: p = " + t.pFirst.toFixed(3) + ", p_repaired = " + t.pRepair.toFixed(3) : ""}
  A repair costs one more test each, so it pays off when  1 / p_repaired  is smaller than  1 / p  by more than the extra tests it needs.

The rules you set change p. A narrower rule set removes proposals the simulator would have thrown out, and also removes some that would have cleared.`;
    $<HTMLButtonElement>("gt-eq-btn").hidden = true;
  };

  fetch(URL_POOL).then((r) => r.json()).then((d: { proposals: Pool }) => { pool = d.proposals; document.documentElement.dataset.labReady = "true"; });
  return { backend: "canvas2d" };
}
