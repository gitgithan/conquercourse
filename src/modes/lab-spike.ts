import { mountLabsNav } from "../ui/labs-nav";
import { labsOn } from "../ui/labs";
import { labDefaultNote, labPopulated } from "../ui/lab-default";
import { labNumberOf } from "../ui/labs-series";
import {
  SCENARIOS, STORIES, WALL_TEST_LABELS, WALL_TEST_NEEDS, checkChallenge, cloneScenario, earlyPlan, evaluate, expectedExtra, latePlan, referencePlan, spikeOrder,
  riding, ridingHours, scare, storyTotals, verdict, type Outcome, type Scenario, type Step,
} from "../labs/spike/spike-core";

// Lab 19: Spike the riskiest call first. The player ranks the risks of a new move or obstacle, sees the same project run with the tests at the end and with the scariest test first,
// orders a plan to pass a hard budget, and replays two real stories from our own experiments (data/eval/cc-17-wall, data/eval/bar-motion). All numbers are computed in the page
// by src/labs/spike/spike-core.ts. Nothing here talks or grades a person. Equations come last, behind a button (labs may show equations). Behind the labs switch (?labs=1).
const INK = "#17201d", TEAL = "#0f6b5c", ORANGE = "#d9741a", GREY = "#9aa5a0", RED = "#b91c1c";
const W = 1100;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const f = (v: number, d = 1) => v.toFixed(d);
const money = (v: number) => (v === 0 ? "$0" : `$${v.toFixed(v < 0.1 ? 3 : 2)}`);
const DEFAULT_FAIL: Record<string, string> = { bars: "find", wall: "reach" };

export function startLabSpike(host: HTMLElement): { backend: "canvas2d" } {
  const num = labNumberOf("lab-spike");
  const root = document.createElement("div");
  root.id = "lab-spike";
  root.style.cssText = `position:fixed;inset:0;overflow:auto;background:#f5f7f4;color:${INK};font:15px/1.4 system-ui,sans-serif`;
  host.append(root);
  mountLabsNav(host, "lab-spike");
  if (!labsOn()) {
    root.innerHTML = `<div style="max-width:520px;margin:12vh auto;padding:0 16px"><h1 style="font-size:22px">Lab ${num}: Spike the riskiest call first</h1><p>Labs are switched off.</p><p><a href="?mode=lab-spike&labs=1" style="color:${TEAL}">Switch labs on</a></p></div>`;
    return { backend: "canvas2d" };
  }
  const style = document.createElement("style");
  style.textContent = `
    #lab-spike .wrap{max-width:1200px;margin:0 auto;padding:16px;display:grid;gap:14px}
    #lab-spike h1{font-size:22px;margin:0}#lab-spike h2{font-size:15px;margin:0 0 6px}
    #lab-spike .card{background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:12px}
    #lab-spike label{display:grid;gap:2px;margin:6px 0}#lab-spike input[type=range]{width:100%}
    #lab-spike select{font:14px system-ui;padding:6px;border:1px solid #b9c4bb;border-radius:8px}
    #lab-spike svg{width:100%;height:auto;display:block;border-radius:6px;background:#eef3ee}
    #lab-spike .small{color:#52605a;font-size:13px}
    #lab-spike .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    #lab-spike button.b{font:600 13px system-ui;padding:6px 10px;border:1px solid #b9c4bb;border-radius:8px;background:#fff;color:${INK};cursor:pointer}
    #lab-spike button.b:focus-visible,#lab-spike .grip:focus-visible{outline:2px solid #ffd27a;outline-offset:1px}
    #lab-spike button.go{font:700 14px system-ui;padding:8px 12px;border:0;border-radius:8px;background:${TEAL};color:#fff;cursor:pointer}
    #lab-spike button.link{background:none;border:0;color:${TEAL};font:600 14px system-ui;cursor:pointer;padding:0;text-decoration:underline}
    #lab-spike a.back{color:${TEAL};font-weight:600}
    #lab-spike .board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    #lab-spike .risk{border:1px solid #d5ddd6;border-radius:10px;padding:10px;background:#fbfcfb;cursor:grab}
    #lab-spike .risk.over,#lab-spike .step.over{outline:2px dashed ${TEAL}}
    #lab-spike .risk .rh{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
    #lab-spike .rk{font:700 12px system-ui;background:${TEAL};color:#fff;border-radius:99px;padding:1px 8px}
    #lab-spike .meter{height:10px;border-radius:5px;background:#e3e8e4;overflow:hidden;margin:4px 0}
    #lab-spike .meter i{display:block;height:100%;background:${ORANGE}}
    #lab-spike .grid2{display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:14px;align-items:start}
    #lab-spike .step{display:grid;grid-template-columns:auto auto 1fr auto auto;gap:6px;align-items:center;border:1px solid #d5ddd6;border-radius:8px;padding:4px 8px;margin:3px 0;background:#fff;cursor:grab}
    #lab-spike .step.nt{background:#f1f1ef;border-color:${GREY}}
    #lab-spike .step.bad{border-color:${RED}}
    #lab-spike .chip{font:700 11px system-ui;border-radius:6px;padding:2px 6px}
    #lab-spike .chip.build{background:#e3ebf3;color:#2b4a6b}#lab-spike .chip.spike{background:#e6f2ee;color:${TEAL}}
    #lab-spike .chip.free{background:#e6f2ee;color:${TEAL}}#lab-spike .chip.paid{background:#fdebd9;color:#8a4a0d}#lab-spike .chip.nt{background:#eceeed;color:#52605a}
    #lab-spike .grip{cursor:grab;color:#52605a;font-weight:700;user-select:none}
    #lab-spike table{border-collapse:collapse;width:100%;font-size:13px}#lab-spike th,#lab-spike td{text-align:left;padding:3px 8px 3px 0;border-bottom:1px solid #e3e8e4;vertical-align:top}
    #lab-spike .good{color:${TEAL};font-weight:700}#lab-spike .bad{color:${RED};font-weight:700}
    #lab-spike .eq{font:14px/1.6 ui-monospace,Menlo,monospace;background:#f1f4f1;border-radius:8px;padding:8px 10px;white-space:pre-wrap}
    #lab-spike .ev{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:start;border:1px solid #d5ddd6;border-radius:8px;padding:6px 10px;margin:4px 0;background:#fff}
    #lab-spike .ev.future{opacity:.5}#lab-spike .ev.now{border-color:${TEAL};box-shadow:0 0 0 2px #e6f2ee}
    #lab-spike [hidden]{display:none !important}
    #lab-spike .big{font-size:20px;font-weight:800}
    @media (max-width:1100px){#lab-spike .board{grid-template-columns:repeat(2,minmax(0,1fr))}#lab-spike .grid2{grid-template-columns:1fr}}
  `;
  root.append(style);
  const wrap = document.createElement("div"); wrap.className = "wrap"; root.append(wrap);
  wrap.innerHTML = `
    <div><a class="back" href="/?welcome=0">Back to the game</a>
    <h1>Lab ${num}: Spike the riskiest call first</h1>
    <p class="small" style="margin:6px 0 0">The goal: when you add a new move or obstacle, find the thing most likely to break it with the cheapest test, before you build on top of it. The same story is in <code>docs/labs/spike.md</code>.</p></div>
    <div class="card"><h2>Pick a feature</h2>
      <div class="row"><select id="lsp-sc" aria-label="Feature"></select><span class="small" id="lsp-blurb"></span></div></div>
    <div class="card"><h2>1. The risk board</h2>
      <p class="small" style="margin:0 0 6px">Scare = chance it fails x hours of work riding on it. Drag a card to set the order of your tests.</p>
      <div class="row" style="margin-bottom:8px"><button class="b" id="lsp-sort">Sort: scariest first, but after what it needs</button><span class="small" id="lsp-order-says"></span></div>
      <div class="board" id="lsp-board"></div></div>
    <div class="card"><h2>2. The same project, two plans</h2>
      <div class="row"><label style="margin:0">What really fails<select id="lsp-fail"></select></label><span class="small" id="lsp-fail-says"></span></div>
      <svg id="lsp-tl" viewBox="0 0 ${W} 250" role="img" aria-label="Two plans on one clock"></svg>
      <div class="grid2" style="margin-top:8px"><table id="lsp-cmp"></table><div id="lsp-save" class="big"></div></div></div>
    <div class="card"><h2>3. Challenge: order the plan</h2>
      <p class="small" style="margin:0 0 6px" id="lsp-budget"></p>
      <div class="grid2"><div><div id="lsp-steps"></div>
        <div class="row" style="margin-top:8px"><button class="b" id="lsp-reset">Start from: build it all, test at the end</button><button class="b" id="lsp-show">Show one answer</button></div></div>
        <div><div class="big" id="lsp-status"></div><table style="margin-top:6px"><thead><tr><th>If this fails</th><th>Found by</th><th>At hour</th><th>Thrown away</th><th></th></tr></thead><tbody id="lsp-rows"></tbody></table>
        <p class="small" id="lsp-money" style="margin:6px 0 0"></p></div></div>
      <svg id="lsp-tl2" viewBox="0 0 ${W} 130" role="img" aria-label="Your plan when the worst case fails" style="margin-top:8px"></svg></div>
    <div class="card"><h2>4. Not tested is not failed</h2>
      <p class="small" style="margin:0 0 6px">A wall run-up from Kimodo. Tick what the test had.</p>
      <div class="row"><button class="b" id="lsp-p1">As first tried: text only, 36 samples</button><button class="b" id="lsp-p2">With the tools: round 1, 8 samples</button></div>
      <div class="row" id="lsp-needs" style="margin-top:8px"></div>
      <label>Samples that meet every pass line: <b id="lsp-pass-v"></b><input id="lsp-pass" type="range" min="0" max="8" step="1" value="0"></label>
      <div class="big" id="lsp-verdict"></div><p class="small" id="lsp-vsays" style="margin:4px 0 0"></p></div>
    <div class="card"><h2>5. Replay a real story</h2>
      <div class="row"><select id="lsp-story" aria-label="Story"></select><span class="small" id="lsp-story-says"></span></div>
      <label>Event: <b id="lsp-ev-v"></b><input id="lsp-ev" type="range" min="0" max="4" step="1" value="4"></label>
      <svg id="lsp-chart" viewBox="0 0 ${W} 150" role="img" aria-label="Money spent along the story"></svg>
      <div id="lsp-events" style="margin-top:6px"></div><p id="lsp-end" style="margin:6px 0 0"></p></div>
    <div class="card"><h2>The maths</h2><button class="link" id="lsp-eq-btn">Show the maths behind the plan</button><div class="eq" id="lsp-eq" hidden></div></div>`;
  const $ = <T extends HTMLElement>(id: string): T => wrap.querySelector("#" + id) as T;
  const note = labDefaultNote(wrap, "live", wrap.querySelector("p.small") as HTMLElement | null);
  void note;

  let base: Scenario = SCENARIOS[0];         // our numbers, never changed (the challenge uses these)
  let sc: Scenario = cloneScenario(base);    // the copy the sliders change
  let order: string[] = spikeOrder(sc);     // the player's order of tests
  let failing: string | null = DEFAULT_FAIL[base.id];
  let plan: Step[] = latePlan(base);         // the challenge plan
  let story = STORIES[0], evIdx = story.events.length - 1;
  const name = (s: Scenario, id: string) => s.risks.find((r) => r.id === id)!.name;

  // ---- drag to reorder: a list of items with data-i; calls move(from, to) ----
  function sortable(container: HTMLElement, sel: string, move: (from: number, to: number) => void) {
    let from = -1;
    container.querySelectorAll<HTMLElement>(sel).forEach((el) => {
      el.addEventListener("dragstart", (e) => { from = Number(el.dataset.i); e.dataTransfer?.setData("text/plain", String(from)); });
      el.addEventListener("dragover", (e) => { e.preventDefault(); el.classList.add("over"); });
      el.addEventListener("dragleave", () => el.classList.remove("over"));
      el.addEventListener("drop", (e) => { e.preventDefault(); el.classList.remove("over"); const a = from >= 0 ? from : Number(e.dataTransfer?.getData("text/plain")); from = -1; if (a !== Number(el.dataset.i)) move(a, Number(el.dataset.i)); });
    });
  }
  const moved = <T,>(a: T[], from: number, to: number): T[] => { const o = [...a]; const [x] = o.splice(from, 1); o.splice(to, 0, x); return o; };

  // ---- the timeline picture ----
  function timeline(s: Scenario, p: Step[], o: Outcome, scale: number, y: number, title: string, fail: string | null, hid: string): string {
    const px = (h: number) => 20 + (h / scale) * (W - 40), H = 42;
    let h = 0, out = `<text x="20" y="${y - 6}" font-weight="700" font-size="14" fill="${INK}">${esc(title)}</text>`;
    const lost = fail ? riding(s, fail) : new Set<string>();
    p.forEach((st, i) => {
      const r = s.risks.find((x) => x.id === st.id)!, d = st.kind === "build" ? r.build : r.test;
      const nt = st.kind === "spike" && o.notTested.includes(st.id), found = o.foundIndex === i;
      const wasted = st.kind === "build" && lost.has(st.id) && (o.foundIndex ?? 0) > i;
      const fill = st.kind === "build" ? (wasted ? "#e8b4b4" : "#c9d8e8") : nt ? `url(#${hid})` : found ? ORANGE : "#9ccfc0";
      out += `<rect x="${px(h)}" y="${y}" width="${Math.max(2, px(h + d) - px(h) - 1)}" height="${H}" fill="${fill}" stroke="${nt ? GREY : "#fff"}" stroke-width="1"><title>${esc(`${st.kind === "build" ? "Build" : "Test"}: ${r.name}, ${d} h`)}</title></rect>`;
      if (px(h + d) - px(h) > 34) out += `<text x="${px(h) + 3}" y="${y + 16}" font-size="11" fill="${INK}">${st.kind === "build" ? "B" : nt ? "?" : "T"} ${esc(r.id)}</text>`;
      h += d;
    });
    const tail = (d: number, fill: string, label: string) => { if (d <= 0) return; out += `<rect x="${px(h)}" y="${y}" width="${Math.max(2, px(h + d) - px(h) - 1)}" height="${H}" fill="${fill}" stroke="#fff"><title>${esc(label)}, ${f(d)} h</title></rect>`; if (px(h + d) - px(h) > 40) out += `<text x="${px(h) + 3}" y="${y + 16}" font-size="11" fill="${INK}">${esc(label)}</text>`; h += d; };
    tail(s.play, "#dfe5e1", "play all");
    tail(o.wasted, RED, "build again");
    tail(o.fb, "#f2c48d", "fallback");
    if (o.foundHour !== null) {
      const x = px(o.foundHour);
      out += `<path d="M${x} ${y - 4}V${y + H + 8}" stroke="${RED}" stroke-width="2"/><path d="M${x} ${y - 4}l12 5-12 5z" fill="${RED}"/><text x="${x + 14}" y="${y + H + 18}" font-size="12" font-weight="700" fill="${RED}">found at hour ${f(o.foundHour)} (${o.how === "spike" ? "by a test" : "by playing it all"})</text>`;
    }
    out += `<text x="${px(h)}" y="${y + H + 18}" font-size="12" text-anchor="end" fill="${INK}">${f(o.total)} h</text>`;
    return out;
  }
  const defs = (hid: string) => `<defs><pattern id="${hid}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#f1f1ef"/><path d="M0 0V6" stroke="${GREY}" stroke-width="2"/></pattern></defs>`;
  const legend = (y: number, hid: string) => [["#c9d8e8", "build"], ["#9ccfc0", "test (spike)"], [ORANGE, "the test that found it"], [`url(#${hid})`, "not tested"], ["#e8b4b4", "work thrown away"], [RED, "build again"], ["#f2c48d", "fallback"]]
    .map(([c, t], i) => `<rect x="${20 + i * 150}" y="${y}" width="14" height="14" fill="${c}" stroke="${GREY}"/><text x="${40 + i * 150}" y="${y + 12}" font-size="12" fill="${INK}">${t}</text>`).join("");

  // ---- 1. the board ----
  function renderBoard() {
    $("lsp-board").innerHTML = order.map((id, i) => {
      const r = sc.risks.find((x) => x.id === id)!;
      return `<div class="risk" draggable="true" data-i="${i}" data-id="${id}" tabindex="-1">
        <div class="rh"><span class="rk" data-rank>#${i + 1}</span><b>${esc(r.name)}</b></div>
        <div class="small">${esc(r.why)}</div>
        <label>Chance it fails: <b data-pv></b><input class="p" type="range" min="0" max="100" step="5" value="${r.p}" aria-label="Chance ${esc(r.name)}"></label>
        <label>Hours to build it: <b data-bv></b><input class="b" type="range" min="1" max="12" step="0.5" value="${r.build}" aria-label="Hours ${esc(r.name)}"></label>
        <div class="meter"><i data-meter></i></div>
        <div class="small"><b data-scare></b> riding: <span data-ride></span> h. Test: ${r.test} h, ${money(r.usd)}${r.needs.length ? `. Needs a test of: ${r.needs.map((n) => esc(name(sc, n))).join(", ")}` : ""}.</div>
        <div class="row" style="margin-top:4px"><button class="b" data-up aria-label="Earlier">Earlier</button><button class="b" data-down aria-label="Later">Later</button></div></div>`;
    }).join("");
    const el = $("lsp-board");
    sortable(el, ".risk", (a, b) => { order = moved(order, a, b); renderBoard(); recompute(); });
    el.querySelectorAll<HTMLElement>(".risk").forEach((card) => {
      const id = card.dataset.id!, i = Number(card.dataset.i), r = sc.risks.find((x) => x.id === id)!;
      card.querySelector<HTMLInputElement>("input.p")!.addEventListener("input", (e) => { r.p = Number((e.target as HTMLInputElement).value); numbers(); recompute(); });
      card.querySelector<HTMLInputElement>("input.b")!.addEventListener("input", (e) => { r.build = Number((e.target as HTMLInputElement).value); numbers(); recompute(); });
      card.querySelector<HTMLElement>("[data-up]")!.addEventListener("click", () => { if (i > 0) { order = moved(order, i, i - 1); renderBoard(); recompute(); } });
      card.querySelector<HTMLElement>("[data-down]")!.addEventListener("click", () => { if (i < order.length - 1) { order = moved(order, i, i + 1); renderBoard(); recompute(); } });
    });
    numbers();
  }
  function numbers() {
    const top = Math.max(...sc.risks.map((r) => scare(sc, r.id)), 0.001);
    $("lsp-board").querySelectorAll<HTMLElement>(".risk").forEach((card) => {
      const id = card.dataset.id!, r = sc.risks.find((x) => x.id === id)!, s = scare(sc, id);
      card.querySelector("[data-pv]")!.textContent = `${r.p}%`; card.querySelector("[data-bv]")!.textContent = `${f(r.build)} h`;
      card.querySelector<HTMLElement>("[data-meter]")!.style.width = `${(s / top) * 100}%`;
      card.querySelector("[data-scare]")!.textContent = `scare ${f(s)} h`; card.querySelector("[data-ride]")!.textContent = f(ridingHours(sc, id));
    });
    const rank = spikeOrder(sc);
    $("lsp-order-says").textContent = order.every((id, i) => id === rank[i]) ? "Your order: the scariest test that can run, first." : `Scariest that can run first: ${rank.map((id) => name(sc, id)).join(", ")}.`;
  }

  // ---- 2. two plans ----
  function recompute() {
    const late = latePlan(sc), early = earlyPlan(sc, order);
    const a = evaluate(sc, late, failing), b = evaluate(sc, early, failing);
    const scale = Math.max(a.total, b.total, 1) * 1.02;
    $("lsp-tl").innerHTML = defs("hatch1") + timeline(sc, late, a, scale, 30, "Build it all, test at the end", failing, "hatch1") + timeline(sc, early, b, scale, 130, "Test first in your order, then build", failing, "hatch1") + legend(228, "hatch1");
    const rows: [string, string, string][] = [
      ["Found at hour", a.foundHour === null ? "nothing fails" : f(a.foundHour), b.foundHour === null ? "nothing fails" : f(b.foundHour)],
      ["Found by", a.how === "none" ? "-" : a.how === "spike" ? "a test" : "playing it all", b.how === "none" ? "-" : b.how === "spike" ? "a test" : "playing it all"],
      ["Work thrown away", `${f(a.wasted)} h`, `${f(b.wasted)} h`], ["Money on tests", money(a.usd), money(b.usd)], ["Whole project", `${f(a.total)} h`, `${f(b.total)} h`],
      ["Average extra, by chance", `${f(expectedExtra(sc, late))} h`, `${f(expectedExtra(sc, early))} h`],
    ];
    $("lsp-cmp").innerHTML = `<thead><tr><th></th><th>Test at the end</th><th>Test first</th></tr></thead><tbody>${rows.map(([k, x, y]) => `<tr><td>${k}</td><td>${x}</td><td>${y}</td></tr>`).join("")}</tbody>`;
    const diff = a.total - b.total;
    $("lsp-save").innerHTML = failing ? (diff >= 0.05 ? `<span class="good">Testing first saves ${f(diff)} h</span>` : diff <= -0.05 ? `<span class="bad">Testing first costs ${f(-diff)} h more</span>` : "No difference") : `Nothing fails: testing first costs ${f(b.total - a.total)} h`;
    $("lsp-fail-says").textContent = b.notTested.length ? `Not tested: ${b.notTested.map((id) => name(sc, id)).join(", ")}. These tests ran before the test they need.` : failing ? `Chance of this one: ${sc.risks.find((r) => r.id === failing)!.p}%.` : "";
  }

  // ---- 3. the challenge ----
  function renderChallenge() {
    const b = base.budget, res = checkChallenge(base, plan);
    $("lsp-budget").innerHTML = `Whatever fails, a test must find it by <b>hour ${b.foundBy}</b>, throw away at most <b>${b.wasted} h</b> of work, and all tests cost at most <b>${money(b.usd)}</b>. A test that ran before the test it needs is not tested and does not count.`;
    const tested = new Set<string>(); const nt = new Set<string>(); const built = new Set<string>();
    $("lsp-steps").innerHTML = plan.map((s, i) => {
      const r = base.risks.find((x) => x.id === s.id)!;
      let cls = "", state = "";
      if (s.kind === "spike") { const ok = r.needs.every((n) => tested.has(n)); if (ok) tested.add(s.id); else { nt.add(s.id); cls = "nt"; state = `not tested: needs "${esc(name(base, r.needs.find((n) => !tested.has(n))!))}" first`; } } else {
        const miss = r.deps.find((d) => !built.has(d)); if (miss) { cls = "bad"; state = `built before "${esc(name(base, miss))}"`; } built.add(s.id);
      }
      return `<div class="step ${cls}" draggable="true" data-i="${i}"><span class="grip" tabindex="0" role="button" aria-label="Drag handle">::</span><span class="chip ${s.kind}">${s.kind === "build" ? "build" : "test"}</span>
        <span>${esc(r.name)}${state ? `<br><span class="small ${cls === "bad" ? "bad" : ""}">${state}</span>` : ""}</span><span class="small">${s.kind === "build" ? r.build : r.test} h</span>
        <span class="row"><button class="b" data-up aria-label="Move up">Up</button><button class="b" data-down aria-label="Move down">Down</button></span></div>`;
    }).join("");
    sortable($("lsp-steps"), ".step", (a, c) => { plan = moved(plan, a, c); renderChallenge(); });
    $("lsp-steps").querySelectorAll<HTMLElement>(".step").forEach((el) => {
      const i = Number(el.dataset.i);
      el.querySelector("[data-up]")!.addEventListener("click", () => { if (i > 0) { plan = moved(plan, i, i - 1); renderChallenge(); } });
      el.querySelector("[data-down]")!.addEventListener("click", () => { if (i < plan.length - 1) { plan = moved(plan, i, i + 1); renderChallenge(); } });
    });
    $("lsp-rows").innerHTML = res.rows.map((r) => `<tr data-id="${r.id}"><td>${esc(name(base, r.id))}</td><td>${r.how === "spike" ? "a test" : "playing it all"}</td><td>${r.foundHour === null ? "-" : f(r.foundHour)}</td><td>${f(r.wasted)} h</td><td class="${r.foundOk && r.wastedOk ? "good" : "bad"}">${r.foundOk && r.wastedOk ? "ok" : !r.viaTest ? "not found by a test" : !r.foundOk ? "too late" : "too much lost"}</td></tr>`).join("");
    const okN = res.rows.filter((r) => r.foundOk && r.wastedOk).length;
    $("lsp-status").innerHTML = res.ok ? `<span class="good">Solved</span>` : `<span class="bad">Not yet: ${okN} of ${res.rows.length} fail points are covered</span>`;
    $("lsp-status").dataset.solved = res.ok ? "yes" : "no";
    $("lsp-money").innerHTML = `${res.problems.length ? `<span class="bad">${esc(res.problems[0])}.</span> ` : ""}Tests cost ${money(res.usd)} of ${money(b.usd)}: <span class="${res.usdOk ? "good" : "bad"}">${res.usdOk ? "ok" : "over"}</span>.`;
    const worst = res.rows.slice().sort((x, y) => (y.foundHour ?? 0) - (x.foundHour ?? 0) || y.wasted - x.wasted)[0];
    const o = evaluate(base, plan, worst.id);
    $("lsp-tl2").innerHTML = defs("hatch2") + timeline(base, plan, o, Math.max(o.total, 1) * 1.02, 24, `Your plan if "${name(base, worst.id)}" fails (the worst case)`, worst.id, "hatch2") + legend(108, "hatch2");
  }

  // ---- 4. not tested ----
  const have = new Set<string>();
  function renderNeeds() {
    $("lsp-needs").innerHTML = WALL_TEST_NEEDS.map((k) => `<label style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" data-k="${k}" ${have.has(k) ? "checked" : ""}> ${esc(WALL_TEST_LABELS[k])}</label>`).join("");
    $("lsp-needs").querySelectorAll<HTMLInputElement>("input").forEach((c) => c.addEventListener("change", () => { if (c.checked) have.add(c.dataset.k!); else have.delete(c.dataset.k!); renderVerdict(); }));
  }
  let samples = 36;
  function renderVerdict() {
    const passed = Number(($("lsp-pass") as HTMLInputElement).value), v = verdict([...WALL_TEST_NEEDS], [...have], passed, samples);
    $("lsp-pass-v").textContent = `${passed} of ${samples}`;
    $("lsp-verdict").innerHTML = v.status === "not tested" ? `<span class="bad">NOT TESTED</span>` : v.status === "failed" ? `<span class="bad">Failed</span>` : `<span class="good">Passed</span>`;
    $("lsp-vsays").textContent = v.status === "not tested" ? `Missing: ${v.missing.map((m) => WALL_TEST_LABELS[m as (typeof WALL_TEST_NEEDS)[number]]).join(", ")}. ${passed} of ${samples} says nothing about the idea. Build what is missing, then run it.` : v.status === "failed" ? "Every input was there, so this is a real fail of the idea in this form." : "At least one sample meets every pass line.";
  }
  const preset = (haveAll: boolean, n: number) => { have.clear(); if (haveAll) WALL_TEST_NEEDS.forEach((k) => have.add(k)); samples = n; ($("lsp-pass") as HTMLInputElement).value = "0"; ($("lsp-pass") as HTMLInputElement).max = String(n); renderNeeds(); renderVerdict(); };
  $("lsp-p1").addEventListener("click", () => preset(false, 36));
  $("lsp-p2").addEventListener("click", () => preset(true, 8));
  $("lsp-pass").addEventListener("input", renderVerdict);

  // ---- 5. the real story ----
  function renderStory() {
    const n = story.events.length;
    ($("lsp-ev") as HTMLInputElement).max = String(n - 1); ($("lsp-ev") as HTMLInputElement).value = String(evIdx);
    const t = storyTotals(story, evIdx), all = storyTotals(story, n - 1);
    $("lsp-ev-v").textContent = `${evIdx + 1} of ${n}`;
    $("lsp-story-says").innerHTML = `${esc(story.issue)}, <code>${esc(story.folder)}</code>. So far: ${money(t.usd)}, ${t.minutes} GPU minutes, ${t.free} free or not-run steps, ${t.paid} paid.`;
    $("lsp-events").innerHTML = story.events.map((e, i) => `<div class="ev ${i > evIdx ? "future" : i === evIdx ? "now" : ""}" data-i="${i}"><span class="chip ${e.kind === "not tested" ? "nt" : e.kind}">${e.kind === "not tested" ? "not tested" : e.kind === "free" ? "free" : "paid"}</span>
      <span><b>${esc(e.title)}</b><br>${esc(e.told)}<br><span class="small">Then: ${esc(e.decided)}</span></span><span class="small" style="text-align:right">${money(e.usd)}${e.minutes ? `<br>${e.minutes} min` : ""}</span></div>`).join("");
    $("lsp-end").innerHTML = evIdx === n - 1 ? `<b>${esc(story.ending)}</b>` : "";
    const px = (i: number) => 60 + i * ((W - 120) / Math.max(1, n - 1)), top = Math.max(all.usd, 0.01), py = (v: number) => 110 - (v / top) * 80;
    let cum = 0, svg = `<path d="M40 110H${W - 40}" stroke="${GREY}"/><text x="40" y="22" font-size="12" fill="${INK}">money spent so far (top = ${money(top)})</text>`, d = "";
    story.events.forEach((e, i) => {
      cum += e.usd; d += `${i ? "L" : "M"}${px(i)} ${py(cum)}`;
    });
    svg += `<path d="${d}" fill="none" stroke="${TEAL}" stroke-width="2.5" opacity=".5"/>`;
    cum = 0;
    story.events.forEach((e, i) => {
      cum += e.usd;
      const c = e.kind === "paid" ? ORANGE : e.kind === "not tested" ? GREY : TEAL;
      svg += `<circle cx="${px(i)}" cy="${py(cum)}" r="${i === evIdx ? 9 : 6}" fill="${i <= evIdx ? c : "#fff"}" stroke="${c}" stroke-width="2"/><text x="${px(i)}" y="132" font-size="11" text-anchor="middle" fill="${INK}">${i + 1}</text>`;
    });
    $("lsp-chart").innerHTML = svg;
  }

  // ---- wiring ----
  function setScenario(id: string) {
    base = SCENARIOS.find((s) => s.id === id)!; sc = cloneScenario(base); order = spikeOrder(sc); failing = DEFAULT_FAIL[base.id]; plan = latePlan(base);
    $("lsp-blurb").textContent = base.blurb;
    $("lsp-fail").innerHTML = base.risks.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join("") + `<option value="">Nothing fails</option>`;
    ($("lsp-fail") as HTMLSelectElement).value = failing ?? "";
    renderBoard(); recompute(); renderChallenge();
  }
  $("lsp-sc").innerHTML = SCENARIOS.map((s) => `<option value="${s.id}">${esc(s.title)}</option>`).join("");
  $("lsp-sc").addEventListener("change", () => setScenario(($("lsp-sc") as HTMLSelectElement).value));
  $("lsp-fail").addEventListener("change", () => { failing = ($("lsp-fail") as HTMLSelectElement).value || null; recompute(); });
  $("lsp-sort").addEventListener("click", () => { order = spikeOrder(sc); renderBoard(); recompute(); });
  $("lsp-reset").addEventListener("click", () => { plan = latePlan(base); renderChallenge(); });
  $("lsp-show").addEventListener("click", () => { plan = referencePlan(base); renderChallenge(); });
  $("lsp-story").innerHTML = STORIES.map((s) => `<option value="${s.id}">${esc(s.title)} (${esc(s.issue)})</option>`).join("");
  $("lsp-story").addEventListener("change", () => { story = STORIES.find((s) => s.id === ($("lsp-story") as HTMLSelectElement).value)!; evIdx = story.events.length - 1; renderStory(); });
  $("lsp-ev").addEventListener("input", () => { evIdx = Number(($("lsp-ev") as HTMLInputElement).value); renderStory(); });
  $("lsp-eq-btn").addEventListener("click", () => {
    const e = $("lsp-eq"); e.hidden = !e.hidden;
    e.textContent = `scare_i = (p_i / 100) x W_i
   p_i  chance risk i fails, in percent
   W_i  hours of build on risk i and on everything built on it
Test at the hour h_i = (hours of every step up to and including test i).
Work thrown away = hours of every built step that sits on the failing risk and was built before it was found.
Whole project T = (all steps) + play + thrown away + fallback.
Average extra = sum over i of (p_i / 100) x (thrown away_i + fallback_i).
A test counts only when every test it needs ran before it. Otherwise: not tested.
Challenge: for every i, found by a test, h_i <= limit, thrown away_i <= limit, and the sum of test money <= limit.`;
  });

  setScenario("bars");
  preset(false, 36);
  renderStory();
  labPopulated("lab-spike");
  return { backend: "canvas2d" };
}
