import { mountLabsNav } from "../ui/labs-nav";
import { labNumberOf } from "../ui/labs-series";
import { labsOn } from "../ui/labs";
import { labDefaultNote, labPopulated } from "../ui/lab-default";
import type { Layout } from "../slice/layout-draft";
import type { AgentReport } from "../slice/course-agent";
import {
  CHALLENGES, EASED_WALL, GATES, KINDS, WALL_ASKED, fixStep, harderPass, honestPass, key, oneChangePass, readAnswer, ruleProblems, setSize, sizeOf, swapKind, totalLength, verdictOf,
  type Answer, type Gate, type Kind,
} from "../labs/partner/partner-core";

// Lab 17: Design partner loop (propose, check, fix). A recorded answer of the design partner (Muse Spark Open) is read by the game's reader, checked by the game's own
// simulator tool (testLayout, in a worker) and repaired with the change the simulator proved. No model is called and nothing here talks to the player or grades technique:
// the loop is about the COURSE. Behind the labs switch (?labs=1).
const INK = "#17201d", TEAL = "#0f6b5c", ORANGE = "#d9741a", GREY = "#9aa5a0", RED = "#b91c1c", WATER = "#7fb3d5", DECK = "#6b7a72";
const W = 1100, H = 300;
const STAGES = ["Brief", "Propose", "Check", "Fix it", "Cleared"];
const STAGE_SAY = [
  "The brief is the idea we give the partner, in a few words.",
  "The partner answers with pieces on a lane. This is a recorded answer.",
  "The simulator searches for a run. Red marks the piece that stops it.",
  "Fix it applies the one change the simulator proved, then checks again.",
  "Only a course the simulator clears is ever shown as a course.",
];

export function startLabPartner(host: HTMLElement): { backend: "canvas2d" } {
  const root = document.createElement("div");
  root.id = "lab-partner";
  root.style.cssText = `position:fixed;inset:0;overflow:auto;background:#f5f7f4;color:${INK};font:15px/1.4 system-ui,sans-serif`;
  host.append(root);
  mountLabsNav(host, "lab-partner");
  if (!labsOn()) {
    root.innerHTML = `<div style="max-width:520px;margin:12vh auto;padding:0 16px"><h1 style="font-size:22px">Lab ${labNumberOf("lab-partner")}: Design partner loop</h1><p>Labs are switched off.</p><p><a href="?mode=lab-partner&labs=1" style="color:${TEAL}">Switch labs on</a></p></div>`;
    return { backend: "canvas2d" };
  }
  const style = document.createElement("style");
  style.textContent = `
    #lab-partner .wrap{max-width:1200px;margin:0 auto;padding:54px 16px 16px;display:grid;gap:12px}
    #lab-partner h1{font-size:22px;margin:0}#lab-partner h2{font-size:15px;margin:0 0 6px}
    #lab-partner .grid{display:grid;grid-template-columns:320px minmax(0,1fr);gap:14px;align-items:start}#lab-partner .grid>div{min-width:0}
    #lab-partner .card{background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:12px}
    #lab-partner label{display:grid;gap:2px;margin:8px 0}#lab-partner input[type=range]{width:100%}
    #lab-partner select{font:14px system-ui;padding:6px;border:1px solid #b9c4bb;border-radius:8px;width:100%}
    #lab-partner canvas{width:100%;height:auto;display:block;border-radius:6px;background:#eef3ee;touch-action:none}
    #lab-partner .small{color:#52605a;font-size:13px}
    #lab-partner button{font:600 13px system-ui;padding:6px 9px;border:1px solid #b9c4bb;border-radius:8px;background:#fff;color:${INK};cursor:pointer}
    #lab-partner button[aria-pressed=true]{border-color:${TEAL};background:#e6f2ee}
    #lab-partner button:disabled{opacity:.5;cursor:default}
    #lab-partner .row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
    #lab-partner .go{background:${TEAL};color:#fff;border-color:${TEAL};font-weight:700;font-size:14px;padding:8px 12px}
    #lab-partner .gates{display:flex;gap:6px;align-items:stretch;flex-wrap:wrap}
    #lab-partner .gate{flex:1;min-width:150px;border:2px solid #cdd8d1;border-radius:10px;padding:8px;background:#fff}
    #lab-partner .gate b{display:block}#lab-partner .gate.pass{border-color:${TEAL};background:#e6f2ee}#lab-partner .gate.stop{border-color:${RED};background:#fdecec}
    #lab-partner .arrow{align-self:center;color:${GREY};font-weight:700}
    #lab-partner .good{color:${TEAL};font-weight:700}#lab-partner .bad{color:${RED};font-weight:700}
    #lab-partner pre{background:#f1f4f1;border-radius:8px;padding:8px;font:12px/1.4 ui-monospace,Menlo,monospace;white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0 0}
    #lab-partner a{color:${TEAL};font-weight:600}
    #lab-partner .chip{display:inline-block;border:1px solid #b9c4bb;border-radius:999px;padding:2px 9px;font-size:12px;background:#fff}
  `;
  root.append(style);
  const wrap = document.createElement("div"); wrap.className = "wrap"; root.append(wrap);
  const kindButtons = KINDS.map((k) => `<button data-kind="${k.kind}" aria-pressed="false" title="${k.about}">${k.label}</button>`).join("");
  wrap.innerHTML = `
    <div><a href="/?welcome=0">Back to the game</a>
    <h1>Lab ${labNumberOf("lab-partner")}: Design partner loop</h1>
    <p class="small" style="margin:2px 0 0"><b>Idea to course.</b> The partner proposes. The simulator judges. A course that cannot be proved is never shown.</p>
</div>
    <div class="card"><div class="gates" id="lp-gates"></div></div>
    <div class="grid">
      <div style="display:grid;gap:12px">
        <div class="card"><h2>1. The partner's answer</h2>
          <div class="row" id="lp-kinds">${kindButtons}</div>
          <label>Brief<select id="lp-pick"></select></label>
          <p class="small" id="lp-source" style="margin:0"></p>
          <pre id="lp-reply"></pre></div>
        <div class="card"><h2>2. Edit the course</h2>
          <p class="small" style="margin:0" id="lp-sel">Click a piece in the picture.</p>
          <label><span id="lp-size-l">Size</span><input id="lp-size" type="range" min="0.2" max="4" step="0.05"></label>
          <div class="row" id="lp-swap"><button data-k="gap">Gap</button><button data-k="block">Block</button><button data-k="bar">Bar</button></div>
          <div class="row" style="margin-top:8px"><button id="lp-reset">Back to the partner's answer</button></div>
          <p class="small" style="margin:6px 0 0">Drag a block or bar up and down in the picture, or a gap left and right.</p></div>
        <div class="card"><h2>3. Challenges</h2>
          <div class="row" id="lp-ch"></div>
          <p id="lp-ch-ask" style="margin:8px 0 4px"></p>
          <p id="lp-ch-status" style="margin:0;font-weight:700"></p>
          <div id="lp-ch-why"></div>
          <div class="row" style="margin-top:6px"><button id="lp-reveal">What we did</button></div>
          <p class="small" id="lp-reveal-text" style="margin:6px 0 0"></p></div>
      </div>
      <div style="display:grid;gap:12px">
        <div class="card"><div class="row" id="lp-stages"></div>
          <p style="margin:8px 0 4px;font-weight:600" id="lp-say"></p>
          <canvas id="lp-pic" width="${W}" height="${H}" role="img" aria-label="Side view of the proposed course with the simulator's run drawn over it"></canvas>
          <div class="row" style="margin-top:8px">
            <button id="lp-prev">Back</button><button id="lp-next">Next step</button>
            <button class="go" id="lp-fix">Fix it</button><button id="lp-play">Play the loop</button></div></div>
        <div class="card"><h2>What the simulator says</h2><p id="lp-words" style="margin:0"></p><p class="small" id="lp-fixes" style="margin:6px 0 0"></p></div>
        <div class="card"><h2>The guard rails</h2>
          <p class="small" style="margin:0">The partner never decides. A reply that has no course, breaks a rule or cannot be cleared stops at a gate and is never drawn as a course in the game.</p>
          <p class="small" style="margin:6px 0 0">Uploaded photos have their own safety check before any model sees them: <a href="https://github.com/gitgithan/conquercourse/blob/main/docs/trust-and-safety.md">trust and safety</a>. This Lab takes words only.</p></div>
      </div>
    </div>`;
  const $ = <T extends HTMLElement>(id: string): T => wrap.querySelector("#" + id) as T;
  const canvas = $<HTMLCanvasElement>("lp-pic"), g = canvas.getContext("2d")!;
  const note = labDefaultNote(wrap, "live", wrap.querySelector("p.small") as HTMLElement | null);

  // ---- state ----
  let answers: Answer[] = [];
  const cache = new Map<string, AgentReport>();
  let idx = 0, stage = 1, sel = -1, cur: Layout | null = null, orig: Layout | null = null, report: AgentReport | null = null, pending = false;
  let fixes: string[] = [], challenge = "", seq = 0, timer = 0, auto = 0;
  let worker: Worker | null = null;
  const waiting = new Map<number, (r: AgentReport) => void>();
  const ask = (l: Layout): Promise<AgentReport> => {
    const k = key(l), hit = cache.get(k);
    if (hit) return Promise.resolve(hit);
    return new Promise((res) => {
      worker ??= new Worker(new URL("../labs/partner/worker.ts", import.meta.url), { type: "module" });
      const id = ++seq; waiting.set(id, (r) => { cache.set(k, r); res(r); });
      worker.onmessage = (e: MessageEvent) => { const f = waiting.get(e.data.id); waiting.delete(e.data.id); f?.(e.data.report); };
      worker.postMessage({ id, layout: l });
    });
  };
  const retest = (delay = 350) => {
    window.clearTimeout(timer); report = null; pending = true; render();
    const mine = cur;
    timer = window.setTimeout(async () => { if (!mine) return; const r = await ask(mine); if (mine === cur) { report = r; pending = false; render(); } }, delay);
  };

  const answer = (): Answer => answers[idx];
  const load = (i: number) => {
    idx = i; const a = answer(); const r = readAnswer(a);
    cur = orig = r.layout; sel = -1; fixes = []; report = null; pending = false; window.clearTimeout(timer);
    if (cur && !ruleProblems(cur).length) { const hit = cache.get(key(cur)); if (hit) report = hit; else retest(0); }
    renderAll();
  };

  // ---- picture ----
  const geo = (l: Layout) => {
    const total = Math.max(totalLength(l), 14), sx = (W - 40) / total, base = H - 50, sy = (H - 90) / 3.6;
    let x = 20; const xs: { x: number; w: number }[] = [];
    for (const it of l.items) { const w = (it.kind === "bar" ? 0.6 : sizeOf(it) * 0 + (it.kind === "gap" ? it.width : it.kind === "ground" ? it.length : it.kind === "block" ? it.length : 0)) * sx; xs.push({ x, w }); x += w; }
    return { xs, sx, sy, base };
  };
  const draw = () => {
    g.clearRect(0, 0, W, H);
    g.fillStyle = "#52605a"; g.font = "13px system-ui";
    if (stage === 1) { g.font = "600 18px system-ui"; g.fillStyle = INK; g.fillText(`Brief: "${answer().brief}"`, 20, 60); g.font = "13px system-ui"; g.fillStyle = "#52605a"; g.fillText("The lane is empty until the partner answers.", 20, 90); g.fillStyle = GREY; g.fillRect(20, H - 53, W - 40, 3); return; }
    if (!cur) { g.font = "600 16px system-ui"; g.fillStyle = RED; g.fillText("No course in this reply, so there is nothing to draw.", 20, 60); g.font = "13px system-ui"; g.fillStyle = "#52605a"; g.fillText("The reader stopped it before any test.", 20, 88); return; }
    const { xs, sx, sy, base } = geo(cur);
    const stopAt = stage >= 3 && report && !report.cleared ? report.stoppedAtItem : null;
    cur.items.forEach((it, i) => {
      const { x, w } = xs[i];
      g.fillStyle = DECK;
      if (it.kind === "ground") g.fillRect(x, base, w, 4);
      else if (it.kind === "block") g.fillRect(x, base - it.height * sy, w, it.height * sy + 4);
      else if (it.kind === "gap") { g.fillStyle = WATER; g.fillRect(x, base + 4, w, 14); g.fillStyle = "#b9d8ee"; for (let k = 0; k < w; k += 14) g.fillRect(x + k, base + 4, 7, 2); }
      else { g.fillStyle = INK; g.fillRect(x - 3, base - it.height * sy - 3, 8, 8); g.fillRect(x - 1, base - it.height * sy, 3, it.height * sy); g.fillStyle = ORANGE; g.fillRect(x - 6, base - it.height * sy - 4, 14, 4); }
      if (i === sel) { g.strokeStyle = TEAL; g.lineWidth = 2; g.setLineDash([5, 3]); const hh = it.kind === "block" ? it.height * sy : it.kind === "bar" ? it.height * sy : 24; g.strokeRect(x - 4, base - hh - 8, Math.max(w, 12) + 8, hh + 30); g.setLineDash([]); }
      if (orig && fixes.length && orig.items[i] && JSON.stringify(orig.items[i]) !== JSON.stringify(it)) {
        const o = orig.items[i]; g.strokeStyle = GREY; g.setLineDash([4, 3]); g.lineWidth = 1.5;
        if (o.kind === "block" || o.kind === "bar") g.strokeRect(x, base - o.height * sy, Math.max(w, 6), o.height * sy);
        else if (o.kind === "gap") g.strokeRect(x, base + 4, o.width * sx, 14);
        g.setLineDash([]);
      }
      if (i === stopAt) { g.strokeStyle = RED; g.lineWidth = 3; const hh = it.kind === "block" || it.kind === "bar" ? it.height * sy : 30; g.strokeRect(x - 5, base - hh - 12, Math.max(w, 12) + 10, hh + 34); g.fillStyle = RED; g.font = "700 13px system-ui"; g.fillText("stops here", x - 5, base - hh - 18); }
    });
    if (stage >= 3 && report) { // the run, drawn as a sketch: a trail along the lane with a hop over every piece it passes; the red box above is the simulator's own answer
      const last = stopAt !== null && stopAt >= 0 ? stopAt : cur.items.length;
      const endX = stopAt !== null && stopAt >= 0 ? xs[stopAt].x - 6 : xs[xs.length - 1].x + xs[xs.length - 1].w;
      g.strokeStyle = report.cleared ? TEAL : ORANGE; g.lineWidth = 3; g.beginPath(); g.moveTo(24, base - 8);
      for (let i = 0; i < last; i++) { const it = cur.items[i], { x, w } = xs[i]; if (it.kind === "ground") g.lineTo(x + w, base - 8); else { const top = it.kind === "block" ? it.height * sy : it.kind === "bar" ? it.height * sy - 14 : 34; g.lineTo(x - 4, base - 8); g.bezierCurveTo(x, base - top - 30, x + Math.max(w, 10), base - top - 30, x + Math.max(w, 10) + 4, base - (it.kind === "block" ? it.height * sy + 8 : 8)); if (it.kind === "block") g.lineTo(x + Math.max(w, 10) + 12, base - 8); } }
      if (stopAt !== null) g.lineTo(endX, base - 8);
      g.stroke(); g.fillStyle = report.cleared ? TEAL : ORANGE; g.beginPath(); g.arc(stopAt !== null && stopAt >= 0 ? endX : xs[xs.length - 1].x + xs[xs.length - 1].w - 8, base - 12, 6, 0, 7); g.fill();
    }
    g.font = "12px system-ui"; g.fillStyle = "#52605a"; g.fillText("Side view. Grey dashes: the piece before Fix it. The run line is a sketch; the red box is what the simulator found.", 20, H - 12);
  };

  // ---- text and widgets ----
  const gateStates = (): Record<Gate, "pass" | "stop" | ""> => {
    const out: Record<Gate, "pass" | "stop" | ""> = { reader: "", rules: "", simulator: "", shown: "" };
    const v = verdictOf({ layout: cur, problems: readAnswer(answer()).problems }, report);
    const order: Gate[] = ["reader", "rules", "simulator", "shown"];
    for (const gt of order) { if (gt === v.gate) { out[gt] = v.reject ? "stop" : report || gt === "reader" || gt === "rules" ? "pass" : ""; break; } out[gt] = "pass"; }
    if (v.reject) out[v.gate] = "stop";
    return out;
  };
  const wordsNow = (): string => {
    if (!cur) return verdictOf({ layout: null, problems: readAnswer(answer()).problems }, null).words;
    if (pending || !report) return ruleProblems(cur).length ? verdictOf({ layout: cur, problems: [] }, null).words : "The simulator is searching for a run...";
    return verdictOf({ layout: cur, problems: [] }, report).words;
  };
  const render = () => {
    draw();
    const gs = gateStates();
    $("lp-gates").innerHTML = GATES.map((x, i) => `${i ? '<span class="arrow">&rarr;</span>' : `<div class="gate pass"><b>Partner</b>Muse Spark Open proposes. Recorded here.</div><span class="arrow">&rarr;</span>`}<div class="gate ${stage >= 2 || x.gate === "reader" ? gs[x.gate] : ""}" data-gate="${x.gate}"><b>${x.name}</b>${x.does}</div>`).join("");
    $("lp-stages").innerHTML = STAGES.map((s, i) => `<button data-st="${i + 1}" aria-pressed="${stage === i + 1}">${i + 1}. ${s}</button>`).join("");
    $("lp-say").textContent = STAGE_SAY[stage - 1];
    $("lp-words").innerHTML = stage < 3 ? "Press Next step to let the simulator check it." : `<span class="${report?.cleared ? "good" : report || !cur ? "bad" : ""}">${wordsNow()}</span>`;
    $("lp-fixes").textContent = fixes.length ? `Fix it so far: ${fixes.join("; ")}.` : "";
    const fs = cur && report && !report.cleared ? fixStep(cur, report) : null;
    ($("lp-fix") as HTMLButtonElement).disabled = !fs || pending;
    ($("lp-prev") as HTMLButtonElement).disabled = stage === 1; ($("lp-next") as HTMLButtonElement).disabled = stage === 5;
    ($("lp-play") as HTMLButtonElement).disabled = auto !== 0;
    const it = cur && sel >= 0 ? cur.items[sel] : null;
    $("lp-sel").textContent = !cur ? "Nothing to edit: the reader found no course." : it ? `Piece ${sel + 1} of ${cur.items.length}: ${it.kind}.` : "Click a piece in the picture.";
    const sz = $<HTMLInputElement>("lp-size");
    sz.disabled = !it; if (it) { sz.min = it.kind === "gap" ? "1.2" : it.kind === "bar" ? "2" : it.kind === "block" ? "0.1" : "2"; sz.max = it.kind === "gap" ? "9" : it.kind === "bar" ? "3.5" : it.kind === "block" ? "3.2" : "14"; sz.value = String(sizeOf(it)); }
    $("lp-size-l").textContent = it ? `${it.kind === "gap" ? "Gap width" : it.kind === "ground" ? "Ground length" : "Height"}: ${sizeOf(it)} m` : "Size";
    wrap.querySelectorAll<HTMLButtonElement>("#lp-swap button").forEach((b) => { b.disabled = !it || it.kind === "ground"; b.setAttribute("aria-pressed", String(it?.kind === b.dataset.k)); });
    challengeStatus();
  };
  const renderAll = () => {
    const a = answer();
    $("lp-source").textContent = `${a.source}. ${a.note}`;
    $("lp-reply").textContent = (a.raw ?? `${a.say ?? ""}\n${JSON.stringify(a.layout)}`).trim();
    wrap.querySelectorAll<HTMLButtonElement>("#lp-kinds button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kind === a.kind)));
    $<HTMLSelectElement>("lp-pick").value = String(idx);
    render();
  };

  // ---- challenges ----
  const whyChoices: Record<string, Gate | ""> = {};
  const whyCases = ["x1", "r1", "m006"];
  const challengeStatus = () => {
    const c = CHALLENGES.find((x) => x.id === challenge);
    $("lp-ch-ask").textContent = c ? c.ask : "Pick a challenge. The simulator says pass or fail.";
    wrap.querySelectorAll<HTMLButtonElement>("#lp-ch button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.c === challenge)));
    let res: { pass: boolean; why: string } | null = null;
    const start = orig;
    if (c?.kind === "one-change" && start && cur) res = oneChangePass(start, cur, pending ? null : report);
    if (c?.kind === "harder" && start && cur) res = harderPass(start, cur, pending ? null : report);
    if (c?.kind === "honest" && cur) res = honestPass(cur, pending ? null : report);
    if (c?.kind === "why") {
      const rows = whyCases.map((id) => {
        const a = answers.find((x) => x.id === id)!, r = readAnswer(a);
        const truth = verdictOf(r, r.layout && !ruleProblems(r.layout).length ? cache.get(key(r.layout)) ?? null : null).gate;
        const ch = whyChoices[id] ?? "";
        return `<div style="margin:4px 0"><span class="small">${a.brief}</span><div class="row" data-why="${id}">${(["reader", "rules", "simulator"] as Gate[]).map((gt) => `<button data-g="${gt}" aria-pressed="${ch === gt}">${GATES.find((x) => x.gate === gt)!.name}</button>`).join("")} <span class="${ch ? (ch === truth ? "good" : "bad") : ""}">${ch ? (ch === truth ? "right" : "not this gate") : ""}</span></div></div>`;
      });
      $("lp-ch-why").innerHTML = rows.join("");
      const right = whyCases.filter((id) => { const a = answers.find((x) => x.id === id)!, r = readAnswer(a); return whyChoices[id] === verdictOf(r, r.layout && !ruleProblems(r.layout).length ? cache.get(key(r.layout)) ?? null : null).gate; }).length;
      res = { pass: right === 3, why: `${right} of 3 right.` };
    } else $("lp-ch-why").innerHTML = "";
    $("lp-ch-status").innerHTML = res ? `<span class="${res.pass ? "good" : "bad"}">${res.pass ? "PASS" : "Not yet"}: ${res.why}</span>` : "";
  };
  const startChallenge = (id: string) => {
    challenge = id; const c = CHALLENGES.find((x) => x.id === id)!;
    $("lp-reveal-text").textContent = "";
    if (c.kind === "honest") { // our own layout: the wall as the partner left it
      cur = orig = EASED_WALL; sel = 1; fixes = []; stage = 3; const hit = cache.get(key(cur)); if (hit) report = hit; else retest(0);
      $("lp-reply").textContent = `Brief: a ${WALL_ASKED} m high wall to climb over. The partner's repair ended near 0.68 m.`; $("lp-source").textContent = "Our layout around the recorded 0.68 m."; render(); return;
    }
    const i = answers.findIndex((a) => a.id === c.start); stage = 3; load(i); sel = c.kind === "why" ? -1 : cur!.items.findIndex((x) => x.kind !== "ground"); render();
  };

  // ---- wiring ----
  const edit = (next: Layout) => { if (!cur || key(next) === key(cur)) return; cur = next; fixes = []; retest(); };
  wrap.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest("button") as HTMLButtonElement | null;
    if (!t) return;
    if (t.dataset.kind) { const i = answers.findIndex((a) => a.kind === (t.dataset.kind as Kind)); if (i >= 0) { challenge = ""; load(i); } }
    else if (t.dataset.st) { stage = Number(t.dataset.st); render(); }
    else if (t.dataset.c) startChallenge(t.dataset.c);
    else if (t.dataset.k && cur && sel >= 0) edit(swapKind(cur, sel, t.dataset.k as "gap" | "block" | "bar"));
    else if (t.dataset.g) { const id = (t.parentElement as HTMLElement).dataset.why!; whyChoices[id] = t.dataset.g as Gate; render(); }
    else if (t.id === "lp-reset") { if (challenge === "honest") startChallenge("honest"); else load(idx); }
    else if (t.id === "lp-prev") { stage = Math.max(1, stage - 1); render(); }
    else if (t.id === "lp-next") { stage = Math.min(5, stage + 1); render(); }
    else if (t.id === "lp-fix") doFix();
    else if (t.id === "lp-play") play();
    else if (t.id === "lp-reveal") {
      const c = CHALLENGES.find((x) => x.id === challenge); if (!c) return;
      const a = answers.find((x) => x.id === c.start), r = a ? readAnswer(a) : null, rp = r?.layout ? cache.get(key(r.layout)) : null, fs = r?.layout && rp && !rp.cleared ? fixStep(r.layout, rp) : null;
      $("lp-reveal-text").textContent = `${c.reveal}${fs ? ` Fix it said: ${fs.text}.` : ""}`;
    }
  });
  const doFix = () => {
    if (!cur || !report || report.cleared) return;
    const fs = fixStep(cur, report); if (!fs) return;
    fixes.push(fs.text); cur = fs.layout; sel = fs.item; stage = Math.max(stage, 4); retest(0);
  };
  const play = () => {
    stage = 1; render(); auto = 1; render();
    const tick = () => {
      if (stage < 3) { stage++; render(); }
      else if (stage === 3 && !pending && report) { if (report.cleared) stage = 5; else { stage = 4; } render(); }
      else if (stage === 4 && !pending && report) { if (report.cleared) stage = 5; else if (fixStep(cur!, report) && fixes.length < 4) doFix(); else { auto = 0; render(); return; } render(); }
      else if (stage === 5) { auto = 0; render(); return; }
      auto = window.setTimeout(tick, 1100);
    };
    auto = window.setTimeout(tick, 900);
  };
  $("lp-pick").addEventListener("change", () => { challenge = ""; load(Number($<HTMLSelectElement>("lp-pick").value)); });
  $("lp-size").addEventListener("input", () => { if (cur && sel >= 0) edit(setSize(cur, sel, Number($<HTMLInputElement>("lp-size").value))); });
  // drag in the picture
  let drag = false;
  const pt = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; };
  canvas.addEventListener("pointerdown", (e) => {
    if (!cur || stage < 2) return; const p = pt(e), { xs } = geo(cur);
    const i = xs.findIndex((q, k) => p.x >= q.x - 8 && p.x <= q.x + Math.max(q.w, 12) + 8 && cur!.items[k].kind !== undefined);
    sel = i; drag = i >= 0 && cur.items[i].kind !== "ground"; if (drag) canvas.setPointerCapture(e.pointerId); render();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag || !cur || sel < 0) return; const p = pt(e), { xs, sx, sy, base } = geo(cur), it = cur.items[sel];
    if (it.kind === "block" || it.kind === "bar") { const lo = it.kind === "bar" ? 2 : 0.1, hi = it.kind === "bar" ? 3.5 : 3.2; edit(setSize(cur, sel, Math.min(hi, Math.max(lo, Math.round(((base - p.y) / sy) * 20) / 20)))); }
    else if (it.kind === "gap") edit(setSize(cur, sel, Math.min(9, Math.max(1.2, Math.round(((p.x - xs[sel].x) / sx) * 10) / 10))));
  });
  canvas.addEventListener("pointerup", () => { drag = false; });

  // ---- open ----
  void (async () => {
    try {
      const [rec, def] = await Promise.all([fetch("/assets/lab/partner-recorded.json").then((r) => r.json()), fetch("/assets/lab/partner-default.json").then((r) => r.json())]);
      answers = rec.answers;
      for (const a of answers) { const r = readAnswer(a); const rep = def.reports[a.id]; if (r.layout && rep) cache.set(key(r.layout), rep); }
      cache.set(key(EASED_WALL), def.extra["eased-wall"]);
      $("lp-pick").innerHTML = KINDS.map((k) => `<optgroup label="${k.label}">${answers.map((a, i) => (a.kind === k.kind ? `<option value="${i}">${a.brief}</option>` : "")).join("")}</optgroup>`).join("");
      $("lp-ch").innerHTML = CHALLENGES.map((c) => `<button data-c="${c.id}" aria-pressed="false">${c.title}</button>`).join("");
      stage = 3; load(answers.findIndex((a) => a.id === "m003"));
      note.textContent = "Showing our setting, already run: a recorded answer, checked by the game's own simulator tool. Change a piece and it is checked again.";
      labPopulated("lab-partner");
    } catch (e) { wrap.append(Object.assign(document.createElement("p"), { textContent: `Could not load the recorded answers: ${String(e)}` })); }
  })();
  return { backend: "canvas2d" };
}
