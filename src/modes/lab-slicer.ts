import { mountLabsNav } from "../ui/labs-nav";
import { labsOn } from "../ui/labs";
import { labDefaultNote, labPopulated } from "../ui/lab-default";
import { laneToCourse } from "../slice/slice";
import type { DefaultsFile, SlicerDefault } from "../slice/slicer-default";
import {
  CHALLENGES, DEFAULTS_URL, GAME_LIMITS, INDEX_URL, LEVELS, OSM_CREDIT, PLACE_URL, analyse, countLevels, levelsOf, judge, looksOk, openKnobs, placeOf, reachOf, ruleRows, startKnobs,
  type Analysis, type Challenge, type IndexEntry, type Knobs, type Limits, type PlaceData, type Tried,
} from "../labs/slicer/slicer-lab-core";

// World Slicer: map to lane. A pin on a recorded OpenStreetMap area becomes a lane the simulator proves. Every picture is the game's own Slicer code run on recorded data
// (public/assets/places/*.json); nothing is fetched from the internet and no street photo is shown. Behind the labs switch (?labs=1).
const INK = "#17201d", TEAL = "#0f6b5c", ORANGE = "#d9741a", GREY = "#9aa5a0", RED = "#b91c1c", BLUE = "#5b7fa6";
const MW = 760, MH = 520, SW = 800, SH = 250;
const STEPS = [
  { id: 1, name: "Pin and circle", does: "Drop a pin and draw a circle. Only buildings inside the circle count." },
  { id: 2, name: "Elements found", does: "Blue buildings have a height tag. Grey ones have none, so the game guesses 9 m." },
  { id: 3, name: "Cut", does: "Slice at one height. Orange roofs reach the cut; the rest are below it." },
  { id: 4, name: "Lane", does: "A 2 m wide line across the orange roofs. Drag its ends." },
  { id: 5, name: "Rules", does: "The side view shows the roofs on the line. Gaps, steps and falls are checked." },
  { id: 6, name: "Simulator", does: "The simulator tries the lane. Step the run to see where the runner goes." },
];

export function startLabSlicer(host: HTMLElement): { backend: "canvas2d" } {
  const root = document.createElement("div");
  root.id = "lab-slicer";
  root.style.cssText = `position:fixed;inset:0;overflow:auto;background:#f5f7f4;color:${INK};font:15px/1.4 system-ui,sans-serif`;
  host.append(root);
  mountLabsNav(host, "lab-slicer");
  if (!labsOn()) {
    root.innerHTML = `<div style="max-width:520px;margin:12vh auto;padding:0 16px"><h1 style="font-size:22px">World Slicer</h1><p>Labs are switched off.</p><p><a href="?mode=lab-slicer&labs=1" style="color:${TEAL}">Switch labs on</a></p></div>`;
    return { backend: "canvas2d" };
  }
  const style = document.createElement("style");
  style.textContent = `
    #lab-slicer .wrap{max-width:1200px;margin:0 auto;padding:16px;display:grid;gap:14px}
    #lab-slicer h1{font-size:22px;margin:0}#lab-slicer h2{font-size:15px;margin:0 0 6px}
    #lab-slicer .grid{display:grid;grid-template-columns:300px minmax(0,1fr);gap:14px;align-items:start}
    #lab-slicer .card{background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:12px}
    #lab-slicer label{display:grid;gap:2px;margin:8px 0}#lab-slicer label.tick{display:flex;gap:6px;align-items:center}
    #lab-slicer input[type=range]{width:100%}
    #lab-slicer select{font:14px system-ui;padding:6px;border:1px solid #b9c4bb;border-radius:8px}
    #lab-slicer canvas{width:100%;height:auto;display:block;border-radius:6px;background:#eef3ee}
    #lab-slicer .small{color:#52605a;font-size:13px}
    #lab-slicer .steps{display:flex;flex-wrap:wrap;gap:6px}
    #lab-slicer button{font:600 13px system-ui;padding:6px 9px;border:1px solid #b9c4bb;border-radius:8px;background:#fff;color:${INK};cursor:pointer}
    #lab-slicer .steps button[aria-pressed=true]{border-color:${TEAL};background:#e6f2ee}
    #lab-slicer table{border-collapse:collapse;width:100%;font-size:13px}#lab-slicer th,#lab-slicer td{text-align:left;padding:3px 8px 3px 0;border-bottom:1px solid #e3e8e4}
    #lab-slicer .go{font:700 14px system-ui;padding:8px 12px;border:0;border-radius:8px;background:${TEAL};color:#fff}
    #lab-slicer a.back{color:${TEAL};font-weight:600}
    #lab-slicer .good{color:${TEAL};font-weight:700}#lab-slicer .bad{color:${RED};font-weight:700}
    #lab-slicer .chals{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    #lab-slicer .chal{border:1px solid #d5ddd6;border-radius:8px;padding:10px;display:grid;gap:6px;align-content:start}
    #lab-slicer .chal.on{border-color:${TEAL};background:#f1f8f5}
    #lab-slicer .sw{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-1px;margin-right:4px}
    #lab-slicer .pl{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:6px;max-height:210px;overflow:auto;padding:2px}
    #lab-slicer .pl button{display:grid;gap:3px;text-align:left;padding:6px 8px}
    #lab-slicer .pl button[aria-pressed=true]{border-color:${TEAL};background:#e6f2ee}
    #lab-slicer .pl .nm{font-weight:700}#lab-slicer .pl .ct{font-weight:400;color:#52605a;font-size:12px}
    #lab-slicer .bdg{display:inline-block;font:700 11px system-ui;padding:1px 6px;border-radius:9px;margin-right:4px;white-space:nowrap}
    #lab-slicer .bdg.ready{background:#d7efe3;color:#0b5a3e}#lab-slicer .bdg.nolane{background:#fbe3c8;color:#8a4a06}
    #lab-slicer .bdg.nophotos{background:#e4e7ea;color:#3d4650}#lab-slicer .bdg.small{background:#dfe8f6;color:#2a4a7c}
    #lab-slicer progress{width:100%;height:10px}
    #lab-slicer [hidden]{display:none !important}
  `;
  root.append(style);
  const wrap = document.createElement("div"); wrap.className = "wrap"; root.append(wrap);
  wrap.innerHTML = `
    <div><a class="back" href="/?welcome=0">Back to the game</a>
    <h1>World Slicer: map to lane</h1>
    <p class="small" style="margin:2px 0 0">Drop a pin on a real map. Slice the buildings at one height. A lane appears, and the simulator tries it. Drag, tick, and watch what changes. The long story is in <code>docs/labs/slicer.md</code>.</p></div>
    <div class="card"><h2>Pick a place <span class="small" id="sl-place-n"></span></h2>
      <p class="small" id="sl-legend" style="margin:0 0 6px"></p>
      <div class="pl" id="sl-places" role="group" aria-label="Recorded places"></div>
      <p class="small" style="margin:6px 0 0">A place's buildings are fetched only when you pick it.</p></div>
    <div class="grid">
      <div style="display:grid;gap:14px">
        <div class="card"><h2>Steps</h2><div class="steps" id="sl-steps"></div>
          <p class="small" id="sl-does" style="margin:8px 0 0"></p></div>
        <div class="card"><h2>Turn these</h2>
          <p class="small" style="margin:0">Place: <b id="sl-place-name"></b>. Pick another in the list above the map.</p>
          <label>Circle radius: <b id="sl-r-v"></b><input id="sl-r" type="range" min="20" max="160" step="5"></label>
          <p class="small" style="margin:0">Drag the red pin on the map to move the circle.</p>
          <label class="tick"><input id="sl-real" type="checkbox"> Count only buildings with a height tag</label>
          <label class="tick"><input id="sl-hills" type="checkbox" checked> Real hills under the buildings</label>
          <label>Shrink: <b id="sl-k-v"></b><input id="sl-k" type="range" min="0.1" max="0.6" step="0.01"></label>
          <label>Cut height: <b id="sl-cut-v"></b><input id="sl-cut" type="range" min="0" max="100" step="0.5"></label>
          <button id="sl-reset">Back to our setting</button></div>
        <div class="card"><h2>What was left out</h2><div id="sl-left"></div></div>
      </div>
      <div style="display:grid;gap:14px;min-width:0">
        <div class="card"><canvas id="sl-map" width="${MW}" height="${MH}" aria-label="Map of the recorded buildings with the pin, the circle and the lane"></canvas>
          <p class="small" style="margin:6px 0 0"><span class="sw" style="background:${BLUE}"></span>height tag <span class="sw" style="background:${GREY}"></span>guessed 9 m <span class="sw" style="background:${ORANGE}"></span>reaches the cut <span class="sw" style="background:${TEAL}"></span>the lane. Map data ${OSM_CREDIT}, recorded.</p></div>
        <div class="card"><h2>Side view of the lane, and the run</h2>
          <canvas id="sl-side" width="${SW}" height="${SH}"></canvas>
          <label>Step of the run: <b id="sl-tick-v"></b><input id="sl-tick" type="range" min="0" max="1" step="1"></label>
          <p id="sl-verdict" style="margin:4px 0 0;font-weight:700"></p>
          <progress id="sl-prog" hidden></progress><p class="small" id="sl-prog-t" style="margin:2px 0 0"></p></div>
      </div>
    </div>
    <div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">
      <div class="card"><h2>The rules, and what the quick look says</h2>
        <table><thead><tr><th>Rule</th><th>This lane</th><th>Limit</th><th></th></tr></thead><tbody id="sl-rules"></tbody></table>
        <p class="small" style="margin:6px 0 0">What if the runner could do more? These limits are only for the quick look. The simulator ignores them.</p>
        <label>Gap limit: <b id="sl-lg-v"></b><input id="sl-lg" type="range" min="2" max="16" step="0.5"></label>
        <label>Climb limit: <b id="sl-lc-v"></b><input id="sl-lc" type="range" min="0.5" max="8" step="0.1"></label>
        <label>Fall limit: <b id="sl-lf-v"></b><input id="sl-lf" type="range" min="0.5" max="12" step="0.1"></label>
        <p id="sl-look" style="margin:4px 0 0"></p></div>
      <div class="card"><h2>Photos at the lane</h2>
        <p class="small" style="margin:0">Street photos are not shown here. In the game they come live from Mapillary, under its terms, and are never stored. People are blurred and faces and plates masked before any model sees a photo.</p>
        <p class="small"><a href="?mode=lab-lift&labs=1&welcome=0" style="color:${TEAL}">Cut-out, lift and bake</a> follows a photo into the game; <a href="?mode=lab-vision&labs=1&welcome=0" style="color:${TEAL}">Computer vision</a> shows how people are found and hidden.</p></div>
    </div>
    <div class="card"><h2>Four design challenges</h2><div class="chals" id="sl-chals"></div></div>`;
  const $ = <T extends HTMLElement>(id: string): T => wrap.querySelector("#" + id) as T;
  labDefaultNote(wrap, "live", wrap.querySelector("p.small") as HTMLElement | null);

  const places = new Map<string, PlaceData>();
  let defaults: DefaultsFile | null = null;
  let place!: PlaceData, k!: Knobs, a: Analysis | null = null, tried: Tried | null = null, step = 6, limits: Limits = { ...GAME_LIMITS }, tick = 0;
  let chal: Challenge | null = null, answer: string | undefined, timer = 0, token = 0;
  void token;
  const f1 = (v: number) => (Math.round(v * 10) / 10).toString();
  const ringPath = (g: CanvasRenderingContext2D, ring: [number, number][], T: (x: number, z: number) => [number, number]) => { g.beginPath(); ring.forEach((p, i) => { const [x, y] = T(p[0], p[1]); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); };

  // ---- the map ----
  let span = 160;
  const T = (x: number, z: number): [number, number] => [MW / 2 + (x * (MH - 20)) / (2 * span), MH / 2 + (z * (MH - 20)) / (2 * span)];
  const unT = (px: number, py: number): [number, number] => [((px - MW / 2) * 2 * span) / (MH - 20), ((py - MH / 2) * 2 * span) / (MH - 20)];
  function drawMap() {
    if (!a) return;
    const g = $<HTMLCanvasElement>("sl-map").getContext("2d")!;
    g.clearRect(0, 0, MW, MH);
    for (const t of a.tops) {
      ringPath(g, t.ring, T);
      const out = t.state === "outside", sure = t.real;
      if (step === 1 || out) { g.fillStyle = out && step > 1 ? "#f0f3f0" : "#dfe6e0"; g.fill(); g.strokeStyle = "#c3cdc5"; g.lineWidth = 1; g.stroke(); continue; }
      if (t.state === "guessed") { g.fillStyle = "#f4f6f4"; g.fill(); g.setLineDash([3, 3]); g.strokeStyle = GREY; g.lineWidth = 1; g.stroke(); g.setLineDash([]); continue; }
      if (step >= 3) {
        if (t.state === "kept") { g.fillStyle = ORANGE; g.fill(); g.strokeStyle = "#8f4a0e"; g.lineWidth = 1; g.stroke(); } else { g.fillStyle = "#f4ece3"; g.fill(); g.strokeStyle = "#d9c3ab"; g.lineWidth = 1; g.stroke(); }
      } else { g.fillStyle = sure ? BLUE : GREY; g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 0.8; g.stroke(); }
    }
    const [cx, cy] = T(k.pin[0], k.pin[1]), rr = (k.radiusM * (MH - 20)) / (2 * span);
    g.beginPath(); g.arc(cx, cy, rr, 0, 7); g.setLineDash([8, 6]); g.strokeStyle = TEAL; g.lineWidth = 2.5; g.stroke(); g.setLineDash([]);
    if (step >= 4) {
      const [x0, y0] = T(k.line[0], k.line[1]), [x1, y1] = T(k.line[2], k.line[3]);
      g.strokeStyle = "#fff"; g.lineWidth = 9; g.lineCap = "round"; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = TEAL; g.lineWidth = 5; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      for (const [x, y] of [[x0, y0], [x1, y1]]) { g.beginPath(); g.arc(x, y, 8, 0, 7); g.fillStyle = "#fff"; g.fill(); g.strokeStyle = TEAL; g.lineWidth = 3; g.stroke(); }
    }
    g.beginPath(); g.arc(cx, cy, 8, 0, 7); g.fillStyle = RED; g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 2; g.stroke();
    g.fillStyle = INK; g.font = "600 12px system-ui"; g.textAlign = "left"; g.fillText(OSM_CREDIT, 8, MH - 8);
    g.textAlign = "right"; g.fillText(`${place.name}: ${a.counts.found} buildings recorded, ${a.counts.kept} reach the cut`, MW - 8, 18);
  }

  // ---- the side view ----
  function drawSide() {
    const g = $<HTMLCanvasElement>("sl-side").getContext("2d")!;
    g.clearRect(0, 0, SW, SH);
    if (!a) return;
    let course = tried?.course ?? null;
    if (!course && a.cells.length >= 8) course = laneToCourse({ cells: a.cells, length: a.lengthM, origin: a.origin });
    if (!course) { g.fillStyle = INK; g.font = "600 15px system-ui"; g.textAlign = "center"; g.fillText(`No lane: only ${f1(a.lengthM)} m of roofs under the line at this cut.`, SW / 2, SH / 2); return; }
    const ps = course.terrain.platforms, x0 = -4, x1 = course.finishX + 6;
    let lo = Infinity, hi = -Infinity;
    for (const p of ps) for (const y of [p.top, ...(p.profile ?? []).map((q) => q[1])]) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
    lo = Math.min(lo, 0) - 2; hi = Math.max(hi, 2) + 3;
    const sc = Math.min((SW - 24) / (x1 - x0), (SH - 24) / (hi - lo)), px = (x: number) => 12 + (x - x0) * sc, py = (y: number) => SH - 12 - (y - lo) * sc;
    g.fillStyle = "#dbe8f1"; g.fillRect(0, py(course.terrain.waterY), SW, SH);
    g.fillStyle = INK; g.font = "600 12px system-ui"; g.textAlign = "left"; g.fillText("water", 8, SH - 6);
    for (const p of ps) {
      g.beginPath(); g.moveTo(px(p.x0), py(lo));
      if (p.profile) for (const [x, y] of p.profile) g.lineTo(px(x), py(y)); else { g.lineTo(px(p.x0), py(p.top)); g.lineTo(px(p.x1), py(p.top)); }
      g.lineTo(px(p.x1), py(lo)); g.closePath(); g.fillStyle = ORANGE; g.fill(); g.strokeStyle = "#8f4a0e"; g.lineWidth = 1.5; g.stroke();
    }
    if (tried && tried.xs.length) {
      g.beginPath(); tried.xs.forEach((x, i) => { const X = px(x), Y = py(tried!.ys[i] + 0.9); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.strokeStyle = TEAL; g.lineWidth = 2; g.stroke();
      const i = Math.min(tick, tried.xs.length - 1);
      g.beginPath(); g.arc(px(tried.xs[i]), py(tried.ys[i] + 0.9), 6, 0, 7); g.fillStyle = tried.cleared ? TEAL : RED; g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 2; g.stroke();
    }
    g.beginPath(); g.moveTo(px(course.finishX), py(lo)); g.lineTo(px(course.finishX), py(hi)); g.setLineDash([4, 4]); g.strokeStyle = INK; g.lineWidth = 1; g.stroke(); g.setLineDash([]);
    g.fillStyle = INK; g.textAlign = "right"; g.fillText("finish", px(course.finishX) - 4, 16);
  }

  // ---- text ----
  function drawText() {
    if (!a) return;
    $("sl-r-v").textContent = `${k.radiusM} m`; $("sl-k-v").textContent = f1(k.shrink * 100) + "%"; $("sl-cut-v").textContent = `${f1(k.cutM)} m`;
    ($("sl-r") as HTMLInputElement).value = String(k.radiusM); ($("sl-k") as HTMLInputElement).value = String(k.shrink); ($("sl-cut") as HTMLInputElement).value = String(k.cutM);
    ($("sl-cut") as HTMLInputElement).max = String(Math.max(10, a.range));
    ($("sl-real") as HTMLInputElement).checked = k.realOnly; ($("sl-hills") as HTMLInputElement).checked = k.hills;
    $("sl-left").innerHTML = `<table><tbody>
      <tr><td>Recorded in the area</td><td><b>${a.counts.found}</b></td></tr>
      <tr><td>Outside your circle</td><td><b>${a.counts.outside}</b></td></tr>
      <tr><td>No height tag, left out</td><td><b>${a.counts.guessed}</b></td></tr>
      <tr><td>Below the cut</td><td><b>${a.counts.below}</b></td></tr>
      <tr><td>Reach the cut (orange)</td><td><b>${a.counts.kept}</b></td></tr></tbody></table>
      <p class="small" style="margin:6px 0 0">${a.counts.real} of ${a.counts.found} have a height tag.</p>`;
    $("sl-rules").innerHTML = ruleRows(a.facts, limits).map((r) => `<tr><td>${r.name}</td><td><b>${r.value}</b></td><td>${r.limit}</td><td class="${r.ok ? "good" : "bad"}">${r.ok ? "ok" : "no"}</td></tr>`).join("");
    $("sl-lg-v").textContent = `${f1(limits.gap)} m`; $("sl-lc-v").textContent = `${f1(limits.climb)} m`; $("sl-lf-v").textContent = `${f1(limits.fall)} m`;
    $("sl-look").innerHTML = `Quick look: <b class="${looksOk(a.facts, limits) ? "good" : "bad"}">${looksOk(a.facts, limits) ? "looks crossable" : "does not look crossable"}</b>. ${a.why.lines.length && !a.proved ? a.why.lines.join(" ") : ""}`;
    $("sl-does").textContent = STEPS[step - 1].does;
        $("sl-verdict").innerHTML = busy ? (recorded ? recordedLine() : "Asking the simulator...") : a.proved
      ? `<span class="good">Simulator: clears.</span> ${f1(a.lengthM)} m lane${tried?.clearS ? `, an ideal run takes ${tried.clearS} s` : ""}. The quick look says ${a.quick ? "yes" : "no"}: the simulator has the last word.`
      : `<span class="bad">Simulator: no run clears this lane.</span> ${a.lengthM < 8 ? "The lane is too short." : a.why.lines[0] ?? ""}`;
    const tt = $<HTMLInputElement>("sl-tick"); tt.max = String(Math.max(1, (tried?.xs.length ?? 1) - 1)); tt.value = String(Math.min(tick, Number(tt.max))); $("sl-tick-v").textContent = tried ? `${tt.value} of ${tt.max}` : "no run";
    wrap.querySelectorAll<HTMLButtonElement>("#sl-steps button").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.step) === step)));
  }
  const redraw = () => { drawText(); drawMap(); drawSide(); };

  // ---- compute: a quick pass while dragging, the simulator after a pause ----
  let busy = false, recorded = false, worker: Worker | null = null, askId = 0, t0 = 0, progTimer = 0, index: IndexEntry[] = [];
  const dOf = (): SlicerDefault | undefined => defaults?.places.find((x) => x.slug === place.slug);
  /** True while the knobs are still the stored, proved setting: the recorded run is then shown at once, labelled, while the live search runs. */
  const sameAsStored = (): boolean => { const d = dOf(); return !!d && JSON.stringify(openKnobs(place, d)) === JSON.stringify(k); };
  const recordedLine = (): string => { const d = dOf()!; return `<span class="good">Recorded run: ${d.clear ? "clears" : "does not clear"}.</span> ${f1(d.lengthM)} m lane${d.clearS ? `, an ideal run takes ${d.clearS} s` : ""}. Proved ahead of time; the live search is running now.`; };
  function stopProgress() { window.clearInterval(progTimer); $("sl-prog").hidden = true; $("sl-prog-t").textContent = ""; }
  function recompute(now: boolean) {
    window.clearTimeout(timer);
    token++;
    a = analyse(place, k, { prove: false }); tried = null; tick = 0; busy = true; recorded = sameAsStored();
    redraw();
    timer = window.setTimeout(ask, now ? 0 : 450);
  }
  /** The simulator's search runs in a worker, so a big place never freezes the page; a bar shows how long it has run. */
  function ask() {
    if (worker) { worker.terminate(); worker = null; } // a newer setting replaces a search still running
    const id = ++askId; t0 = performance.now();
    const w = (worker = new Worker(new URL("../labs/slicer/worker.ts", import.meta.url), { type: "module" }));
    w.onmessage = (e: MessageEvent) => {
      if (e.data.id !== askId) return;
      stopProgress(); a = e.data.a as Analysis; tried = e.data.tried as Tried | null;
      if (tried) tick = tried.xs.length - 1;
      busy = false; recorded = false; redraw(); labPopulated("lab-slicer");
    };
    w.onerror = (e) => { stopProgress(); busy = false; $("sl-verdict").innerHTML = `<span class="bad">The search stopped: ${e.message}</span>`; };
    $("sl-prog").hidden = false;
    window.clearInterval(progTimer);
    progTimer = window.setInterval(() => { $("sl-prog-t").textContent = `The simulator is searching: ${((performance.now() - t0) / 1000).toFixed(1)} s. Big places take longer.`; }, 200);
    w.postMessage({ id, place, knobs: k });
  }

  // ---- challenges ----
  function paintChals() {
    $("sl-chals").innerHTML = CHALLENGES.map((c) => `<div class="chal ${chal?.id === c.id ? "on" : ""}" id="sl-ch-${c.id}"><b>${c.title}</b><span class="small">${c.task}</span>
      <button data-start="${c.id}">${chal?.id === c.id ? "Start again" : "Start"}</button>
      ${chal?.id === c.id ? `${c.kind === "reason" ? `<select data-ans="${c.id}"><option value="">What stops the runner?</option><option value="short">The lane is too short</option><option value="gap">A gap is too wide</option><option value="wall">A wall is too tall</option><option value="drop">A fall is too deep</option></select>` : ""}
      <button data-check="${c.id}">Check</button><div class="small" id="sl-res-${c.id}" role="status"></div><button data-reveal="${c.id}">Show what we did</button><div class="small" id="sl-rev-${c.id}" hidden>${c.reveal}</div>` : ""}</div>`).join("");
  }
    function check(c: Challenge) {
    const res = wrap.querySelector<HTMLElement>(`#sl-res-${c.id}`)!;
    if (!a) return;
    if (busy) { res.textContent = "Wait for the simulator to finish."; return; }
    const v = judge(c, a, answer as never);
    res.innerHTML = `<span class="${v.pass ? "good" : "bad"}">${v.pass ? "Pass." : "Not yet."}</span> ${v.text}`;
  }

  // ---- events ----
  async function load(slug: string) {
    const entry = index.find((p) => p.slug === slug);
    $("sl-place-name").textContent = `${entry?.name ?? slug} (loading its buildings...)`;
    if (!places.has(slug)) places.set(slug, placeOf(await (await fetch(PLACE_URL(slug))).json()));
    place = places.get(slug)!;
    const d = defaults!.places.find((x) => x.slug === slug);
    if (!d) { $("sl-place-name").textContent = `${place.name} (no stored lane to start from)`; return; }
    k = chal && chal.slug === slug ? startKnobs(chal, place, d) : openKnobs(place, d);
    span = Math.max(80, reachOf(place) + 20);
    ($("sl-r") as HTMLInputElement).max = String(reachOf(place));
    $("sl-place-name").textContent = place.name;
    wrap.querySelectorAll<HTMLButtonElement>("#sl-places button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.slug === slug)));
    recompute(true);
  }
  const reset = () => { chal = null; paintChals(); void load(place.slug); };
  (async () => {
    defaults = await (await fetch(DEFAULTS_URL)).json();
    index = (await (await fetch(INDEX_URL)).json()) as IndexEntry[];
    const c = countLevels(index), main = (p: IndexEntry) => LEVELS.findIndex((l) => l.id === levelsOf(p)[0]);
    $("sl-place-n").textContent = `${index.length} recorded places`;
    $("sl-legend").innerHTML = LEVELS.map((l) => `<span class="bdg ${l.id}" title="${l.tip}">${l.label}: ${c[l.id]}</span>`).join("");
    $("sl-places").innerHTML = [...index].sort((x, y) => main(x) - main(y)).map((p) => {
      const cut = p.name.lastIndexOf(","), nm = cut > 0 ? p.name.slice(0, cut) : p.name, city = cut > 0 ? p.name.slice(cut + 1).trim() : p.country ?? "";
      const bd = levelsOf(p).map((l) => { const L = LEVELS.find((x) => x.id === l)!; return `<span class="bdg ${l}" title="${L.tip}">${L.label}</span>`; }).join("");
      return `<button type="button" data-slug="${p.slug}" aria-pressed="false"><span class="nm">${nm}</span><span class="ct">${[city, p.country && p.country !== city ? p.country : ""].filter(Boolean).join(", ")}${p.buildings ? `, ${p.buildings} buildings` : ""}${p.bytes ? `, ${Math.round(p.bytes / 1000)} KB` : ""}</span><span>${bd}</span></button>`;
    }).join("");
    $("sl-steps").innerHTML = STEPS.map((s) => `<button data-step="${s.id}" aria-pressed="false">${s.id}. ${s.name}</button>`).join("");
    paintChals();
    await load(index.some((p) => p.slug === "eixample-barcelona") ? "eixample-barcelona" : index[0].slug);
  })().catch((e) => { wrap.insertAdjacentHTML("afterbegin", `<p class="bad">Could not load the recorded places: ${String(e)}</p>`); });

  $("sl-steps").addEventListener("click", (e) => { const b = (e.target as HTMLElement).closest("button"); if (b) { step = Number(b.dataset.step); redraw(); } });
  $("sl-places").addEventListener("click", (e) => { const b = (e.target as HTMLElement).closest("button"); if (b?.dataset.slug) { chal = null; paintChals(); void load(b.dataset.slug); } });
  $("sl-r").addEventListener("input", () => { k = { ...k, radiusM: Number(($("sl-r") as HTMLInputElement).value) }; recompute(false); });
  $("sl-k").addEventListener("input", () => { k = { ...k, shrink: Number(($("sl-k") as HTMLInputElement).value) }; recompute(false); });
  $("sl-cut").addEventListener("input", () => { k = { ...k, cutM: Number(($("sl-cut") as HTMLInputElement).value) }; recompute(false); });
  $("sl-real").addEventListener("change", () => { k = { ...k, realOnly: ($("sl-real") as HTMLInputElement).checked }; recompute(false); });
  $("sl-hills").addEventListener("change", () => { k = { ...k, hills: ($("sl-hills") as HTMLInputElement).checked }; recompute(false); });
  $("sl-reset").addEventListener("click", reset);
  $("sl-tick").addEventListener("input", () => { tick = Number(($("sl-tick") as HTMLInputElement).value); redraw(); });
  for (const [id, key] of [["sl-lg", "gap"], ["sl-lc", "climb"], ["sl-lf", "fall"]] as const) {
    const el = $<HTMLInputElement>(id); el.value = String(limits[key]);
    el.addEventListener("input", () => { limits = { ...limits, [key]: Number(el.value) }; redraw(); });
  }
  $("sl-chals").addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.start) { chal = CHALLENGES.find((c) => c.id === t.dataset.start)!; answer = undefined; paintChals(); void load(chal.slug); }
    else if (t.dataset.check) check(chal!);
    else if (t.dataset.reveal) $(`sl-rev-${t.dataset.reveal}`).hidden = false;
  });
  $("sl-chals").addEventListener("change", (e) => { const t = e.target as HTMLSelectElement; if (t.dataset.ans !== undefined) answer = t.value || undefined; });

  // dragging on the map: the pin moves the circle; the lane's two ends move the line (the lane is the real Slicer's own custom line)
  let drag: "pin" | "a" | "b" | null = null;
  const cv = $<HTMLCanvasElement>("sl-map");
  const at = (ev: PointerEvent): [number, number] => { const r = cv.getBoundingClientRect(); return [((ev.clientX - r.left) * MW) / r.width, ((ev.clientY - r.top) * MH) / r.height]; };
  cv.addEventListener("pointerdown", (ev) => {
    const [x, y] = at(ev), near = (wx: number, wz: number) => { const [px, py] = T(wx, wz); return Math.hypot(px - x, py - y) < 16; };
    drag = step >= 4 && near(k.line[0], k.line[1]) ? "a" : step >= 4 && near(k.line[2], k.line[3]) ? "b" : near(k.pin[0], k.pin[1]) ? "pin" : null;
    if (drag) cv.setPointerCapture(ev.pointerId);
  });
  cv.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const [wx, wz] = unT(...at(ev)), r1 = (v: number) => Math.round(v * 10) / 10;
    if (drag === "pin") k = { ...k, pin: [r1(wx), r1(wz)] };
    else if (drag === "a") k = { ...k, line: [r1(wx), r1(wz), k.line[2], k.line[3]] };
    else k = { ...k, line: [k.line[0], k.line[1], r1(wx), r1(wz)] };
    recompute(false);
  });
  cv.addEventListener("pointerup", () => { drag = null; });
  return { backend: "canvas2d" };
}
