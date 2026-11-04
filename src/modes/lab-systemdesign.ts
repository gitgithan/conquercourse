import { mountLabsNav } from "../ui/labs-nav";
import { labsOn } from "../ui/labs";
import { labPopulated } from "../ui/lab-default";
import { labName } from "../ui/labs-series";
import { BRIEFS, METERS, SLOTS, STARTER, blocksOf, briefById, ladderOf, otherGoodDesign, pblockById, score, tradeOff, type BriefId, type Design, type Outcome, type PBlock, type SlotId } from "../labs/systemdesign/pipeline";
import { MAX_NOTE } from "../labs/systemdesign/partner-core";
import { askDesignPartner, type PartnerAnswer } from "../labs/systemdesign/partner-client";

// System design (finale Lab): System design as a block board. Nine slots of our real pipeline, three blocks for each.
// Drop blocks in, press Run, and a pure scoring function (src/labs/systemdesign/pipeline.ts) shows what the design does.
// A misfit is found, not told: a meter turns red, and a three-step hint ladder opens on the card that caused it.
// The partner pop-up (one opinion, never a chat) still comes from the live Design partner ask. Behind the labs switch (?labs=1).
const INK = "#17201d", TEAL = "#0f6b5c", RED = "#b91c1c";
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const usd = (n: number): string => (n >= 100 ? `$${Math.round(n).toLocaleString("en-US")}` : `$${n.toFixed(2)}`);

/** The three plain facts on a block: cost, speed, risk, each as a bar and a few words. */
function facts(b: PBlock, volume: number): string {
  const perK = b.cost + (b.monthly * 1000) / volume;
  const costText = b.monthly ? `${usd(b.monthly)} a month` : perK === 0 ? "free" : `${usd(perK)} per 1,000${b.est ? " (est.)" : ""}`;
  const t = b.secs + b.cold;
  const speedText = t === 0 ? "no wait" : `${Math.round(b.secs * 10) / 10} s${b.cold ? ` + ${b.cold} s wake-up` : ""}${b.est ? " (est.)" : ""}`;
  const col = (label: string, pct: number, text: string, warn = false) => `<div class="f"><span>${label}</span><i class="${warn ? "warn" : ""}"><b style="width:${Math.max(4, Math.min(100, pct))}%"></b></i><em>${esc(text)}</em></div>`;
  return `<div class="facts">${col("Cost", (perK / 20) * 100, costText)}${col("Time", (t / 60) * 100, speedText)}${col("Risk", (b.risk / 3) * 100, b.riskText, b.risk >= 2)}</div>`;
}

export function startLabSystemdesign(host: HTMLElement): { backend: "canvas2d" } {
  const title = "System design: build the whole game";
  const root = document.createElement("div");
  root.id = "lab-systemdesign";
  root.style.cssText = `position:fixed;inset:0;overflow:auto;background:#f5f7f4;color:${INK};font:15px/1.4 system-ui,sans-serif`;
  host.append(root);
  mountLabsNav(host, "lab-systemdesign");
  if (!labsOn()) {
    root.innerHTML = `<div style="max-width:520px;margin:12vh auto;padding:0 16px"><h1 style="font-size:22px">${title}</h1><p>Labs are switched off.</p><p><a href="?mode=lab-systemdesign&labs=1" style="color:${TEAL}">Switch Labs on</a></p></div>`;
    return { backend: "canvas2d" };
  }
  const style = document.createElement("style");
  style.textContent = `
    #lab-systemdesign .wrap{max-width:1240px;margin:0 auto;padding:56px 16px 28px;display:grid;gap:12px}
    #lab-systemdesign h1{font-size:22px;margin:0}
    #lab-systemdesign .card{background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:12px}
    #lab-systemdesign .small{color:#52605a;font-size:13px}
    #lab-systemdesign button{font:600 13px system-ui;padding:6px 10px;border:1px solid #b9c4bb;border-radius:8px;background:#fff;color:${INK};cursor:pointer}
    #lab-systemdesign button[aria-pressed=true]{border-color:${TEAL};background:#e6f2ee}
    #lab-systemdesign button.go{background:${TEAL};color:#fff;border-color:${TEAL};font-weight:700;padding:8px 16px;font-size:15px}
    #lab-systemdesign button:disabled{opacity:.5;cursor:default}
    #lab-systemdesign button:focus-visible,#lab-systemdesign a:focus-visible{outline:2px solid #ffd27a;outline-offset:1px}
    #lab-systemdesign .bar{position:sticky;top:44px;z-index:5;background:#f5f7f4;padding:6px 0 8px;display:grid;gap:8px;border-bottom:1px solid #d5ddd6}
    #lab-systemdesign .tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    #lab-systemdesign .tiles{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:6px}
    #lab-systemdesign .tile{background:#fff;border:2px solid #d5ddd6;border-radius:8px;padding:5px 7px;min-height:62px}
    #lab-systemdesign .tile b{display:block;font-size:12px;line-height:1.2}
    #lab-systemdesign .tile .v{font:700 15px system-ui;margin-top:1px}
    #lab-systemdesign .tile .g{font-size:11px;color:#52605a;line-height:1.2}
    #lab-systemdesign .tile .m{height:5px;background:#e3e8e4;border-radius:3px;margin-top:3px;overflow:hidden}#lab-systemdesign .tile .m i{display:block;height:100%;background:${TEAL}}
    #lab-systemdesign .tile.ok{border-color:${TEAL}}
    #lab-systemdesign .tile.bad{border-color:${RED};background:#fdf0f0}#lab-systemdesign .tile.bad .v{color:${RED}}#lab-systemdesign .tile.bad .m i{background:${RED}}
    #lab-systemdesign .tile.info{border-style:dashed;background:#f0f3f0;color:#52605a}#lab-systemdesign .tile.info .m i{background:#9aa5a0}
    #lab-systemdesign .tile.idle{color:#52605a}#lab-systemdesign .tile.idle .m i{background:#c9d1cb}
    #lab-systemdesign .tile.old{opacity:.55}
    #lab-systemdesign .board{display:grid;grid-template-columns:minmax(0,1fr) 26px minmax(0,1fr) 26px minmax(0,1fr);gap:0;align-items:stretch}
    #lab-systemdesign .arr{display:flex;align-items:center;justify-content:center;color:#52605a;font:700 22px system-ui}
    #lab-systemdesign .slot{background:#fff;border:2px solid #d5ddd6;border-radius:12px;padding:10px;min-width:0}
    #lab-systemdesign .slot.over{border-color:${TEAL};background:#f1f8f5}
    #lab-systemdesign .slot.misfit{border-color:${RED};background:#fffafa}
    #lab-systemdesign .slot.fits{border-color:${TEAL}}
    #lab-systemdesign .slot.running{box-shadow:0 0 0 3px #ffd27a}
    #lab-systemdesign .slot header{display:flex;gap:8px;align-items:center}
    #lab-systemdesign .slot .n{flex:none;width:24px;height:24px;border-radius:50%;background:${INK};color:#fff;font:700 13px/24px system-ui;text-align:center}
    #lab-systemdesign .slot header b{font-size:14px;display:block;line-height:1.15}
    #lab-systemdesign .slot header small{color:#52605a;font-size:11px}
    #lab-systemdesign .slot .ask{margin:4px 0 6px;font-size:12px;color:#52605a}
    #lab-systemdesign .blk{display:block;width:100%;text-align:left;margin:0 0 5px;padding:6px 8px;border-left:6px solid #c9d1cb;cursor:grab;font-weight:400}
    #lab-systemdesign .blk[aria-pressed=true]{border-left-color:${TEAL}}
    #lab-systemdesign .slot.misfit .blk[aria-pressed=true]{border-color:${RED};border-left-color:${RED};background:#fdecec}
    #lab-systemdesign .blk b{display:block;font-size:13px}#lab-systemdesign .blk>span{display:block;font-size:12px;color:#52605a}
    #lab-systemdesign .facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:4px}
    #lab-systemdesign .f span{display:block;font:700 10px system-ui;color:#52605a;text-transform:uppercase;letter-spacing:.04em}
    #lab-systemdesign .f i{display:block;height:5px;background:#e3e8e4;border-radius:3px;overflow:hidden;margin:1px 0 2px}#lab-systemdesign .f i b{display:block;height:100%;background:#52605a}
    #lab-systemdesign .f i.warn b{background:#d9741a}
    #lab-systemdesign .f em{display:block;font:400 11px/1.2 system-ui;color:${INK}}
    #lab-systemdesign .hint{border:1px solid #e3b4b4;background:#fdf0f0;border-radius:8px;padding:8px;font-size:13px;margin-top:4px}
    #lab-systemdesign .hint ol{margin:0 0 6px;padding-left:18px;display:grid;gap:4px}
    #lab-systemdesign .hint .why{color:${INK}}
    #lab-systemdesign .chip{display:inline-flex;align-items:center;font:600 12px system-ui;color:${TEAL};background:#e6f2ee;border:1px solid #b9d6cd;border-radius:99px;padding:2px 9px;text-decoration:none}
    #lab-systemdesign .status{background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:10px 12px}
    #lab-systemdesign .status.ok{border-color:${TEAL};background:#f1f8f5}
    #lab-systemdesign .good{color:${TEAL};font-weight:700}
    #lab-systemdesign textarea{font:14px system-ui;padding:6px;border:1px solid #b9c4bb;border-radius:8px;width:100%;box-sizing:border-box}
    #lab-systemdesign .opinion{background:#f1e6f7;border-radius:8px;padding:10px;font-size:14px}#lab-systemdesign .opinion.rec{background:#eef1ee}
    #lab-systemdesign a.back{color:${TEAL};font-weight:600}
  `;
  root.append(style);
  const wrap = document.createElement("div"); wrap.className = "wrap"; root.append(wrap);
  wrap.innerHTML = `
    <div><a class="back" href="/?welcome=0">Back to the game</a>
    <h1>${title}</h1>
    <p class="small" style="margin:2px 0 0">Build our pipeline from blocks. Drop a block into each card (or press it), then press Run. A red meter means a block does not fit there.</p></div>
    <div class="bar">
      <div class="tools"><span id="sd-briefs" role="group" aria-label="Brief" style="display:flex;gap:6px"></span>
        <button class="go" id="sd-run">Run</button><button id="sd-reset">Reset to the starter</button><button id="sd-ask">What would the partner say?</button>
        <span class="small" id="sd-brief-ask" style="flex:1;min-width:260px"></span></div>
      <div class="tiles" id="sd-meters"></div>
    </div>
    <div class="status" id="sd-status" aria-live="polite"></div>
    <div class="card" id="sd-partner-card" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:12px;align-items:start"><div><b>Design partner (one opinion, not a chat)</b>
      <p class="small" style="margin:2px 0 6px">Press "What would the partner say?" above. It sends only your block names to an AI. The meters win on facts.</p>
      <textarea id="sd-note" rows="1" maxlength="${MAX_NOTE}" placeholder="Optional: why you chose it (up to ${MAX_NOTE} letters)"></textarea></div>
      <div id="sd-partner" aria-live="polite"><span class="small">No comment yet.</span></div></div>
    <div class="board" id="sd-board"></div>`;
  const $ = <T extends HTMLElement>(id: string): T => wrap.querySelector("#" + id) as T;
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  let brief: BriefId = "online", design: Design = { ...STARTER };
  let snap: { design: Design; out: Outcome; brief: BriefId } | null = null;
  let open: Partial<Record<SlotId, number>> = {}; // how many hints are open per card
  let running = -1, timers: number[] = [], partnerBusy = false;
  const labChip = (mode: string): string => `<a class="chip" data-lab="${mode}" href="?mode=${mode}&labs=1&welcome=0">${esc(labName(mode))}</a>`;

  function renderMeters(): void {
    const br = briefById(brief), cur = snap && snap.brief === brief ? snap : null;
    const stale = !!cur && SLOTS.some((s) => cur.design[s.id] !== design[s.id]);
    $("sd-meters").innerHTML = METERS.map((m) => {
      const o = cur?.out.meters.find((x) => x.id === m.id);
      const needed = br.need.includes(m.id);
      if (!o) return `<div class="tile idle ${needed ? "" : "info"}" data-meter="${m.id}"><b>${m.label}</b><div class="v">?</div><div class="g">${needed ? m.goal(br) : "not needed here"}</div><div class="m"><i style="width:3%"></i></div></div>`;
      const shown = m.id === "time" ? `${o.value} s` : o.text;
      return `<div class="tile ${o.level}${stale ? " old" : ""}" data-meter="${m.id}" data-level="${o.level}" title="${esc(o.text)}"><b>${m.label}</b><div class="v">${esc(shown)}</div><div class="g">${o.needed ? m.goal(br) : "not needed here"}</div><div class="m"><i style="width:${o.pct}%"></i></div></div>`;
    }).join("");
  }

  function renderBoard(): void {
    const br = briefById(brief), cur = snap && snap.brief === brief ? snap : null;
    const card = (i: number): string => {
      const s = SLOTS[i], chosen = design[s.id];
      const mf = cur && cur.design[s.id] === chosen ? cur.out.misfits.find((x) => x.slot === s.id) : undefined;
      const fits = !!cur && cur.design[s.id] === chosen && !mf;
      const ladder = mf ? ladderOf(mf.block, mf.meters) : null;
      const n = open[s.id] ?? 0;
      let hint = "";
      if (mf && ladder) {
        const steps = [`<li>${esc(ladder.steps[0])}</li>`, `<li>${labChip(ladder.steps[1].lab)} ${esc(ladder.steps[1].labText)}</li>`, `<li class="why">${esc(ladder.steps[2])}</li>`];
        hint = `<div class="hint" data-hints="${s.id}"><b>This block does not fit here.</b><ol>${steps.slice(0, n).join("")}</ol>${n < 3 ? `<button data-more="${s.id}">${n === 0 ? "Give me a hint" : `Another hint (${n + 1} of 3)`}</button>` : `<span class="small">That was the last hint. Try another block.</span>`}</div>`;
      }
      const state = mf ? "misfit" : fits ? "fits" : "idle";
      return `<section class="slot ${state}${running === i ? " running" : ""}" data-slot="${s.id}" data-state="${state}"><header><span class="n">${i + 1}</span><div><b>${esc(s.title)}</b><small>${esc(s.stage)}</small></div></header><p class="ask">${esc(s.ask)}</p>
        ${blocksOf(s.id).map((b) => `<button class="blk" draggable="true" data-slot="${s.id}" data-id="${b.id}" aria-pressed="${b.id === chosen}"><b>${esc(b.name)}</b><span>${esc(b.plain)}</span>${facts(b, br.volume)}</button>`).join("")}${hint}</section>`;
    };
    const a = (t: string) => `<div class="arr" aria-hidden="true">${t}</div>`, e = `<div></div>`;
    // reading order snakes: 1 2 3, down, 6 5 4 (right to left), down, 7 8 9
    $("sd-board").innerHTML = [
      card(0), a("&rarr;"), card(1), a("&rarr;"), card(2),
      e, e, e, e, a("&darr;"),
      card(5), a("&larr;"), card(4), a("&larr;"), card(3),
      a("&darr;"), e, e, e, e,
      card(6), a("&rarr;"), card(7), a("&rarr;"), card(8),
    ].join("");
    // the empty cells in the arrow rows need no height beyond the arrow
  }

  function renderStatus(): void {
    const el = $("sd-status"), br = briefById(brief), cur = snap && snap.brief === brief ? snap : null;
    $("sd-brief-ask").textContent = br.ask;
    if (!cur) { el.className = "status"; el.innerHTML = `<b>Press Run.</b> The starter design runs, but it has problems. The meters will show where.`; return; }
    const stale = SLOTS.some((s) => cur.design[s.id] !== design[s.id]);
    if (stale) { el.className = "status"; el.innerHTML = `<b>You changed a block.</b> Press Run to see what it does. The old meters are dimmed.`; return; }
    if (cur.out.cleared) {
      const other = otherGoodDesign(design, brief);
      let alt = "";
      if (other) {
        const diff = SLOTS.filter((s) => other[s.id] !== design[s.id]);
        alt = `<p style="margin:6px 0 0"><b>A different good design also clears this brief:</b> in <em>${esc(diff.map((s) => s.title).join(", "))}</em> use <em>${esc(diff.map((s) => pblockById(other[s.id])!.name).join(", "))}</em> (${esc(tradeOff(design, other, brief))}). Neither is wrong; it is a trade-off.</p>`;
      }
      el.className = "status ok"; el.innerHTML = `<b class="good">Cleared.</b> ${esc(cur.out.summary)}${alt}`;
    } else {
      el.className = "status"; el.innerHTML = `<b>Not yet.</b> ${esc(cur.out.summary)} Open the hints on the red cards.`;
    }
  }

  function render(): void {
    $("sd-briefs").innerHTML = BRIEFS.map((b) => `<button data-brief="${b.id}" aria-pressed="${b.id === brief}">${esc(b.title)}</button>`).join("");
    renderMeters(); renderBoard(); renderStatus();
    root.dataset.ran = snap ? "1" : "0";
  }

  function run(): void {
    timers.forEach(clearTimeout); timers = [];
    const finish = () => { snap = { design: { ...design }, out: score(design, brief), brief }; open = {}; running = -1; render(); };
    if (reduce) { finish(); return; }
    ($("sd-run") as HTMLButtonElement).disabled = true;
    SLOTS.forEach((_, i) => timers.push(window.setTimeout(() => { running = i; renderBoard(); }, i * 110)));
    timers.push(window.setTimeout(() => { finish(); ($("sd-run") as HTMLButtonElement).disabled = false; }, SLOTS.length * 110 + 60));
  }
  const put = (slot: string, id: string): void => {
    if (!SLOTS.some((s) => s.id === slot) || !blocksOf(slot as SlotId).some((b) => b.id === id)) return;
    if (design[slot as SlotId] === id) return;
    design = { ...design, [slot]: id }; delete open[slot as SlotId]; render();
  };

  wrap.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const blk = t.closest<HTMLElement>(".blk"), more = t.closest<HTMLElement>("[data-more]"), br = t.closest<HTMLElement>("[data-brief]");
    if (blk) put(blk.dataset.slot!, blk.dataset.id!);
    else if (more) { const s = more.dataset.more as SlotId; open[s] = Math.min(3, (open[s] ?? 0) + 1); renderBoard(); }
    else if (br) { brief = br.dataset.brief as BriefId; open = {}; render(); }
  });
  let drag: { slot?: string; id?: string } = {};
  wrap.addEventListener("dragstart", (e) => {
    const blk = (e.target as HTMLElement).closest<HTMLElement>(".blk"); if (!blk) return;
    drag = { slot: blk.dataset.slot, id: blk.dataset.id };
    e.dataTransfer?.setData("text/plain", blk.dataset.id!); if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  });
  const board = $("sd-board");
  board.addEventListener("dragover", (e) => { const s = (e.target as HTMLElement).closest<HTMLElement>(".slot"); if (s && s.dataset.slot === drag.slot) { e.preventDefault(); s.classList.add("over"); } });
  board.addEventListener("dragleave", (e) => (e.target as HTMLElement).closest(".slot")?.classList.remove("over"));
  board.addEventListener("drop", (e) => {
    e.preventDefault();
    const s = (e.target as HTMLElement).closest<HTMLElement>(".slot"); board.querySelectorAll(".over").forEach((x) => x.classList.remove("over"));
    if (!s || !drag.id) return;
    if (s.dataset.slot === drag.slot) put(drag.slot!, drag.id);
    drag = {};
  });
  board.addEventListener("dragend", () => { drag = {}; board.querySelectorAll(".over").forEach((x) => x.classList.remove("over")); });
  $("sd-run").addEventListener("click", run);
  $("sd-reset").addEventListener("click", () => { design = { ...STARTER }; snap = null; open = {}; $("sd-partner").innerHTML = `<span class="small">No comment yet.</span>`; render(); });
  $("sd-ask").addEventListener("click", async () => {
    if (partnerBusy) return;
    partnerBusy = true; const b = $("sd-ask") as HTMLButtonElement; b.disabled = true; const label = b.textContent; b.textContent = "Asking (up to 25 seconds)...";
    const a: PartnerAnswer = await askDesignPartner({ brief, design: { ...design }, note: $<HTMLTextAreaElement>("sd-note").value });
    const out = $("sd-partner"); out.textContent = "";
    const box = document.createElement("div"); box.className = "opinion" + (a.kind === "recorded" ? " rec" : "");
    const head = document.createElement("div"); head.className = "small"; head.style.fontWeight = "700";
    head.textContent = a.kind === "live" ? "The partner's opinion (Muse Spark Open, an AI, asked just now). The meters win on facts." : `A recorded comment made from your meters, not a live answer. ${a.why ?? ""}`;
    const body = document.createElement("p"); body.style.margin = "4px 0 0"; body.textContent = a.text; body.id = "sd-partner-text";
    box.append(head, body); out.append(box); out.dataset.kind = a.kind;
    partnerBusy = false; b.disabled = false; b.textContent = label;
  });

  render();
  labPopulated("lab-systemdesign");
  return { backend: "canvas2d" };
}
