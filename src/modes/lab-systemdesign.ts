import { mountLabsNav } from "../ui/labs-nav";
import { labsOn } from "../ui/labs";
import { labPopulated } from "../ui/lab-default";
import { labNumberOf } from "../ui/labs-series";
import { BLOCKS, GROUP_TITLES, WHERE_TITLES, blockById, type Group, type Where } from "../labs/systemdesign/blocks";
import { REAL, REAL_NOTE, REAL_WHY, SCENARIOS, diffFromReal, failureOutcome, judge, scenarioById } from "../labs/systemdesign/judge";
import { MAX_NOTE } from "../labs/systemdesign/partner-core";
import { askDesignPartner, type PartnerAnswer } from "../labs/systemdesign/partner-client";

// Lab 18 (finale): System design. Drag blocks into a flow; a rule engine built from our lessons judges it; meters move; a failure runs through the diagram; the AI partner gives ONE opinion.
// Nothing here is a chat. The judge wins on facts. Behind the labs switch (?labs=1).
const INK = "#17201d", TEAL = "#0f6b5c", RED = "#b91c1c", ORANGE = "#d9741a";
const COLOUR: Record<Where, string> = { browser: "#e6f2ee", edge: "#e8eefb", gpu: "#fdeccf", api: "#f1e6f7", cpu: "#eef1ee" };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const money = (n: number): string => (n >= 100 ? `$${Math.round(n).toLocaleString("en-US")}` : `$${n.toFixed(2)}`);

function wrapText(s: string, n: number): string[] {
  const out: string[] = []; let cur = "";
  for (const w of s.split(" ")) { if ((cur + " " + w).trim().length > n && cur) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) out.push(cur);
  return out.slice(0, 3);
}

/** A flow as an SVG: boxes in rows of four with arrows. `failed` marks a box red; `dot` puts the moving dot on a box index. */
export function flowSvg(ids: string[], o: { failed?: string; dot?: number; mark?: Set<string>; scale?: number } = {}): string {
  const per = 3, bw = 190, bh = 74, gx = 30, gy = 34, rows = Math.max(1, Math.ceil(ids.length / per));
  const W = per * bw + (per - 1) * gx + 8, H = rows * bh + (rows - 1) * gy + 8;
  const pos = (i: number) => ({ x: 4 + (i % per) * (bw + gx), y: 4 + Math.floor(i / per) * (bh + gy) });
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Flow of ${ids.length} blocks" style="display:block;max-height:${Math.round(H * (o.scale ?? 1))}px"><defs><marker id="ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="#52605a"/></marker></defs>`;
  ids.forEach((id, i) => { // arrows first so boxes sit on top
    if (i === 0) return;
    const a = pos(i - 1), b = pos(i);
    s += a.y === b.y ? `<line x1="${a.x + bw}" y1="${a.y + bh / 2}" x2="${b.x - 2}" y2="${b.y + bh / 2}" stroke="#52605a" stroke-width="2" marker-end="url(#ah)"/>`
      : `<path d="M${a.x + bw / 2} ${a.y + bh} V${a.y + bh + gy / 2} H${b.x + bw / 2} V${b.y - 2}" fill="none" stroke="#52605a" stroke-width="2" marker-end="url(#ah)"/>`;
  });
  ids.forEach((id, i) => {
    const b = blockById(id); if (!b) return; const p = pos(i), bad = o.failed === id, mark = o.mark?.has(id);
    s += `<g data-node="${id}" style="cursor:pointer"><rect x="${p.x}" y="${p.y}" width="${bw}" height="${bh}" rx="8" fill="${bad ? "#fde2e2" : COLOUR[b.where]}" stroke="${bad ? RED : mark ? ORANGE : "#9aa5a0"}" stroke-width="${bad || mark ? 3 : 1.5}"/>`;
    wrapText(b.name, 24).forEach((t, k) => { s += `<text x="${p.x + 10}" y="${p.y + 22 + k * 16}" font-size="13" font-weight="700" fill="${INK}">${esc(t)}</text>`; });
    s += `<text x="${p.x + 10}" y="${p.y + bh - 8}" font-size="11" fill="#52605a">${i + 1}. ${esc(WHERE_TITLES[b.where])}</text></g>`;
  });
  if (o.dot !== undefined && o.dot >= 0 && o.dot < ids.length) { const p = pos(o.dot); s += `<circle cx="${p.x + bw / 2}" cy="${p.y - 6}" r="8" fill="${o.failed === ids[o.dot] ? RED : TEAL}"/>`; }
  return s + "</svg>";
}

export function startLabSystemdesign(host: HTMLElement): { backend: "canvas2d" } {
  const num = labNumberOf("lab-systemdesign"), title = `Lab ${num}: System design: build the whole game`;
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
    #lab-systemdesign .wrap{max-width:1240px;margin:0 auto;padding:56px 16px 24px;display:grid;gap:14px}
    #lab-systemdesign h1{font-size:22px;margin:0}#lab-systemdesign h2{font-size:15px;margin:0 0 6px}
    #lab-systemdesign .grid{display:grid;grid-template-columns:300px minmax(0,1fr) 330px;gap:14px;align-items:start}
    #lab-systemdesign .card{background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:12px}
    #lab-systemdesign .small{color:#52605a;font-size:13px}
    #lab-systemdesign button{font:600 13px system-ui;padding:6px 9px;border:1px solid #b9c4bb;border-radius:8px;background:#fff;color:${INK};cursor:pointer}
    #lab-systemdesign button[aria-pressed=true]{border-color:${TEAL};background:#e6f2ee}
    #lab-systemdesign button.go{background:${TEAL};color:#fff;border-color:${TEAL};font-weight:700;padding:8px 12px}
    #lab-systemdesign button:disabled{opacity:.5;cursor:default}
    #lab-systemdesign button:focus-visible{outline:2px solid #ffd27a;outline-offset:1px}
    #lab-systemdesign .scen{display:flex;gap:6px;flex-wrap:wrap}
    #lab-systemdesign .gt{font:700 12px system-ui;color:#52605a;margin:10px 0 4px;text-transform:uppercase;letter-spacing:.04em}
    #lab-systemdesign .blk{display:block;width:100%;text-align:left;margin:0 0 5px;padding:6px 8px;cursor:grab;border-left:6px solid #9aa5a0}
    #lab-systemdesign .blk b{display:block;font-size:13px}#lab-systemdesign .blk span{display:block;font:400 12px system-ui;color:#52605a}
    #lab-systemdesign .chips{display:flex;flex-wrap:wrap;gap:6px;min-height:46px;padding:8px;border:2px dashed #9aa5a0;border-radius:10px;background:#fafcfa}
    #lab-systemdesign .chips.over{border-color:${TEAL};background:#e6f2ee}
    #lab-systemdesign .chip{display:inline-flex;gap:6px;align-items:center;padding:4px 4px 4px 10px;border:1px solid #9aa5a0;border-radius:99px;font:600 12px system-ui;cursor:grab}
    #lab-systemdesign .chip button{padding:0 7px;border-radius:99px;line-height:20px}
    #lab-systemdesign .meter{margin:0 0 9px}#lab-systemdesign .meter .row{display:flex;justify-content:space-between;font-size:13px}
    #lab-systemdesign .bar{height:9px;background:#e3e8e4;border-radius:5px;overflow:hidden}#lab-systemdesign .bar i{display:block;height:100%;background:${TEAL};transition:width .3s}
    #lab-systemdesign .bar.bad i{background:${RED}}
    #lab-systemdesign ul.rules{list-style:none;margin:0;padding:0;display:grid;gap:6px}
    #lab-systemdesign .rules li{font-size:13px;padding-left:22px;position:relative}
    #lab-systemdesign .rules li:before{position:absolute;left:0;font-weight:800}
    #lab-systemdesign .rules li.pass:before{content:"\\2713";color:${TEAL}}#lab-systemdesign .rules li.fail:before{content:"\\2717";color:${RED}}
    #lab-systemdesign .rules b{display:block}
    #lab-systemdesign .good{color:${TEAL};font-weight:700}#lab-systemdesign .bad{color:${RED};font-weight:700}
    #lab-systemdesign textarea,#lab-systemdesign select{font:14px system-ui;padding:6px;border:1px solid #b9c4bb;border-radius:8px;width:100%;box-sizing:border-box}
    #lab-systemdesign .opinion{background:#f1e6f7;border-radius:8px;padding:10px;font-size:14px}
    #lab-systemdesign .opinion.rec{background:#eef1ee}
    #lab-systemdesign a.back{color:${TEAL};font-weight:600}
    #lab-systemdesign [hidden]{display:none !important}
  `;
  root.append(style);
  const wrap = document.createElement("div"); wrap.className = "wrap"; root.append(wrap);
  const groups: Group[] = ["page", "models", "guards", "net"];
  wrap.innerHTML = `
    <div><a class="back" href="/?welcome=0">Back to the game</a>
    <h1>${title}</h1>
    <p class="small" style="margin:2px 0 0">Build the system. Drag blocks into your design, or press a block to add it. The judge, the meters and a pretend failure tell you how it holds up.</p>
    <p class="small" id="sd-start" style="margin:4px 0 0;font-weight:600;color:${TEAL}">It opens on a first try that has problems. Fix them.</p></div>
    <div class="card"><div class="scen" id="sd-scen"></div><p id="sd-ask-text" style="margin:8px 0 0"></p></div>
    <div class="grid">
      <div class="card"><h2>Blocks</h2>${groups.map((g) => `<div class="gt">${GROUP_TITLES[g]}</div>${BLOCKS.filter((b) => b.group === g).map((b) => `<button class="blk" draggable="true" data-id="${b.id}" style="border-left-color:${COLOUR[b.where] === "#eef1ee" ? "#9aa5a0" : "#52605a"}"><b>${esc(b.name)}</b><span>${esc(b.short)}</span></button>`).join("")}`).join("")}
        <div class="card" style="margin-top:8px;background:#fafcfa"><h2 id="sd-info-t">Facts</h2><div class="small" id="sd-info">Point at a block to read its facts and where they come from.</div></div></div>
      <div style="display:grid;gap:14px;min-width:0">
        <div class="card"><h2>Your design (drag to reorder, press x to remove)</h2><div class="chips" id="sd-flow" aria-label="Your design"></div>
          <div style="margin-top:8px;display:flex;gap:6px"><button id="sd-clear">Start again from empty</button></div></div>
        <div class="card"><h2>The flow</h2><div id="sd-diagram"></div>
          <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap"><label class="small" for="sd-fail-pick">If this block is down:</label><select id="sd-fail-pick" style="width:auto;min-width:260px"></select><button class="go" id="sd-fail-play">Play failure</button></div>
          <p id="sd-fail-says" style="margin:8px 0 0;min-height:22px"></p></div>
        <div class="card"><h2>Ask the partner (one opinion, not a chat)</h2>
          <p class="small" style="margin:0 0 6px">Sends only your block names and links to an AI. It comments on the design. The judge wins on facts.</p>
          <textarea id="sd-note" rows="2" maxlength="${MAX_NOTE}" placeholder="Optional: why you chose it (up to ${MAX_NOTE} letters)"></textarea>
          <button class="go" id="sd-ask" style="margin-top:6px">Ask the partner</button>
          <div id="sd-partner" style="margin-top:8px" aria-live="polite"></div></div>
        <div class="card"><h2>Your design against the real game</h2><button class="go" id="sd-reveal-btn">Show the real design</button><div id="sd-reveal" hidden></div></div>
      </div>
      <div style="display:grid;gap:14px">
        <div class="card"><h2>Meters</h2><div id="sd-meters"></div></div>
        <div class="card"><h2>Scenario checks <span id="sd-cleared"></span></h2><ul class="rules" id="sd-checks"></ul></div>
        <div class="card"><h2>The judge: our lessons <span class="small" id="sd-lessons"></span></h2><ul class="rules" id="sd-judge"></ul></div>
      </div>
    </div>`;
  const $ = <T extends HTMLElement>(id: string): T => wrap.querySelector("#" + id) as T;
  let sc = "photo", ids: string[] = ["pages", "browser", "keyinpage", "sam3", "sam3d"], failed = "", timers: number[] = [], partnerBusy = false, reveal = false;
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const stopAnim = () => { timers.forEach(clearTimeout); timers = []; };
  const insert = (id: string, at: number) => { ids.splice(Math.max(0, Math.min(at, ids.length)), 0, id); if (ids.length > 30) ids.pop(); render(); };
  const showInfo = (id: string) => { const b = blockById(id); if (!b) return; $("sd-info-t").textContent = b.name; $("sd-info").innerHTML = `<ul style="margin:0;padding-left:16px">${b.facts.map((f) => `<li>${esc(f)}</li>`).join("")}</ul><p style="margin:6px 0 0">Source: ${esc(b.source)}${b.note ? ` (${esc(b.note)})` : ""}</p>`; };

  function render(): void {
    stopAnim();
    const s = scenarioById(sc), v = judge(sc, ids);
    $("sd-scen").innerHTML = SCENARIOS.map((x, i) => `<button data-s="${x.id}" aria-pressed="${x.id === sc}">${i + 1}. ${esc(x.title)}</button>`).join("");
    $("sd-ask-text").textContent = s.ask;
    $("sd-flow").innerHTML = ids.length ? ids.map((id, i) => `<span class="chip" draggable="true" data-i="${i}" style="background:${COLOUR[blockById(id)!.where]}">${i + 1}. ${esc(blockById(id)!.name)}<button aria-label="Remove ${esc(blockById(id)!.name)}" data-rm="${i}">x</button></span>`).join("") : `<span class="small">Empty. Drag blocks here.</span>`;
    const bad = new Set(failed ? [failed] : []);
    $("sd-diagram").innerHTML = ids.length ? flowSvg(ids, { failed: failed && ids.includes(failed) ? failed : undefined, mark: bad }) : `<p class="small">Add blocks to see the flow.</p>`;
    const sel = $<HTMLSelectElement>("sd-fail-pick");
    const fp = ids.filter((id, i) => blockById(id)!.fail !== "none" && ids.indexOf(id) === i);
    sel.innerHTML = fp.length ? fp.map((id) => `<option value="${id}">${esc(blockById(id)!.name)}</option>`).join("") : `<option value="">(no block can fail yet)</option>`;
    if (failed && fp.includes(failed)) sel.value = failed;
    ($("sd-fail-play") as HTMLButtonElement).disabled = !fp.length;
    const m = v.meters, meter = (label: string, text: string, pct: number, bad: boolean) => `<div class="meter"><div class="row"><span>${label}</span><b>${text}</b></div><div class="bar${bad ? " bad" : ""}"><i style="width:${Math.max(2, Math.min(100, pct))}%"></i></div></div>`;
    $("sd-meters").innerHTML =
      meter("Cost per 1,000 objects", `${money(m.costPer1000)}${m.unmeasured ? " + ?" : ""}`, (m.costPer1000 / 200) * 100, s.budget ? m.monthly > s.budget : m.costPer1000 > 100) +
      `<p class="small" style="margin:-4px 0 9px">${money(m.monthly)} a month at ${s.volume.toLocaleString("en-US")} objects${s.budget ? `. Budget ${money(s.budget)}.` : "."}${m.unmeasured ? " The Vultr price was never measured." : ""}</p>` +
      meter("Time to first result (warm)", `${m.warm} s`, (m.warm / 60) * 100, m.warm > 40) +
      `<p class="small" style="margin:-4px 0 9px">${m.coldExtra ? `First visitor of the day: ${m.coldExtra} s more (cold start).` : "No cold start for the first visitor."}</p>` +
      meter("Privacy risk", m.privacy === 0 ? "low" : m.privacy < 50 ? "medium" : "high", m.privacy, m.privacy >= 50) +
      meter("When something fails, the player is not left hanging", `${m.coverage}%`, m.coverage, m.coverage < 100 && m.uncovered.length > 0 && m.coverage < 60) +
      (m.uncovered.length ? `<p class="small" style="margin:-4px 0 0">Left hanging if down: ${m.uncovered.map(esc).join(", ")}.</p>` : "");
    $("sd-checks").innerHTML = v.checks.map((c) => `<li class="${c.ok ? "pass" : "fail"}">${esc(c.text)}</li>`).join("");
    $("sd-cleared").innerHTML = v.cleared ? `<span class="good">Cleared</span>` : `<span class="small">${v.checks.filter((c) => c.ok).length} of ${v.checks.length}</span>`;
    $("sd-lessons").textContent = `${v.lessonsPassed} of ${v.lessonsTotal} kept`;
    $("sd-judge").innerHTML = v.rules.filter((r) => r.state !== "na").map((r) => `<li class="${r.state}"><b>${esc(r.lesson)}</b>${esc(r.why)}</li>`).join("");
    $("sd-fail-says").textContent = "";
    $("sd-reveal").hidden = !reveal;
    if (reveal) renderReveal();
  }

  function renderReveal(): void {
    const d = diffFromReal(ids);
    const li = (id: string, why: string) => `<li><b>${esc(blockById(id)!.name)}</b> ${esc(why)}</li>`;
    $("sd-reveal").innerHTML = `<p class="small">Yours (top) and the real game (bottom). Orange boxes are the differences.</p>
      ${flowSvg(ids, { mark: new Set(d.extra), scale: 0.7 })}<hr style="border:0;border-top:1px solid #d5ddd6;margin:8px 0">${flowSvg([...REAL], { mark: new Set(d.missing), scale: 0.7 })}
      <h2 style="margin-top:10px">In ours, not yours</h2><ul class="small">${d.missing.map((id) => li(id, REAL_WHY[id])).join("") || "<li>Nothing. You have every block we use.</li>"}</ul>
      <h2>In yours, not ours</h2><ul class="small">${d.extra.map((id) => li(id, `We did not use it. ${blockById(id)!.facts[0]}`)).join("") || "<li>Nothing extra.</li>"}</ul>
      <p class="small"><b>An honest trade-off.</b> ${esc(REAL_NOTE)}</p>`;
  }

  function playFailure(): void {
    const id = $<HTMLSelectElement>("sd-fail-pick").value; if (!id || !ids.includes(id)) return;
    stopAnim(); failed = id;
    const target = ids.indexOf(id), o = failureOutcome(ids, id), says = $("sd-fail-says");
    const draw = (dot: number) => { $("sd-diagram").innerHTML = flowSvg(ids, { failed: dot >= target ? id : undefined, dot }); };
    const end = () => { draw(target); says.className = o.level === "broken" ? "bad" : "good"; says.textContent = `${o.level === "result" ? "The player still gets something: " : o.level === "message" ? "The player gets a plain message: " : "The player is left hanging: "}${o.sees}`; };
    says.className = ""; says.textContent = "";
    if (reduce) { end(); return; }
    for (let i = 0; i <= target; i++) timers.push(window.setTimeout(() => { draw(i); if (i === target) timers.push(window.setTimeout(end, 350)); }, i * 380));
  }

  // ---- events ----
  wrap.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const blk = t.closest<HTMLElement>(".blk"), rm = t.closest<HTMLElement>("[data-rm]"), sb = t.closest<HTMLElement>("[data-s]"), nd = t.closest<SVGElement>("[data-node]");
    if (rm) { ids.splice(Number(rm.dataset.rm), 1); failed = ""; render(); }
    else if (blk) insert(blk.dataset.id!, ids.length);
    else if (sb) { sc = sb.dataset.s!; render(); }
    else if (nd && $("sd-diagram").contains(nd)) { const id = nd.getAttribute("data-node")!; if (blockById(id)!.fail !== "none") { $<HTMLSelectElement>("sd-fail-pick").value = id; failed = id; playFailure(); } }
  });
  wrap.addEventListener("mouseover", (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>(".blk"); if (b) showInfo(b.dataset.id!); });
  wrap.addEventListener("focusin", (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>(".blk"); if (b) showInfo(b.dataset.id!); });
  let drag: { id?: string; from?: number } = {};
  wrap.addEventListener("dragstart", (e) => {
    const t = e.target as HTMLElement, blk = t.closest<HTMLElement>(".blk"), chip = t.closest<HTMLElement>(".chip");
    drag = blk ? { id: blk.dataset.id } : chip ? { from: Number(chip.dataset.i) } : {};
    e.dataTransfer?.setData("text/plain", blk?.dataset.id ?? "chip"); if (e.dataTransfer) e.dataTransfer.effectAllowed = "copyMove";
  });
  const zone = $("sd-flow");
  zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("over"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault(); zone.classList.remove("over");
    const over = (e.target as HTMLElement).closest<HTMLElement>(".chip");
    let at = over ? Number(over.dataset.i) : ids.length;
    if (drag.id) insert(drag.id, at);
    else if (drag.from !== undefined) { const [m] = ids.splice(drag.from, 1); if (drag.from < at) at--; ids.splice(at, 0, m); render(); }
    drag = {};
  });
  $("sd-clear").addEventListener("click", () => { ids = []; failed = ""; $("sd-start").hidden = true; $("sd-partner").textContent = ""; render(); });
  $("sd-fail-play").addEventListener("click", playFailure);
  $("sd-reveal-btn").addEventListener("click", () => { reveal = !reveal; $("sd-reveal-btn").textContent = reveal ? "Hide the real design" : "Show the real design"; render(); });
  $("sd-ask").addEventListener("click", async () => {
    if (partnerBusy || !ids.length) return;
    partnerBusy = true; const b = $("sd-ask") as HTMLButtonElement; b.disabled = true; b.textContent = "Asking (can take up to 25 seconds)...";
    const a: PartnerAnswer = await askDesignPartner({ scenario: sc, blocks: ids, note: $<HTMLTextAreaElement>("sd-note").value });
    const out = $("sd-partner"); out.textContent = "";
    const box = document.createElement("div"); box.className = "opinion" + (a.kind === "recorded" ? " rec" : "");
    const head = document.createElement("div"); head.className = "small"; head.style.fontWeight = "700";
    head.textContent = a.kind === "live" ? "The partner's opinion (Muse Spark Open, an AI, asked just now). The judge wins on facts." : `A recorded example for the closest design, not a live answer. ${a.why ?? ""}`;
    const body = document.createElement("p"); body.style.margin = "4px 0 0"; body.textContent = a.text; body.id = "sd-partner-text";
    box.append(head, body); out.append(box); out.dataset.kind = a.kind;
    partnerBusy = false; b.disabled = false; b.textContent = "Ask the partner";
  });

  render();
  labPopulated("lab-systemdesign");
  return { backend: "canvas2d" };
}
