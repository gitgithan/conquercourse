import { mountLabsNav, labHref } from "../ui/labs-nav";
import { labName } from "../ui/labs-series";
import { labsOn } from "../ui/labs";
import { labDefaultNote, labPopulated } from "../ui/lab-default";
import {
  ASSUME, DEFAULT_SEARCH, DEFAULT_WAIT, REAL, WARMS, challenges, clampSearch, simulateSearch, simulateWait, unpack,
  type RecCourse, type Search, type SearchCfg, type Warm, type WaitCfg, type WaitOut,
} from "../labs/wait/core";

// Hide the wait. Slow work (the simulator search, a Modal cold start) runs on a compute lane; what the person sees runs on a UX lane.
// The search jobs are the REAL search's (recorded by scripts/lab-wait-record.ts); the scheduler and the timeline are src/labs/wait/core.ts. Nothing here talks or grades.
// Equations come last, behind a button (labs may show equations). Behind the labs switch (?labs=1).
const INK = "#17201d", TEAL = "#0f6b5c", GREY = "#9aa5a0", RED = "#b91c1c", AMBER = "#b45309";
const W = 1100, LH = 64, TOP = 26, H = TOP + 2 * LH + 52, FH = 150;
const KIND_COL: Record<string, string> = { wake: "#e0a458", mask: "#4f9d8c", lift: "#5b7fa6", search: "#8a6fb3" };
const UX_COL = { dead: "#e8b4b0", told: "#f1d9a0", useful: "#9fd3b8" };
const UX_NAME = { dead: "Nothing to see or do", told: "Only told it is working", useful: "Something useful" };
const s1 = (x: number): string => (Math.round(x * 10) / 10).toString();
const ms = (x: number): string => (x >= 10000 ? `${s1(x / 1000)} s` : x >= 1000 ? `${s1(x / 1000)} s` : `${Math.round(x)} ms`);

export function startLabWait(host: HTMLElement): { backend: "canvas2d" } {
  const root = document.createElement("div");
  root.id = "lab-wait";
  root.style.cssText = `position:fixed;inset:0;overflow:auto;background:#f5f7f4;color:${INK};font:15px/1.4 system-ui,sans-serif`;
  host.append(root);
  mountLabsNav(host, "lab-wait");
  const title = labName("lab-wait");
  if (!labsOn()) {
    root.innerHTML = `<div style="max-width:520px;margin:12vh auto;padding:0 16px"><h1 style="font-size:22px">${title}</h1><p>Labs are switched off.</p><p><a href="?mode=lab-wait&labs=1" style="color:${TEAL}">Switch labs on</a></p></div>`;
    return { backend: "canvas2d" };
  }
  const style = document.createElement("style");
  style.textContent = `
    #lab-wait .wrap{max-width:1200px;margin:0 auto;padding:16px;display:grid;gap:14px}
    #lab-wait h1{font-size:22px;margin:0}#lab-wait h2{font-size:15px;margin:0 0 6px}
    #lab-wait .grid{display:grid;grid-template-columns:310px minmax(0,1fr);gap:14px;align-items:start}
    #lab-wait .card{background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:12px}
    #lab-wait label{display:grid;gap:2px;margin:8px 0}#lab-wait label.chk{display:flex;gap:8px;align-items:center;margin:6px 0}
    #lab-wait input[type=range]{width:100%}#lab-wait select{font:14px system-ui;padding:6px;border:1px solid #b9c4bb;border-radius:8px}
    #lab-wait canvas{width:100%;height:auto;display:block;border-radius:6px;background:#f7faf7}
    #lab-wait .small{color:#52605a;font-size:13px}
    #lab-wait .tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
    #lab-wait .tile{border:1px solid #d5ddd6;border-radius:8px;padding:8px 10px;background:#fbfdfb}
    #lab-wait .tile b{display:block;font-size:20px}#lab-wait .tile span{font-size:12px;color:#52605a}
    #lab-wait .tile.bad b{color:${RED}}#lab-wait .tile.good b{color:${TEAL}}
    #lab-wait .ch{display:grid;grid-template-columns:auto 1fr auto;gap:4px 10px;align-items:baseline}
    #lab-wait .pill{font:700 12px system-ui;padding:2px 8px;border-radius:99px;border:1px solid}
    #lab-wait .pill.pass{color:${TEAL};border-color:${TEAL};background:#e6f2ee}#lab-wait .pill.fail{color:${RED};border-color:${RED};background:#fdecec}
    #lab-wait table{border-collapse:collapse;width:100%;font-size:13px}#lab-wait th,#lab-wait td{text-align:left;padding:3px 8px 3px 0;border-bottom:1px solid #e3e8e4;vertical-align:top}
    #lab-wait .go,#lab-wait .preset{font:700 14px system-ui;padding:8px 12px;border:1px solid ${TEAL};border-radius:8px;background:${TEAL};color:#fff;cursor:pointer}
    #lab-wait .preset{background:#fff;color:${TEAL};margin:0 6px 6px 0}
    #lab-wait .preset[aria-pressed=true]{background:#e6f2ee}
    #lab-wait .eq{font:14px/1.6 ui-monospace,Menlo,monospace;background:#f1f4f1;border-radius:8px;padding:8px 10px;white-space:pre-wrap}
    #lab-wait button.link{background:none;border:0;color:${TEAL};font:600 14px system-ui;cursor:pointer;padding:0;text-decoration:underline}
    #lab-wait a.back,#lab-wait a.lnk{color:${TEAL};font-weight:600}
    #lab-wait .sw{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-1px;margin-right:4px}
    #lab-wait [hidden]{display:none !important}
  `;
  root.append(style);
  const wrap = document.createElement("div"); wrap.className = "wrap"; root.append(wrap);
  const range = (id: string, label: string, min: number, max: number, step: number) => `<label>${label}: <b id="${id}-v"></b><input id="${id}" type="range" min="${min}" max="${max}" step="${step}"></label>`;
  const chk = (id: string, label: string) => `<label class="chk"><input id="${id}" type="checkbox"> ${label}</label>`;
  wrap.innerHTML = `
    <div><a class="back" href="/?welcome=0">Back to the game</a>
    <h1>${title}</h1>
    <p class="small" style="margin:6px 0 0">Slow work cannot be made zero. It can be made smooth, shorter, and never empty. Turn the knobs and watch two lanes: what the computer does, and what the person sees.</p></div>
    <div class="grid">
      <div style="display:grid;gap:14px">
        <div class="card"><h2>Start from</h2><div id="lw-presets"></div></div>
        <div class="card"><h2>The simulator search (real jobs)</h2>
          <label>Course<select id="lw-course"></select></label>
          ${range("lw-workers", "Workers (0 = the page's own thread)", 0, 8, 1)}
          <div id="lw-main">${chk("lw-slice", "Work in slices between frames")}${range("lw-slicems", "Work started per frame (ms)", 1, 30, 1)}</div>
          ${chk("lw-early", "Stop a batch at its first clear")}
          ${range("lw-cache", "Jobs remembered from before (%)", 0, 100, 5)}
          ${range("lw-levels", "Coarse-to-fine passes", 1, 4, 1)}
          ${range("lw-slow", "Machine slower by (x)", 1, 6, 0.5)}
          <button class="go" id="lw-measure">Time the real search on this machine</button>
          <p class="small" id="lw-measured" style="margin:6px 0 0"></p></div>
        <div class="card"><h2>The Modal wait</h2>
          ${range("lw-cold", "Cold start (s)", 0, 120, 5)}
          ${range("lw-lead", "Make tab open to Segment press (s)", 0, 60, 1)}
          <label>Warm-up<select id="lw-warm"></select></label>
          <p class="small" id="lw-warm-says" style="margin:0"></p>
          ${chk("lw-early-search", "Start the lane search at the press, not after the lift")}</div>
        <div class="card"><h2>What the person sees</h2>
          ${chk("lw-ack", "Say 'working' at once")}${chk("lw-progress", "Progress and time left")}
          ${chk("lw-preview", "Stand-in box, then the rough ghost")}${chk("lw-keep", "Let them keep editing meanwhile")}</div>
      </div>
      <div style="display:grid;gap:14px;min-width:0">
        <div class="card"><h2>Two lanes</h2>
          <canvas id="lw-time" width="${W}" height="${H}"></canvas>
          <p class="small" id="lw-legend" style="margin:6px 0 0"></p></div>
        <div class="card"><h2>Meters</h2><div class="tiles" id="lw-tiles"></div></div>
        <div class="card"><h2>Challenges</h2><div class="ch" id="lw-ch"></div>
          <p class="small" style="margin:8px 0 0">Each check runs in its own fixed scene (cold start ${50} s, 8 s from tab to press, nothing remembered, our machine speed), so a knob cannot cheat it.</p></div>
        <div class="card"><h2>The search, frame by frame</h2>
          <canvas id="lw-frames" width="${W}" height="${FH}"></canvas>
          <p class="small" id="lw-frames-says" style="margin:6px 0 0"></p></div>
        <div class="card"><h2>What our game already does</h2><table><thead><tr><th>Idea</th><th>In the game</th><th>Real number</th></tr></thead><tbody id="lw-real"></tbody></table>
          <p class="small" style="margin:8px 0 0">The search itself is taught in <a class="lnk" id="lw-l-search" href="#"></a> and the proposals it throws out in <a class="lnk" id="lw-l-gen" href="#"></a>.</p></div>
        <div class="card"><h2>The maths</h2><button class="link" id="lw-eq-btn">Show the maths behind the meters</button><div class="eq" id="lw-eq" hidden></div></div>
      </div>
    </div>`;
  const $ = <T extends HTMLElement>(id: string): T => wrap.querySelector("#" + id) as T;
  labDefaultNote(wrap, "live", wrap.querySelector("p.small") as HTMLElement | null);
  ($("lw-l-search") as HTMLAnchorElement).href = labHref("lab-search"); $("lw-l-search").textContent = labName("lab-search");
  ($("lw-l-gen") as HTMLAnchorElement).href = labHref("lab-gentest"); $("lw-l-gen").textContent = labName("lab-gentest");

  let courses: Search[] = [], recs: RecCourse[] = [], cur = 0;
  let sc: SearchCfg = { ...DEFAULT_SEARCH, workers: 4 };
  let wc: WaitCfg = { ...DEFAULT_WAIT };
  const PRESETS: { id: string; name: string; sc: Partial<SearchCfg>; wc: Partial<WaitCfg> }[] = [
    { id: "bare", name: "Nothing hidden", sc: { workers: 0, slice: false, earlyExit: false, levels: 1, cacheHit: 0 }, wc: { warm: "none", searchEarly: false, ack: false, progress: false, preview: false, keepWorking: false } },
    { id: "ours", name: "Our setting", sc: { workers: 4, slice: true, sliceMs: 8, earlyExit: true, levels: 1, cacheHit: 0 }, wc: { ...DEFAULT_WAIT } },
  ];
  let preset = "ours";

  // ---- controls ----
  const setv = (id: string, v: string) => { ($(id) as HTMLInputElement).value = v; };
  const label = (id: string, text: string) => { $(id + "-v").textContent = text; };
  function sync() {
    setv("lw-workers", String(sc.workers)); label("lw-workers", sc.workers === 0 ? "page thread" : String(sc.workers));
    ($("lw-slice") as HTMLInputElement).checked = sc.slice; setv("lw-slicems", String(sc.sliceMs)); label("lw-slicems", String(sc.sliceMs));
    $("lw-main").hidden = sc.workers !== 0; $("lw-slicems").closest("label")!.hidden = !sc.slice;
    ($("lw-early") as HTMLInputElement).checked = sc.earlyExit;
    setv("lw-cache", String(Math.round(sc.cacheHit * 100))); label("lw-cache", `${Math.round(sc.cacheHit * 100)}%`);
    setv("lw-levels", String(sc.levels)); label("lw-levels", String(sc.levels));
    setv("lw-slow", String(sc.slow)); label("lw-slow", `x${s1(sc.slow)}`);
    setv("lw-cold", String(wc.coldS)); label("lw-cold", `${wc.coldS} s`);
    setv("lw-lead", String(wc.tabToPressS)); label("lw-lead", `${wc.tabToPressS} s`);
    ($("lw-warm") as HTMLSelectElement).value = wc.warm; $("lw-warm-says").textContent = WARMS.find((w) => w.id === wc.warm)!.says;
    for (const [id, k] of [["lw-early-search", "searchEarly"], ["lw-ack", "ack"], ["lw-progress", "progress"], ["lw-preview", "preview"], ["lw-keep", "keepWorking"]] as const) ($(id) as HTMLInputElement).checked = wc[k];
    $("lw-presets").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === preset)));
  }
  function bind() {
    const num = (id: string, f: (v: number) => void) => $(id).addEventListener("input", () => { f(Number(($(id) as HTMLInputElement).value)); preset = ""; update(); });
    const box = (id: string, f: (v: boolean) => void) => $(id).addEventListener("change", () => { f(($(id) as HTMLInputElement).checked); preset = ""; update(); });
    num("lw-workers", (v) => { sc = { ...sc, workers: v }; }); box("lw-slice", (v) => { sc = { ...sc, slice: v }; }); num("lw-slicems", (v) => { sc = { ...sc, sliceMs: v }; });
    box("lw-early", (v) => { sc = { ...sc, earlyExit: v }; }); num("lw-cache", (v) => { sc = { ...sc, cacheHit: v / 100 }; }); num("lw-levels", (v) => { sc = { ...sc, levels: v }; }); num("lw-slow", (v) => { sc = { ...sc, slow: v }; });
    num("lw-cold", (v) => { wc = { ...wc, coldS: v }; }); num("lw-lead", (v) => { wc = { ...wc, tabToPressS: v }; });
    $("lw-warm").addEventListener("change", () => { wc = { ...wc, warm: ($("lw-warm") as HTMLSelectElement).value as Warm }; preset = ""; update(); });
    box("lw-early-search", (v) => { wc = { ...wc, searchEarly: v }; }); box("lw-ack", (v) => { wc = { ...wc, ack: v }; }); box("lw-progress", (v) => { wc = { ...wc, progress: v }; });
    box("lw-preview", (v) => { wc = { ...wc, preview: v }; }); box("lw-keep", (v) => { wc = { ...wc, keepWorking: v }; });
    $("lw-course").addEventListener("change", () => { cur = Number(($("lw-course") as HTMLSelectElement).value); update(); });
  }

  // ---- drawing ----
  const text = (g: CanvasRenderingContext2D, t: string, x: number, y: number, c = INK, align: CanvasTextAlign = "left", font = "600 12px system-ui") => { g.fillStyle = c; g.font = font; g.textAlign = align; g.fillText(t, x, y); };
  function drawLanes(o: WaitOut) {
    const g = ($("lw-time") as HTMLCanvasElement).getContext("2d")!;
    g.clearRect(0, 0, W, H);
    const L = 96, R = W - 12, span = o.end * 1.02, X = (t: number) => L + (t / span) * (R - L);
    const laneY = [TOP, TOP + LH + 8];
    text(g, "Computer", 6, laneY[0] + 18, INK); text(g, "does", 6, laneY[0] + 34, GREY); text(g, "Person", 6, laneY[1] + 18, INK); text(g, "sees", 6, laneY[1] + 34, GREY);
    g.fillStyle = "#eef3ee"; g.fillRect(L, laneY[0], R - L, LH); g.fillRect(L, laneY[1], R - L, LH);
    // compute lane: three rows so overlapping work stays visible
    const rows = o.compute.map((s) => (s.kind === "wake" ? 0 : s.kind === "search" ? 2 : 1));
    o.compute.forEach((s, i) => {
      const y = laneY[0] + 3 + rows[i] * 20, a = X(s.a), b = Math.max(a + 2, X(s.b));
      g.fillStyle = KIND_COL[s.kind]; g.fillRect(a, y, b - a, 18);
      if (s.kind === "wake") { g.strokeStyle = "#fff"; g.lineWidth = 1; for (let x = a - 18; x < b; x += 6) { g.beginPath(); g.moveTo(Math.max(a, x), y + 18); g.lineTo(Math.min(b, x + 18), y); g.stroke(); } }
      if (b - a > 70) text(g, s.label, a + 4, y + 13, "#fff");
    });
    o.ux.forEach((u) => {
      const a = X(u.a), b = Math.max(a + 1, X(u.b));
      g.fillStyle = UX_COL[u.state]; g.fillRect(a, laneY[1], b - a, LH);
      if (u.label === "Page frozen") { g.fillStyle = RED; g.fillRect(a, laneY[1], b - a, 6); }
      if (b - a > 90) text(g, u.label, a + 4, laneY[1] + 40, INK);
    });
    // press, first word, first useful
    const mark = (t: number, name: string, c: string, dy: number) => { g.strokeStyle = c; g.lineWidth = 1.5; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(X(t), TOP - 4); g.lineTo(X(t), laneY[1] + LH); g.stroke(); g.setLineDash([]); text(g, name, X(t) + 3, dy, c); };
    mark(o.press, "press", INK, 12);
    // axis
    const stepS = o.end / 1000 > 120 ? 20 : 10;
    for (let s = 0; s * 1000 <= span; s += stepS) { text(g, `${s}s`, X(s * 1000), H - 6, GREY, "center"); g.strokeStyle = "#d5ddd6"; g.lineWidth = 1; g.beginPath(); g.moveTo(X(s * 1000), laneY[1] + LH); g.lineTo(X(s * 1000), laneY[1] + LH + 5); g.stroke(); }
    text(g, `first word +${ms(o.firstFeedbackMs)}`, X(o.press + o.firstFeedbackMs) + 3, H - 24, TEAL);
    $("lw-legend").innerHTML = (Object.keys(KIND_COL) as string[]).map((k) => `<span class="sw" style="background:${KIND_COL[k]}"></span>${{ wake: "cold start", mask: "cut-out", lift: "lift to 3D", search: "simulator search" }[k]}`).join(" ")
      + " &nbsp;|&nbsp; " + (Object.keys(UX_COL) as (keyof typeof UX_COL)[]).map((k) => `<span class="sw" style="background:${UX_COL[k]}"></span>${UX_NAME[k]}`).join(" ");
  }
  function drawFrames(o: WaitOut) {
    const g = ($("lw-frames") as HTMLCanvasElement).getContext("2d")!;
    g.clearRect(0, 0, W, FH);
    const L = 56, R = W - 10, base = FH - 24, top = 14, search = o.search, yMax = Math.max(40, search.worstFrameMs * 1.1);
    const Y = (v: number) => base - (v / yMax) * (base - top), X = (t: number) => L + (t / Math.max(1, search.doneMs)) * (R - L);
    const lim = Y(ASSUME.frameMs);
    const frames = search.frames.length ? search.frames : Array.from({ length: Math.ceil(search.doneMs / ASSUME.frameMs) }, (_, i) => ({ start: i * ASSUME.frameMs, ms: ASSUME.renderMs + ASSUME.messageMs, work: 0 }));
    for (const f of frames) { g.fillStyle = f.ms > ASSUME.frameMs ? RED : TEAL; const x = X(f.start); g.fillRect(x, Y(f.ms), Math.max(1, (R - L) / Math.max(40, frames.length) - 0.5), base - Y(f.ms)); }
    g.setLineDash([6, 4]); g.strokeStyle = AMBER; g.lineWidth = 1.5; g.beginPath(); g.moveTo(L, lim); g.lineTo(R, lim); g.stroke(); g.setLineDash([]);
    text(g, "16.7 ms", L - 4, lim + 4, AMBER, "right"); text(g, "0", L - 4, base + 4, GREY, "right");
    for (const e of search.passEnds.slice(0, -1)) { g.strokeStyle = "#8a6fb3"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(e), top); g.lineTo(X(e), base); g.stroke(); text(g, "rough answer", X(e) + 3, top + 8, "#8a6fb3"); }
    text(g, `0`, L, FH - 6, GREY, "center"); text(g, ms(search.doneMs), R, FH - 6, GREY, "right");
    $("lw-frames-says").textContent = sc.workers > 0
      ? `Workers do the jobs. The page's own thread only draws (${s1(search.worstFrameMs)} ms a frame), so no frame is missed.`
      : `${search.frames.length} frames carried the work. Each is a draw (${ASSUME.renderMs} ms) plus the jobs started in it; ${search.dropped} screen updates were missed.`;
  }
  function tiles(o: WaitOut) {
    const t = (name: string, value: string, cls = "") => `<div class="tile ${cls}"><b>${value}</b><span>${name}</span></div>`;
    $("lw-tiles").innerHTML = [
      t("First word on screen", ms(o.firstFeedbackMs), o.firstFeedbackMs < 300 ? "good" : "bad"),
      t("First useful thing", ms(o.firstUsefulMs), o.firstUsefulMs < 1000 ? "good" : ""),
      t("All ready, from the press", ms(o.totalMs)),
      t("Search finished in", ms(o.search.doneMs)),
      t("Frames missed", String(o.dropped), o.dropped ? "bad" : "good"),
      t("Worst frame", `${s1(o.worstFrameMs)} ms`, o.worstFrameMs > ASSUME.frameMs ? "bad" : "good"),
      t("Nothing to see or do", ms(o.deadMs), o.deadMs > 5000 ? "bad" : ""),
      t("Felt wait (no use)", ms(o.perceivedMs)),
    ].join("");
  }
  function chal() {
    const list = challenges(courses[cur], sc, wc);
    $("lw-ch").innerHTML = list.map((c) => `<span class="pill ${c.pass ? "pass" : "fail"}" data-ch="${c.id}">${c.pass ? "Pass" : "Not yet"}</span><span><b>${c.title}</b><br><span class="small">${c.rule}</span></span><span class="small" style="text-align:right">${c.got}<br>want ${c.want}</span>`).join("");
  }
  function real() {
    const b = courses.find((c) => c.id === "bars")!, all = b.batches.reduce((a, x) => a + x.ticks.reduce((p, q) => p + q, 0), 0), run = b.batches.reduce((a, x) => a + (x.stopAt >= 0 ? x.ticks.slice(0, x.stopAt + 1) : x.ticks).reduce((p, q) => p + q, 0), 0);
    const jobsAll = b.batches.reduce((a, x) => a + x.ticks.length, 0), jobsRun = b.batches.reduce((a, x) => a + (x.stopAt >= 0 ? x.stopAt + 1 : x.ticks.length), 0);
    const rail = courses.find((c) => c.id === "rail")!;
    const g1 = simulateSearch(rail, { ...DEFAULT_SEARCH, workers: 1 }).doneMs / simulateSearch(rail, { ...DEFAULT_SEARCH, workers: 8 }).doneMs;
    const dup = recs.map((r) => `${s1((100 * r.dupJobs) / r.jobsRun)}%`).join(", ");
    $("lw-real").innerHTML = [
      ["Early exit", "A batch that may stop at its first clear does (src/sim/ideal.ts).", `Swing to bars: ${jobsRun.toLocaleString()} of ${jobsAll.toLocaleString()} jobs run, ${s1(all / run)}x fewer ticks`],
      ["Remember proofs", "The proof of a move is kept and reused (the same proof was once asked three times).", `Repeats inside one search: ${dup} of jobs; the gain comes on the next visit`],
      ["Coarse then fine", "The bars search tries a coarse grid, then finer steps around the best few.", "Built in; the 'passes' knob models a rough answer first"],
      ["Workers", "A pool plays the jobs; the page keeps drawing (src/sim/ideal-pool.ts).", `Recorded: ${REAL.poolGain[0]} to ${REAL.poolGain[1]}x (CC-70). This model, 8 workers on the rail run: ${s1(g1)}x`],
      ["Same answer", "Golden tests pin that a faster search gives the same plan (tests/golden/search.json).", "Test here: the recording gives the game's own plan"],
      ["Progress panel", "The step, a bar and the time left, and Cancel (src/modes/course/search.ts).", "Opens only for a live search; a stored plan never shows it"],
      ["Wake the machines early", "The Make tab wakes the finder; pressing Segment wakes the 3D maker (src/slice/warm-client.ts).", `Cold: model load ${REAL.coldLoadS[0]} to ${REAL.coldLoadS[1]} s, a first piece ${REAL.firstPieceColdS[0]} to ${REAL.firstPieceColdS[1]} s. Warm: ${REAL.segmentWarmS} s and ${REAL.pieceWarmS} s`],
    ].map((r) => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("");
  }
  function update() {
    sc = clampSearch(sc);
    sync();
    const o = simulateWait(courses[cur], sc, wc);
    drawLanes(o); drawFrames(o); tiles(o); chal();
  }
  $("lw-eq-btn").addEventListener("click", () => {
    const eq = $("lw-eq"); eq.hidden = !eq.hidden;
    eq.textContent = `job time        = ticks / ${REAL.ticksPerMs} per ms  x  slowdown
one frame       = ${ASSUME.renderMs} ms draw + jobs started   (missed if above 16.7 ms)
wall time (N)   >= work / N          (a speed-up never beats N)
cold wait       = max(0, wake + cold - asked)
felt wait       = time with nothing useful on screen`;
  });
  $("lw-measure").addEventListener("click", () => {
    const out = $("lw-measured"); out.textContent = "Timing the real search in a worker...";
    fetch("/assets/lab/search-trap.course.json").then((r) => r.json()).then((course) => {
      const w = new Worker(new URL("../labs/wait/worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (e: MessageEvent) => {
        const rate = e.data.ticks / e.data.ms; w.terminate();
        out.textContent = `This machine: ${Math.round(rate)} ticks per ms (the Lab's default is ${REAL.ticksPerMs}). The search took ${Math.round(e.data.ms)} ms. Slowdown set to x${s1(REAL.ticksPerMs / rate)}.`;
        sc = { ...sc, slow: Math.max(1, Math.min(6, Math.round((REAL.ticksPerMs / rate) * 2) / 2)) }; preset = ""; update();
      };
      w.onerror = () => { out.textContent = "The worker could not start here."; };
      w.postMessage({ course });
    }).catch(() => { out.textContent = "Could not load the course."; });
  });

  fetch("/assets/lab/wait-recorded.json").then((r) => r.json()).then((j: { courses: RecCourse[] }) => {
    recs = j.courses; courses = recs.map(unpack);
    ($("lw-course") as HTMLSelectElement).innerHTML = recs.map((c, i) => `<option value="${i}">${c.label}</option>`).join("");
    ($("lw-warm") as HTMLSelectElement).innerHTML = WARMS.map((w) => `<option value="${w.id}">${w.name}</option>`).join("");
    $("lw-presets").innerHTML = PRESETS.map((p) => `<button class="preset" data-id="${p.id}">${p.name}</button>`).join("");
    $("lw-presets").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      const p = PRESETS.find((x) => x.id === (b as HTMLElement).dataset.id)!;
      sc = { ...sc, ...p.sc }; wc = { ...wc, ...p.wc }; preset = p.id; update();
    }));
    bind(); real();
    sc = { ...sc, ...PRESETS[1].sc }; wc = { ...wc, ...PRESETS[1].wc };
    update();
    document.documentElement.dataset.labWaitReady = "1";
    labPopulated("lab-wait");
  }).catch(() => { wrap.insertAdjacentHTML("beforeend", `<p class="small">Could not load the recorded search.</p>`); });
  return { backend: "canvas2d" };
}
