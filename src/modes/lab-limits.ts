import { mountLabsNav, labHref } from "../ui/labs-nav";
import { labsOn } from "../ui/labs";
import { labDefaultNote, labPopulated } from "../ui/lab-default";
import { LAB_LIST, labName } from "../ui/labs-series";
import {
  BINS, CARDS, FINDER_ITEMS, GAME_LIMIT, GATE_ROWS, KIND_NAME, LIMIT_MAX, LIMIT_MIN, STAGES,
  allBest, cardById, confusion, finderCut, flagged, judge, ourSorting, pct, scoreSort, sweep, totalCalls, cheapestSafe,
  type BinId, type Rating,
} from "../labs/limits/limits-core";

// Lab: What the model cannot do. Sort real failures into three bins, see what we did instead, move the limit of a real gate and watch precision against recall,
// then pick the cheapest safe design for three stages. Every picture and number is a file already in the repo (scripts/lab-limits-build.py). No model runs here, nothing is graded
// but the player's own sorting against ours, and no one's technique is judged. Equations come last, behind a button (labs may show equations). Behind the labs switch (?labs=1).
const INK = "#17201d", TEAL = "#0f6b5c", ORANGE = "#d9741a", RED = "#b91c1c", BLUE = "#3b6ea5";
const RATING_COLOUR: Record<Rating, string> = { usable: TEAL, partly: ORANGE, bad: RED };
const W = 1100, GH = 250, SH = 150, FH = 110;

export function startLabLimits(host: HTMLElement): { backend: "canvas2d" } {
  const root = document.createElement("div");
  root.id = "lab-limits";
  root.style.cssText = `position:fixed;inset:0;overflow:auto;background:#f5f7f4;color:${INK};font:15px/1.4 system-ui,sans-serif`;
  host.append(root);
  mountLabsNav(host, "lab-limits");
  const TITLE = labName("lab-limits");
  if (!labsOn()) {
    root.innerHTML = `<div style="max-width:520px;margin:12vh auto;padding:0 16px"><h1 style="font-size:22px">${TITLE}</h1><p>Labs are switched off.</p><p><a href="?mode=lab-limits&labs=1" style="color:${TEAL}">Switch labs on</a></p></div>`;
    return { backend: "canvas2d" };
  }
  const style = document.createElement("style");
  style.textContent = `
    #lab-limits .wrap{max-width:1200px;margin:0 auto;padding:16px;display:grid;gap:14px}
    #lab-limits h1{font-size:22px;margin:0}#lab-limits h2{font-size:16px;margin:0 0 6px}
    #lab-limits .card{background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:12px}
    #lab-limits .small{color:#52605a;font-size:13px}
    #lab-limits canvas{width:100%;height:auto;display:block;border-radius:6px;background:#eef3ee}
    #lab-limits .sortgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:8px}
    #lab-limits .bin{border:2px dashed #b9c4bb;border-radius:10px;padding:8px;min-height:130px;background:#fafcfa}
    #lab-limits .bin.over{border-color:${TEAL};background:#e6f2ee}
    #lab-limits .bin h3{font-size:14px;margin:0}#lab-limits .bin p{margin:0 0 6px}
    #lab-limits .tray{border:2px dashed #b9c4bb;border-radius:10px;padding:8px;min-height:60px;margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start}
    #lab-limits .tray.over{border-color:${TEAL};background:#e6f2ee}
    #lab-limits .cards{display:flex;flex-wrap:wrap;gap:8px}
    #lab-limits .fc{width:154px;background:#fff;border:2px solid #d5ddd6;border-radius:8px;padding:4px;cursor:grab;font-size:12px;line-height:1.25}
    #lab-limits .fc img{width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:5px;display:block;background:#eef3ee}
    #lab-limits .fc b{display:block;margin-top:3px}
    #lab-limits .fc.sel{border-color:${INK}}
    #lab-limits .fc.ok{border-color:${TEAL}}#lab-limits .fc.off{border-color:${ORANGE}}
    #lab-limits .fc .mv{display:flex;gap:3px;margin-top:4px}
    #lab-limits .fc .mv button{flex:1;font:600 11px system-ui;padding:3px 0;border:1px solid #b9c4bb;border-radius:6px;background:#fff;color:${INK};cursor:pointer}
    #lab-limits .fc .mv button[aria-pressed=true]{background:#e6f2ee;border-color:${TEAL}}
    #lab-limits .reveal{display:grid;grid-template-columns:360px minmax(0,1fr);gap:14px;align-items:start;margin-top:10px}
    #lab-limits .reveal img{width:360px;height:240px;border-radius:8px;object-fit:contain;background:#eef3ee}
    #lab-limits .chip{display:inline-block;font:700 12px system-ui;padding:2px 9px;border-radius:99px;background:#e6f2ee;color:${TEAL};border:1px solid #b9d6cd}
    #lab-limits .go,#lab-limits .ghost{font:700 14px system-ui;padding:7px 12px;border-radius:8px;cursor:pointer}
    #lab-limits .go{border:0;background:${TEAL};color:#fff}#lab-limits .ghost{border:1px solid #b9c4bb;background:#fff;color:${INK}}
    #lab-limits .two{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px;align-items:start}
    #lab-limits table{border-collapse:collapse;font-size:14px;width:100%}#lab-limits td,#lab-limits th{padding:3px 8px;border-bottom:1px solid #e3e8e4;text-align:center}
    #lab-limits .big{font:700 22px system-ui}
    #lab-limits input[type=range]{width:100%}
    #lab-limits .stages{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    #lab-limits .opt{display:grid;grid-template-columns:auto 1fr auto;gap:6px;align-items:start;border:1px solid #d5ddd6;border-radius:8px;padding:6px 8px;margin:5px 0;cursor:pointer;font-size:13px}
    #lab-limits .opt.on{border-color:${INK};background:#f1f4f1}
    #lab-limits .calls{font-weight:700;color:#52605a;white-space:nowrap}
    #lab-limits .v{margin:6px 0 0;font-weight:700;font-size:13px}
    #lab-limits .v.best{color:${TEAL}}#lab-limits .v.safe-costly{color:${ORANGE}}#lab-limits .v.unsafe,#lab-limits .v.no-job{color:${RED}}
    #lab-limits .eq{font:14px/1.6 ui-monospace,Menlo,monospace;background:#f1f4f1;border-radius:8px;padding:8px 10px;white-space:pre-wrap}
    #lab-limits button.link{background:none;border:0;color:${TEAL};font:600 14px system-ui;cursor:pointer;padding:0;text-decoration:underline}
    #lab-limits a.back,#lab-limits a.lk{color:${TEAL};font-weight:600}
    #lab-limits [hidden]{display:none !important}
    #lab-limits .sw{display:inline-block;width:12px;height:12px;border-radius:99px;vertical-align:-1px;margin:0 4px 0 10px}
  `;
  root.append(style);
  const wrap = document.createElement("div"); wrap.className = "wrap"; root.append(wrap);
  const sysMode = LAB_LIST.find((l) => /system/.test(l.mode))?.mode ?? null; // the finale Lab, linked once it exists
  const lk = (m: string) => `<a class="lk" href="${labHref(m)}">${labName(m)}</a>`;
  wrap.innerHTML = `
    <div><a class="back" href="/?welcome=0">Back to the game</a>
      <h1>${TITLE}</h1>
      <p class="small" style="margin:2px 0 0"><b>Know the limits.</b> Every model in the game gets some inputs wrong. We kept the real failures. Sort them, then see what the game does instead.</p></div>
    <div class="card"><h2>1. Sort the failures</h2>
      <p class="small" style="margin:0">Drag a card into a bin, or press a button on it. Click a card to see what the model gave back.</p>
      <div class="sortgrid" id="lim-bins"></div>
      <div class="tray" id="lim-tray" aria-label="Cards not sorted yet"></div>
      <p style="margin:8px 0 0"><span id="lim-score" style="font-weight:700"></span>
        <button class="ghost" id="lim-reset">Start over: I sort them</button> <button class="ghost" id="lim-ours">Show our sorting</button></p>
      <div class="reveal"><img id="lim-pic" alt=""><div id="lim-says"></div></div></div>
    <div class="card"><h2>2. Move the limit of a real gate</h2>
      <p class="small" style="margin:0">The gate looks at a lift: is it as wide as the photo says? Dots are 14 real lifts. A person rated each one by eye.</p>
      <div class="two" style="margin-top:8px"><div>
        <canvas id="lim-gate" width="${W}" height="${GH}"></canvas>
        <label style="display:block;margin-top:8px">Flag a lift when it is more than <b id="lim-lim-v"></b> times too wide or too narrow
          <input id="lim-lim" type="range" min="${LIMIT_MIN}" max="${LIMIT_MAX}" step="0.05"></label>
        <label style="display:block"><input type="checkbox" id="lim-partly"> Count "partly" lifts as bad too</label>
        <canvas id="lim-sweep" width="${W}" height="${SH}" style="margin-top:8px"></canvas></div>
        <div><table><thead><tr><th></th><th>rated bad</th><th>rated fine</th></tr></thead><tbody id="lim-conf"></tbody></table>
          <p style="margin:10px 0 0">Precision <span class="big" id="lim-p"></span></p><p style="margin:0">Recall <span class="big" id="lim-r"></span></p><p style="margin:0">F1 <span class="big" id="lim-f"></span></p>
          <p class="small" id="lim-gate-says" style="margin:8px 0 0"></p></div></div>
      <div style="margin-top:12px;border-top:1px solid #e3e8e4;padding-top:8px"><p class="small" style="margin:0">A score cut on the finder's 12 outlines for the monkey-bars photo:</p>
        <canvas id="lim-find" width="${W}" height="${FH}" style="margin-top:6px"></canvas>
        <label style="display:block;margin-top:6px">Keep outlines scoring at least <b id="lim-cut-v"></b><input id="lim-cut" type="range" min="0.3" max="0.75" step="0.01"></label>
        <p class="small" id="lim-find-says" style="margin:0"></p></div>
      <p style="margin:8px 0 0"><button class="link" id="lim-eq-btn">Show the maths</button></p><div class="eq" id="lim-eq" hidden></div></div>
    <div class="card"><h2>3. Pick the cheapest safe design</h2>
      <p class="small" style="margin:0">Safe: something that is not the same model checks the answer, and there is a way out when it fails. Cost: paid model calls per object.</p>
      <div class="stages" id="lim-stages" style="margin-top:8px"></div>
      <p style="margin:10px 0 0"><span id="lim-total" style="font-weight:700"></span></p></div>
    <div class="card"><h2>Where this goes</h2>
      <p style="margin:0">Precision and recall are earned in ${lk("lab-detector")}. The mask threshold is in ${lk("lab-vision")}.
        ${sysMode ? `The whole system built from these checks: ${lk(sysMode)}.` : `The whole system built from these checks is System design.`}</p></div>`;
  const $ = <T extends HTMLElement>(id: string): T => wrap.querySelector("#" + id) as T;
  labDefaultNote(wrap, "live", wrap.querySelector("p.small") as HTMLElement | null);

  // ---------- 1. sorting ----------
  let placed: Record<string, BinId | undefined> = { ...ourSorting() };
  let sel = CARDS[0].id;
  const binName = (b: BinId) => BINS.find((x) => x.id === b)!.title;
  const cardHtml = (id: string) => {
    const c = cardById(id), at = placed[id];
    const cls = ["fc", id === sel ? "sel" : "", at ? (at === c.bin ? "ok" : "off") : ""].join(" ");
    return `<div class="${cls}" draggable="true" data-card="${id}" id="lim-card-${id}"><img src="${c.picture}" alt="${c.title}" draggable="false"><b>${c.title}</b><span class="small">${c.model}</span>
      <div class="mv">${BINS.map((b) => `<button data-mv="${b.id}" aria-pressed="${at === b.id}" title="${b.title}">${b.id === "cant" ? "Can't" : b.id === "help" ? "Help" : "None"}</button>`).join("")}</div></div>`;
  };
  function drawSort() {
    $("lim-bins").innerHTML = BINS.map((b) => `<div class="bin" data-bin="${b.id}" id="lim-bin-${b.id}"><h3>${b.title}</h3><p class="small">${b.line}</p><div class="cards">${CARDS.filter((c) => placed[c.id] === b.id).map((c) => cardHtml(c.id)).join("")}</div></div>`).join("");
    $("lim-tray").innerHTML = CARDS.filter((c) => !placed[c.id]).map((c) => cardHtml(c.id)).join("") || `<span class="small">Every card is in a bin.</span>`;
    const s = scoreSort(placed);
    $("lim-score").textContent = `Sorted ${s.placed} of ${s.total}. In our bin: ${s.right} of ${s.placed}.`;
    wrap.querySelectorAll<HTMLElement>(".fc").forEach((el) => {
      const id = el.dataset.card!;
      el.addEventListener("click", (e) => { const mv = (e.target as HTMLElement).closest("button[data-mv]") as HTMLElement | null; if (mv) place(id, mv.dataset.mv as BinId); else { sel = id; drawSort(); } });
      el.addEventListener("dragstart", (e) => { e.dataTransfer?.setData("text/plain", id); sel = id; });
    });
    drawReveal();
  }
  function place(id: string, b: BinId | undefined) { placed[id] = b; sel = id; drawSort(); }
  const dropOn = (el: HTMLElement, target: BinId | undefined) => {
    el.addEventListener("dragover", (e) => { e.preventDefault(); el.classList.add("over"); });
    el.addEventListener("dragleave", () => el.classList.remove("over"));
    el.addEventListener("drop", (e) => { e.preventDefault(); el.classList.remove("over"); const id = e.dataTransfer?.getData("text/plain"); if (id && CARDS.some((c) => c.id === id)) place(id, target); });
  };
  function drawReveal() {
    const c = cardById(sel), at = placed[sel];
    ($("lim-pic") as HTMLImageElement).src = c.picture; ($("lim-pic") as HTMLImageElement).alt = c.title;
    const head = `<p style="margin:0"><b>${c.title}</b> <span class="small">(${c.model})</span></p><p style="margin:6px 0"><b>The model gave back:</b> ${c.returned}</p>`;
    if (!at) { $("lim-says").innerHTML = head + `<p class="small" style="margin:0">Put this card in a bin to see what we did instead.</p>`; return; }
    const right = at === c.bin;
    $("lim-says").innerHTML = head + `<p style="margin:6px 0"><b>${right ? "In our bin." : `We put it in a different bin: ${binName(c.bin)}.`}</b> <span class="small">You: ${binName(at)}.</span></p>
      <p style="margin:6px 0"><span class="chip">${KIND_NAME[c.kind]}</span> <b>What we did instead:</b> ${c.instead}</p><p class="small" style="margin:0">Numbers from <code>${c.source}</code></p>`;
  }
  dropOn($("lim-tray"), undefined);
  // bins are rebuilt on every draw, so the drop listeners sit on the container and find the bin
  $("lim-bins").addEventListener("dragover", (e) => { e.preventDefault(); const b = (e.target as HTMLElement).closest(".bin"); wrap.querySelectorAll(".bin").forEach((x) => x.classList.toggle("over", x === b)); });
  $("lim-bins").addEventListener("dragleave", (e) => { if (!(e.relatedTarget as HTMLElement | null)?.closest?.(".bin")) wrap.querySelectorAll(".bin").forEach((x) => x.classList.remove("over")); });
  $("lim-bins").addEventListener("drop", (e) => { e.preventDefault(); const b = (e.target as HTMLElement).closest(".bin") as HTMLElement | null; const id = (e as DragEvent).dataTransfer?.getData("text/plain"); if (b && id && CARDS.some((c) => c.id === id)) place(id, b.dataset.bin as BinId); });
  $("lim-reset").addEventListener("click", () => { placed = {}; sel = CARDS[0].id; drawSort(); });
  $("lim-ours").addEventListener("click", () => { placed = { ...ourSorting() }; drawSort(); });

  // ---------- 2. the gate ----------
  let limit = GAME_LIMIT, partly = false, cut = 0.35;
  const xOf = (ratio: number) => 30 + ((Math.log(ratio) - Math.log(0.4)) / (Math.log(4.5) - Math.log(0.4))) * (W - 60);
  const label = (g: CanvasRenderingContext2D, t: string, x: number, y: number, c = INK, align: CanvasTextAlign = "left", size = 12) => { g.fillStyle = c; g.font = `600 ${size}px system-ui`; g.textAlign = align; g.fillText(t, x, y); };
  function drawGate() {
    const g = ($("lim-gate") as HTMLCanvasElement).getContext("2d")!;
    g.clearRect(0, 0, W, GH);
    const lo = xOf(1 / limit), hi = xOf(limit);
    g.fillStyle = "rgba(185,28,28,0.10)"; g.fillRect(0, 0, lo, GH); g.fillRect(hi, 0, W - hi, GH);
    g.strokeStyle = RED; g.lineWidth = 2; g.setLineDash([6, 4]);
    for (const x of [lo, hi]) { g.beginPath(); g.moveTo(x, 6); g.lineTo(x, GH - 24); g.stroke(); }
    g.setLineDash([]);
    g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.moveTo(xOf(1), 6); g.lineTo(xOf(1), GH - 24); g.stroke();
    for (const r of [0.5, 1, 2, 4]) label(g, `${r}`, xOf(r), GH - 8, "#52605a", "center");
    label(g, "lift width over height, divided by the mask's (1 = same shape)", W / 2, GH - 8 + 0, "#52605a", "center");
    label(g, "flagged", 10, 20, RED); label(g, "flagged", W - 10, 20, RED, "right");
    const rows = [...GATE_ROWS].sort((a, b) => a.ratio - b.ratio);
    rows.forEach((r, i) => {
      const x = xOf(r.ratio), y = 36 + (i % 5) * 34;
      g.beginPath(); g.arc(x, y, 8, 0, 7); g.fillStyle = RATING_COLOUR[r.rating]; g.fill();
      if (flagged(r.ratio, limit)) { g.beginPath(); g.arc(x, y, 12, 0, 7); g.strokeStyle = RED; g.lineWidth = 2.5; g.stroke(); }
      label(g, r.photo, x + (x > W - 150 ? -16 : 16), y + 4, INK, x > W - 150 ? "right" : "left", 11);
    });
  }
  function drawSweep() {
    const g = ($("lim-sweep") as HTMLCanvasElement).getContext("2d")!;
    g.clearRect(0, 0, W, SH);
    const px = (l: number) => 50 + ((l - LIMIT_MIN) / (LIMIT_MAX - LIMIT_MIN)) * (W - 90), py = (v: number) => SH - 24 - v * (SH - 40);
    g.strokeStyle = "#cdd8d1"; g.lineWidth = 1;
    for (const v of [0, 0.5, 1]) { g.beginPath(); g.moveTo(50, py(v)); g.lineTo(W - 40, py(v)); g.stroke(); label(g, pct(v), 44, py(v) + 4, "#52605a", "right"); }
    const sw = sweep(GATE_ROWS, partly);
    for (const [key, col] of [["precision", BLUE], ["recall", ORANGE]] as const) {
      g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath(); let pen = false;
      for (const s of sw) { const v = s.c[key]; if (v === null) { pen = false; continue; } if (!pen) { g.moveTo(px(s.limit), py(v)); pen = true; } else g.lineTo(px(s.limit), py(v)); }
      g.stroke();
    }
    g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.moveTo(px(limit), 6); g.lineTo(px(limit), SH - 24); g.stroke();
    g.strokeStyle = TEAL; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(px(GAME_LIMIT), 6); g.lineTo(px(GAME_LIMIT), SH - 24); g.stroke(); g.setLineDash([]);
    label(g, "precision", W - 40, 18, BLUE, "right"); label(g, "recall", W - 40, 34, ORANGE, "right");
    label(g, `limit ${LIMIT_MIN}`, 50, SH - 6, "#52605a"); label(g, `${LIMIT_MAX}`, W - 40, SH - 6, "#52605a", "right"); label(g, "teal dashes: the game's limit (2)", px(GAME_LIMIT) + 6, SH - 6, TEAL);
  }
  function drawConf() {
    const c = confusion(GATE_ROWS, limit, partly);
    $("lim-lim-v").textContent = limit.toFixed(2);
    $("lim-conf").innerHTML = `<tr><th>flagged</th><td id="lim-tp">${c.tp}</td><td id="lim-fp">${c.fp}</td></tr><tr><th>let through</th><td id="lim-fn">${c.fn}</td><td id="lim-tn">${c.tn}</td></tr>`;
    $("lim-p").textContent = pct(c.precision); $("lim-r").textContent = pct(c.recall); $("lim-f").textContent = pct(c.f1);
    const missed = GATE_ROWS.filter((r) => (r.rating === "bad" || (partly && r.rating === "partly")) && !flagged(r.ratio, limit)).map((r) => r.photo);
    const false_ = GATE_ROWS.filter((r) => !(r.rating === "bad" || (partly && r.rating === "partly")) && flagged(r.ratio, limit)).map((r) => r.photo);
    $("lim-gate-says").textContent = `Flagged for no reason: ${false_.length ? false_.join(", ") : "none"}. Let through but rated bad: ${missed.length ? missed.join(", ") : "none"}.`;
    drawGate(); drawSweep();
  }
  function drawFind() {
    const g = ($("lim-find") as HTMLCanvasElement).getContext("2d")!;
    g.clearRect(0, 0, W, FH);
    const bw = (W - 40) / FINDER_ITEMS.length;
    FINDER_ITEMS.forEach((it, i) => {
      const x = 20 + i * bw, h = it.score * 80, keep = it.score >= cut;
      g.fillStyle = keep ? (/bar/.test(it.label) ? ORANGE : TEAL) : "#cdd8d1";
      g.fillRect(x + 4, FH - 22 - h, bw - 8, h);
      label(g, it.label, x + bw / 2, FH - 8, "#52605a", "center", 10);
      label(g, it.score.toFixed(2), x + bw / 2, FH - 26 - h, INK, "center", 10);
    });
    g.strokeStyle = RED; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(10, FH - 22 - cut * 80); g.lineTo(W - 10, FH - 22 - cut * 80); g.stroke(); g.setLineDash([]);
    const f = finderCut(cut);
    $("lim-cut-v").textContent = cut.toFixed(2);
    $("lim-find-says").textContent = `Kept ${f.kept} of ${f.of}. Bar patterns found: ${f.patternsFound} of 2. Best overlap: ${Math.round(f.bestIou * 100)}%. A cut only throws outlines away; it cannot add the bars the finder never returned.`;
  }
  $("lim-lim").addEventListener("input", () => { limit = Number(($("lim-lim") as HTMLInputElement).value); drawConf(); });
  $("lim-partly").addEventListener("change", () => { partly = ($("lim-partly") as HTMLInputElement).checked; drawConf(); });
  $("lim-cut").addEventListener("input", () => { cut = Number(($("lim-cut") as HTMLInputElement).value); drawFind(); });
  ($("lim-lim") as HTMLInputElement).value = String(limit); ($("lim-cut") as HTMLInputElement).value = String(cut);
  $("lim-eq-btn").addEventListener("click", () => {
    const e = $("lim-eq"), c = confusion(GATE_ROWS, limit, partly);
    e.hidden = !e.hidden; $("lim-eq-btn").textContent = e.hidden ? "Show the maths" : "Hide the maths";
    e.textContent = `precision = TP / (TP + FP) = ${c.tp} / ${c.tp + c.fp}\nrecall    = TP / (TP + FN) = ${c.tp} / ${c.tp + c.fn}\nF1        = 2 x precision x recall / (precision + recall)\nflag a lift when ratio > ${limit.toFixed(2)} or ratio < ${(1 / limit).toFixed(3)}\nratio = (mesh width / mesh height) / (mask width / mask height)`;
  });

  // ---------- 3. the design ----------
  const choice: Record<string, string | undefined> = Object.fromEntries(STAGES.map((s) => [s.id, s.options[0].id])); // starts with the naive design: nothing checks it
  function drawDesign() {
    $("lim-stages").innerHTML = STAGES.map((s) => {
      const v = choice[s.id] ? judge(s.id, choice[s.id]!) : null;
      return `<div id="lim-stage-${s.id}"><h3 style="font-size:14px;margin:0">${s.title}</h3><p class="small" style="margin:0 0 4px">${s.job}</p>
        ${s.options.map((o) => `<label class="opt${choice[s.id] === o.id ? " on" : ""}"><input type="radio" name="lim-${s.id}" value="${o.id}" ${choice[s.id] === o.id ? "checked" : ""}><span>${o.text}</span><span class="calls">${o.calls} call${o.calls === 1 ? "" : "s"}</span></label>`).join("")}
        <p class="v ${v?.status ?? ""}" id="lim-v-${s.id}">${v ? v.why : "Pick one."}</p></div>`;
    }).join("");
    wrap.querySelectorAll<HTMLInputElement>("#lim-stages input").forEach((i) => i.addEventListener("change", () => { choice[i.name.slice(4)] = i.value; drawDesign(); }));
    const best = STAGES.reduce((n, s) => n + cheapestSafe(s).calls, 0);
    $("lim-total").textContent = `Paid model calls for your design: ${totalCalls(choice)}. Cheapest safe design: ${best}. ${allBest(choice) ? "All three stages are the cheapest safe design." : "Not every stage is the cheapest safe design yet."}`;
  }

  drawSort(); drawConf(); drawFind(); drawDesign();
  document.documentElement.dataset.labPopulatedCards = String(CARDS.length);
  labPopulated("lab-limits");
  return { backend: "canvas2d" };
}
