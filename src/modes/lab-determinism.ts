import { mountLabsNav } from "../ui/labs-nav";
import { labsOn } from "../ui/labs";
import { labDefaultNote, labPopulated } from "../ui/lab-default";
import type { CourseData } from "../course/course";
import type { RunnerInput } from "../sim/runner";
import golden from "../../tests/golden/sim-trace.json";
import {
  CLEAN, COURSES, DEFAULT_COURSE, GRIDS, LEVELS, NO_PINS, ROUNDINGS, compare, fewestPins, fmaExample, hashStrip, judge, levels, pinCount, recordKeys, runMachine, sumOrders, traceOfPlan,
  type Machine, type Order, type Pins, type Raw, type Rounding,
} from "../labs/determinism/determinism-core";

// Lab 17: Same run, any machine. The player replays one recorded run on simulated machines (a last-digit habit, a frame clock that drifts, a map walked in another order),
// sees one small fingerprint per frame turn red at the first mismatch, then switches pins on until the machines agree on every frame with the fewest pins.
// Every run is the game's own simulator (src/sim/world.ts) on a shipped demo course and its stored plan; the recorded traces are tests/golden/sim-trace.json. Behind the labs switch (?labs=1).
const INK = "#17201d", TEAL = "#0f6b5c", ORANGE = "#d9741a", RED = "#b91c1c", PALE = "#cdd8d1", GREY = "#52605a";
const W = 1100;
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
const gridName = (g: number | null) => (g === null ? "Off" : g >= 1 ? `${g} m` : g >= 0.01 ? `${g * 100} cm` : g >= 0.001 ? `${g * 1000} mm` : `1e-${Math.round(-Math.log10(g))} m`);
const goldenMap = golden as Record<string, string>;

export function startLabDeterminism(host: HTMLElement): { backend: "canvas2d" } {
  const root = document.createElement("div");
  root.id = "lab-determinism";
  root.style.cssText = `position:fixed;inset:0;overflow:auto;background:#f5f7f4;color:${INK};font:15px/1.4 system-ui,sans-serif`;
  host.append(root);
  mountLabsNav(host, "lab-determinism");
  if (!labsOn()) {
    root.innerHTML = `<div style="max-width:520px;margin:12vh auto;padding:0 16px"><h1 style="font-size:22px">Lab 17: Same run, any machine</h1><p>Labs are switched off.</p><p><a href="?mode=lab-determinism&labs=1" style="color:${TEAL}">Switch labs on</a></p></div>`;
    return { backend: "canvas2d" };
  }
  const style = document.createElement("style");
  style.textContent = `
    #lab-determinism .wrap{max-width:1200px;margin:0 auto;padding:16px;display:grid;gap:14px}
    #lab-determinism h1{font-size:22px;margin:0}#lab-determinism h2{font-size:15px;margin:0 0 6px}
    #lab-determinism .card{background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:12px}
    #lab-determinism .row3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
    #lab-determinism .split{display:grid;grid-template-columns:300px minmax(0,1fr);gap:14px;align-items:start}
    #lab-determinism label{display:grid;gap:2px;margin:8px 0}#lab-determinism input[type=range]{width:100%}
    #lab-determinism label.chk{display:flex;gap:8px;align-items:center;margin:6px 0;font-weight:600}
    #lab-determinism select{font:14px system-ui;padding:6px;border:1px solid #b9c4bb;border-radius:8px}
    #lab-determinism canvas{width:100%;height:auto;display:block;border-radius:6px;background:#eef3ee}
    #lab-determinism .small{color:${GREY};font-size:13px}
    #lab-determinism .mono,#lab-determinism code{font:13px ui-monospace,Menlo,monospace}
    #lab-determinism .pins{border:2px solid ${TEAL};border-radius:10px;padding:6px 10px;margin:8px 0;background:#f2f8f6}
    #lab-determinism .lv{display:flex;flex-wrap:wrap;gap:6px}
    #lab-determinism .lv button{font:600 13px system-ui;padding:6px 10px;border:1px solid #b9c4bb;border-radius:8px;background:#fff;color:${INK};cursor:pointer}
    #lab-determinism .lv button[aria-pressed=true]{border-color:${TEAL};background:#e6f2ee}
    #lab-determinism table{border-collapse:collapse;width:100%;font-size:13px}#lab-determinism th,#lab-determinism td{text-align:left;padding:3px 8px 3px 0;border-bottom:1px solid #e3e8e4;vertical-align:top}
    #lab-determinism .ok{color:${TEAL};font-weight:700}#lab-determinism .bad{color:${RED};font-weight:700}
    #lab-determinism .eq{font:14px/1.6 ui-monospace,Menlo,monospace;background:#f1f4f1;border-radius:8px;padding:8px 10px;white-space:pre-wrap}
    #lab-determinism .chip{display:inline-block;font:600 12px system-ui;border:1px solid #b9c4bb;border-radius:99px;padding:2px 9px;margin:2px 4px 2px 0;background:#f1f4f1}
    #lab-determinism .big{font:700 15px system-ui}
    #lab-determinism a.back{color:${TEAL};font-weight:600}
    #lab-determinism .mlabel{font:700 13px system-ui;margin:8px 0 2px}
  `;
  root.append(style);
  const wrap = document.createElement("div"); wrap.className = "wrap"; root.append(wrap);
  const courseOpts = COURSES.map((c) => `<option value="${c.id}">${esc(c.title)}</option>`).join("");
  const roundOpts = (Object.keys(ROUNDINGS) as Rounding[]).map((r) => `<option value="${r}">${esc(ROUNDINGS[r])}</option>`).join("");
  const gridOpts = [null, ...GRIDS].map((g) => `<option value="${g ?? ""}">${gridName(g)}</option>`).join("");
  const pinBox = (p: string) => `<div class="pins"><div class="big">Pins</div>
      <label class="chk"><input type="checkbox" id="${p}-fixed">Fixed step: read the keys by tick count</label>
      <label class="chk"><input type="checkbox" id="${p}-ordered">Ordered walk: always sorted names</label>
      <label>Round the hashed numbers to: <select id="${p}-grid">${gridOpts}</select></label></div>`;
  wrap.innerHTML = `
    <div><a class="back" href="/?welcome=0">Back to the game</a>
    <h1>Lab 17: Same run, any machine</h1>
    <p class="small" style="margin:2px 0 0"><b>Pipeline stages: Replay and Hash.</b> The server replays your keys and compares fingerprints, so every machine must get the same ones. The long story is in <code>docs/labs/determinism.md</code>.</p>
    <p class="small" style="margin:6px 0 0">The goal: replay one run on machines that round, count and walk a little differently, and find the fewest pins that make every frame agree.</p></div>
    <div class="card"><h2>Pick a recorded run</h2>
      <label style="max-width:360px">Course: <select id="ld-course">${courseOpts}</select></label>
      <p class="small" id="ld-run-says" style="margin:0"></p></div>
    <div class="row3">
      <div class="card"><h2>1. One rounding, or two?</h2>
        <label>Gap: 2 to the minus <b id="ld-fma-v"></b><input id="ld-fma" type="range" min="20" max="40" step="1" value="30"></label>
        <p class="mono" id="ld-fma-says" style="margin:0"></p>
        <p class="small" style="margin:6px 0 0">(1 + e) x (1 - e) - 1. A fused multiply-add rounds once and keeps the tiny part.</p></div>
      <div class="card"><h2>2. Add the same numbers in another order</h2>
        <p class="mono" id="ld-sum-says" style="margin:0;word-break:break-all"></p>
        <p class="small" style="margin:6px 0 0">These are the speeds of the run above. The red digits differ from the forward sum.</p></div>
      <div class="card"><h2>3. A frame clock that runs late</h2>
        <label>Late by: <b id="ld-clock-v"></b><input id="ld-clock" type="range" min="0" max="1" step="0.05" value="0.4"></label>
        <p class="mono" id="ld-clock-says" style="margin:0"></p>
        <p class="small" style="margin:6px 0 0">A late machine reads a later key. A fixed step never does.</p></div>
    </div>
    <div class="card"><h2>Two machines, the same keys</h2>
      <div class="split">
        <div>
          <div class="mlabel">Machine B</div>
          <label>Rounding: <select id="ld-b-round">${roundOpts}</select></label>
          <label>Frame clock late by: <b id="ld-b-drift-v"></b><input id="ld-b-drift" type="range" min="0" max="1" step="0.05"></label>
          <label>Walks the state: <select id="ld-b-order"><option value="natural">In saved order</option><option value="shuffled">In its own order</option></select></label>
          ${pinBox("ld-b-pin")}
          <p class="small" style="margin:0">Machine A is the clean reference. Pins apply to both.</p></div>
        <div style="min-width:0">
          <p class="big" id="ld-b-first" style="margin:0 0 4px"></p>
          <canvas id="ld-b-strip" width="${W}" height="96"></canvas>
          <p class="small" style="margin:2px 0 8px">Top: machine A. Middle: machine B. Bottom: green where the fingerprints agree, red where they do not.</p>
          <canvas id="ld-b-div" width="${W}" height="150"></canvas>
          <p class="small" style="margin:2px 0 8px" id="ld-b-div-says"></p>
          <canvas id="ld-b-path" width="${W}" height="150"></canvas>
          <p class="small" style="margin:2px 0 8px">The path of A (green) and B (orange) on the course, side on.</p>
          <table><thead><tr><th>Do the two runs match?</th><th></th></tr></thead><tbody id="ld-b-levels"></tbody></table></div>
      </div></div>
    <div class="card"><h2>Challenge: three machines, every frame, the fewest pins</h2>
      <div class="lv" id="ld-lv"></div>
      <p class="small" id="ld-story" style="margin:6px 0 0"></p>
      <div id="ld-chips"></div>
      <div class="split">
        <div>${pinBox("ld-c-pin")}
          <p class="big" id="ld-c-score" style="margin:0"></p></div>
        <div style="min-width:0">
          <canvas id="ld-c-strip" width="${W}" height="120"></canvas>
          <p class="small" style="margin:2px 0 8px">Machine 1, 2 and 3, then green where all three agree and red where they do not.</p>
          <p class="big" id="ld-c-verdict" style="margin:0"></p>
          <p class="small" id="ld-c-says" style="margin:4px 0 0"></p></div>
      </div></div>
    <div class="card"><h2>How a run is checked, and the recorded traces</h2>
      <p class="small" id="ld-verify" style="margin:0 0 8px"></p>
      <table><thead><tr><th>Course</th><th>Stored trace (ticks:hash)</th><th>This browser</th><th></th></tr></thead><tbody id="ld-trace"></tbody></table>
      <p class="small bad" id="ld-trace-note" style="margin:6px 0 0"></p>
      <p class="small" style="margin:6px 0 0">The stored traces are tests/golden/sim-trace.json: the whole world after every tick, hashed, for the stored best run of each course.</p></div>
    <div class="card"><h2>The maths</h2><div class="eq" id="ld-eq"></div></div>`;
  const $ = <T extends HTMLElement>(id: string): T => wrap.querySelector("#" + id) as T;
  labDefaultNote(wrap, "live", wrap.querySelector("p.small") as HTMLElement | null);
  $("ld-eq").textContent = `A 64-bit number keeps about 16 digits: the gap between neighbours near x is ulp(x) = |x| x 2^-52.
Two roundings:   fl( fl(a x b) + c )      One rounding (fused):  fl( a x b + c )
Adding is not associative:   (a + b) + c  can differ from  a + (b + c)  in the last digit.
Frame clock late by f:   tick i reads key i + floor(i x f).   A fixed step reads key i.
Hash of a frame:   H( name1=v1 ; name2=v2 ; ... )  walked in sorted order; with a grid g each v is round(v / g).
A number near a rounding edge can still land on the other side: a grid g hides a difference d with chance about 1 - d/g per number.`;

  // ---- state ----
  const cache = new Map<string, Raw>();
  let course: CourseData | null = null, courseId = DEFAULT_COURSE, keys: RunnerInput[] = [], keyBySum: number[] = [];
  const B: Machine = { name: "Machine B", rounding: "fused", drift: 0.002, order: "shuffled", seed: 2 };
  const pinsB: Pins = { fixed: true, ordered: true, grid: 0.01 };
  let levelId = 2; const pinsC: Pins = { ...NO_PINS };
  let fewest: { fewest: number } | null | undefined;
  const courses = new Map<string, CourseData>();
  const rawOf = (m: Machine, fixed: boolean): Raw => {
    const k = `${courseId}|${m.rounding}|${fixed ? 0 : m.drift}|${m.seed}|${fixed}`;
    let r = cache.get(k); if (!r) { r = runMachine(course!, keys, m, fixed); cache.set(k, r); }
    return r;
  };
  const readPins = (p: string, into: Pins) => {
    into.fixed = ($(`${p}-fixed`) as HTMLInputElement).checked; into.ordered = ($(`${p}-ordered`) as HTMLInputElement).checked;
    const g = ($(`${p}-grid`) as HTMLSelectElement).value; into.grid = g === "" ? null : Number(g);
  };
  const writePins = (p: string, from: Pins) => {
    ($(`${p}-fixed`) as HTMLInputElement).checked = from.fixed; ($(`${p}-ordered`) as HTMLInputElement).checked = from.ordered; ($(`${p}-grid`) as HTMLSelectElement).value = from.grid === null ? "" : String(from.grid);
  };

  // ---- drawing ----
  const strip = (ctx: CanvasRenderingContext2D, y: number, h: number, ok: boolean[], colour: (ok: boolean) => string) => {
    const n = ok.length, cols = W;
    for (let c = 0; c < cols; c++) {
      const a = Math.floor((c * n) / cols), b = Math.max(a + 1, Math.floor(((c + 1) * n) / cols));
      let all = true; for (let i = a; i < b && i < n; i++) if (!ok[i]) all = false;
      ctx.fillStyle = colour(all); const hh = all ? h * 0.6 : h; ctx.fillRect(c, y + (h - hh), 1, hh);
    }
  };
  const hueOf = (hash: string) => `hsl(${(parseInt(hash.slice(0, 4), 16) / 65535) * 360},45%,60%)`; // a hash is drawn as a colour: equal hashes, equal colours
  const hashRow = (ctx: CanvasRenderingContext2D, y: number, h: number, hs: string[]) => {
    for (let c = 0; c < W; c++) { const i = Math.min(hs.length - 1, Math.floor((c * hs.length) / W)); ctx.fillStyle = hueOf(hs[i]); ctx.fillRect(c, y, 1, h); }
  };
  const label = (ctx: CanvasRenderingContext2D, t: string, x: number, y: number, col = INK) => { ctx.fillStyle = col; ctx.font = "600 12px system-ui"; ctx.fillText(t, x, y); };

  function drawB() {
    const A = { m: CLEAN, raw: rawOf(CLEAN, true) }, Bm = { m: B, raw: rawOf(B, pinsB.fixed) };
    const a = { ...A, hashes: hashStrip(A.raw, CLEAN, pinsB) }, b = { ...Bm, hashes: hashStrip(Bm.raw, B, pinsB) };
    const c = compare(a, b);
    const ctx = ($("ld-b-strip") as HTMLCanvasElement).getContext("2d")!;
    ctx.clearRect(0, 0, W, 96);
    hashRow(ctx, 0, 24, a.hashes); hashRow(ctx, 30, 24, b.hashes);
    const ok = Array.from({ length: c.frames }, (_, i) => a.hashes[i] === b.hashes[i]);
    strip(ctx, 60, 36, ok, (g) => (g ? TEAL : RED));
    $("ld-b-first").innerHTML = c.first === null ? `<span class="ok">All ${c.frames} frames agree.</span>` : `<span class="bad">First mismatch: frame ${c.first} of ${c.frames}.</span> <span class="small">${c.mismatches} frames differ.</span>`;
    // divergence meter: how far apart the real numbers are, on a log scale
    const dc = ($("ld-b-div") as HTMLCanvasElement).getContext("2d")!, H = 150, lo = -17, hi = 1;
    dc.clearRect(0, 0, W, H);
    const yOf = (d: number) => 10 + (1 - ((d > 0 ? Math.max(lo, Math.log10(d)) : lo) - lo) / (hi - lo)) * (H - 28);
    for (const [v, t] of [[-9, "1e-9: close enough"], [-3, "1 mm"], [-15, "last digit"]] as [number, string][]) { const y = yOf(10 ** v); dc.strokeStyle = PALE; dc.beginPath(); dc.moveTo(0, y); dc.lineTo(W, y); dc.stroke(); label(dc, t, W - 130, y - 3, GREY); }
    dc.strokeStyle = ORANGE; dc.lineWidth = 2; dc.beginPath();
    c.maxDiff.forEach((d, i) => { const x = (i / Math.max(1, c.frames - 1)) * W, y = yOf(Number.isFinite(d) ? d : 10); i ? dc.lineTo(x, y) : dc.moveTo(x, y); });
    dc.stroke(); dc.lineWidth = 1; label(dc, "How far apart the real numbers are (log scale, lower is closer)", 8, 14);
    $("ld-b-div-says").textContent = c.peak === 0 ? "The real numbers are identical on every frame." : `Largest gap between the two runs: ${c.peak.toExponential(2)} (in metres or metres per second).`;
    // paths
    const pc = ($("ld-b-path") as HTMLCanvasElement).getContext("2d")!, ph = 150;
    pc.clearRect(0, 0, W, ph);
    const all = [...a.raw.snaps, ...b.raw.snaps], x0 = Math.min(...all.map((s) => s.x)), x1 = Math.max(...all.map((s) => s.x)), y0 = Math.min(...all.map((s) => s.y)), y1 = Math.max(...all.map((s) => s.y));
    const sc = Math.min((W - 24) / Math.max(0.1, x1 - x0), (ph - 24) / Math.max(0.1, y1 - y0));
    const draw = (raw: Raw, col: string, wdt: number) => { pc.strokeStyle = col; pc.lineWidth = wdt; pc.beginPath(); raw.snaps.forEach((s, i) => { const x = 12 + (s.x - x0) * sc, y = ph - 12 - (s.y - y0) * sc; i ? pc.lineTo(x, y) : pc.moveTo(x, y); }); pc.stroke(); };
    draw(a.raw, TEAL, 6); draw(b.raw, ORANGE, 2); pc.lineWidth = 1;
    $("ld-b-levels").innerHTML = levels(c).map((l) => `<tr><td>Level ${l.id}. ${esc(l.name)}</td><td class="${l.ok ? "ok" : "bad"}">${l.ok ? "yes" : "no"}</td></tr>`).join("");
    return c;
  }

  function drawChallenge() {
    const L = LEVELS.find((l) => l.id === levelId)!;
    const raws = L.machines.map((m) => rawOf(m, pinsC.fixed)), j = judge(raws, L.machines, pinsC);
    const ctx = ($("ld-c-strip") as HTMLCanvasElement).getContext("2d")!;
    ctx.clearRect(0, 0, W, 120);
    j.runs.forEach((r, i) => hashRow(ctx, i * 26, 22, r.hashes));
    const frames = Math.max(...j.runs.map((r) => r.hashes.length));
    const ok = Array.from({ length: frames }, (_, i) => j.runs.every((r) => r.hashes[i] === j.runs[0].hashes[i]));
    strip(ctx, 82, 36, ok, (g) => (g ? TEAL : RED));
    const k = pinCount(pinsC);
    $("ld-c-score").textContent = `Pins on: ${k}`;
    const v = $("ld-c-verdict");
    if (j.allAgree) {
      const best = fewest ? fewest.fewest : null;
      v.className = "big ok";
      v.textContent = best !== null && k === best ? `All frames agree with the fewest pins (${k}).` : `All frames agree with ${k} pins. Can it be done with fewer?`;
    } else {
      v.className = "big bad";
      v.textContent = j.first === null ? `The machines ended differently (${j.runs.map((r) => r.raw.outcome).join(", ")}).` : `First mismatch: frame ${j.first}. ${j.mismatches.map((n, i) => `Machine ${i + 2}: ${n} frames differ`).join(". ")}.`;
    }
    $("ld-c-says").textContent = j.sameOutcome ? `All three runs end the same way: ${j.runs[0].raw.outcome}.` : `The runs end differently: ${j.runs.map((r) => `${r.m.name} ${r.raw.outcome}`).join(", ")}.`;
    v.dataset.agree = String(j.allAgree); v.dataset.pins = String(k); v.dataset.fewest = fewest ? String(fewest.fewest) : "none";
    return j;
  }

  function drawHabits() {
    const v = Number(($("ld-fma") as HTMLInputElement).value);
    const f = fmaExample(v);
    $("ld-fma-v").textContent = String(v);
    $("ld-fma-says").innerHTML = `two roundings: ${f.unfused}<br>one rounding: ${f.fused.toExponential(3)}<br><span class="${f.unfused === f.fused ? "ok" : "bad"}">${f.unfused === f.fused ? "same" : "different"}</span>`;
    const s = sumOrders(keyBySum), digits = (x: number) => x.toPrecision(17);
    const base = digits(s.forward);
    const mark = (x: number) => { const t = digits(x); let i = 0; while (i < t.length && t[i] === base[i]) i++; return `${esc(t.slice(0, i))}<span class="bad">${esc(t.slice(i))}</span>`; };
    $("ld-sum-says").innerHTML = `forward: ${esc(base)}<br>backward: ${mark(s.backward)}<br>small first: ${mark(s.sorted)}<br>in pairs: ${mark(s.pairs)}`;
    const late = Number(($("ld-clock") as HTMLInputElement).value);
    $("ld-clock-v").textContent = `${late.toFixed(2)} %`;
    const at = (i: number) => i + Math.floor((i * late) / 100);
    $("ld-clock-says").innerHTML = `tick 200 reads key ${at(200)}<br>tick 400 reads key ${at(400)}<br>tick 600 reads key ${at(600)}`;
  }

  function drawVerify() {
    const A = rawOf(CLEAN, true), name = COURSES.find((c) => c.id === courseId)!;
    $("ld-run-says").textContent = `${keys.length} key states, ${A.ticks} frames, the run ${A.outcome === "cleared" ? "clears the course" : "ends: " + A.outcome}.`;
    $("ld-verify").innerHTML = `<b>1.</b> Your run is the keys, one per tick. <b>2.</b> The checker replays them with a fixed step. <b>3.</b> It fingerprints every frame. <b>4.</b> It compares with the stored trace of ${esc(name.title)}.`;
  }

  const tracesDone = new Map<string, string>();
  function drawTraces() {
    $("ld-trace").innerHTML = COURSES.map((c) => {
      const mine = tracesDone.get(c.id), stored = goldenMap[c.planKey];
      return `<tr data-course="${c.id}"><td>${esc(c.title)}</td><td class="mono">${esc(stored ?? "none")}</td><td class="mono">${esc(mine ?? "...")}</td><td class="${mine === stored ? "ok" : "bad"}">${mine === undefined ? "" : mine === stored ? "same" : "different"}</td></tr>`;
    }).join("");
    const diff = COURSES.filter((c) => tracesDone.has(c.id) && tracesDone.get(c.id) !== goldenMap[c.planKey]);
    $("ld-trace-note").textContent = diff.length ? `Different here: ${diff.map((c) => c.title).join(", ")}. Same keys, same number of frames, but this browser's maths (sin and cos) rounds some last digits another way than the machine that stored the trace. This is the lesson, live.` : "";
  }

  // ---- wiring ----
  const redrawB = () => { readPins("ld-b-pin", pinsB); B.rounding = ($("ld-b-round") as HTMLSelectElement).value as Rounding; B.order = ($("ld-b-order") as HTMLSelectElement).value as Order; B.drift = Number(($("ld-b-drift") as HTMLInputElement).value) / 100; $("ld-b-drift-v").textContent = `${(B.drift * 100).toFixed(2)} %`; drawB(); };
  const redrawC = () => { readPins("ld-c-pin", pinsC); drawChallenge(); };
  const pickLevel = (id: number) => {
    levelId = id; const L = LEVELS.find((l) => l.id === id)!;
    wrap.querySelectorAll<HTMLButtonElement>("#ld-lv button").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.level) === id)));
    $("ld-story").textContent = L.story;
    $("ld-chips").innerHTML = L.machines.map((m) => `<span class="chip">${esc(m.name)}: ${m.rounding === "exact" ? "exact" : m.rounding === "fused" ? "fused" : "32-bit"}${m.drift ? `, clock late ${(m.drift * 100).toFixed(1)} %` : ""}${m.order === "shuffled" ? ", own walk order" : ""}</span>`).join("");
    fewest = undefined; const t = fewestPins(course!, keys, L); fewest = t ? { fewest: t.fewest } : null;
    drawChallenge();
    if (fewest === null) $("ld-c-says").textContent += " On this course no rounding grid hides every flip (a number sits on a rounding edge): try the plank.";
  };
  $("ld-lv").innerHTML = LEVELS.map((l) => `<button data-level="${l.id}" aria-pressed="false">Level ${l.id}: ${esc(l.title)}</button>`).join("");
  $("ld-lv").addEventListener("click", (e) => { const b = (e.target as HTMLElement).closest("button"); if (b) pickLevel(Number(b.dataset.level)); });
  for (const id of ["ld-b-round", "ld-b-order", "ld-b-drift", "ld-b-pin-fixed", "ld-b-pin-ordered", "ld-b-pin-grid"]) $(id).addEventListener("input", redrawB);
  for (const id of ["ld-c-pin-fixed", "ld-c-pin-ordered", "ld-c-pin-grid"]) $(id).addEventListener("input", redrawC);
  for (const id of ["ld-fma", "ld-clock"]) $(id).addEventListener("input", drawHabits);
  $("ld-course").addEventListener("change", () => { void useCourse(($("ld-course") as HTMLSelectElement).value); });

  async function load(id: string): Promise<CourseData> {
    let c = courses.get(id); if (c) return c;
    c = (await (await fetch(`/assets/demo/${COURSES.find((x) => x.id === id)!.file}`)).json()) as CourseData; courses.set(id, c); return c;
  }
  async function useCourse(id: string) {
    courseId = id; course = await load(id); keys = recordKeys(course);
    keyBySum = Array.from({ length: 200 }, (_, i) => rawOf(CLEAN, true).snaps[i + 1]?.vx ?? 0);
    drawHabits(); drawVerify(); redrawB(); pickLevel(levelId);
  }
  void (async () => {
    try {
      ($("ld-course") as HTMLSelectElement).value = courseId;
      ($("ld-b-round") as HTMLSelectElement).value = B.rounding; ($("ld-b-order") as HTMLSelectElement).value = B.order; ($("ld-b-drift") as HTMLInputElement).value = String(B.drift * 100);
      writePins("ld-b-pin", pinsB); writePins("ld-c-pin", pinsC);
      await useCourse(courseId);
      drawTraces();
      for (const c of COURSES) { const cd = await load(c.id); tracesDone.set(c.id, traceOfPlan(cd)); drawTraces(); await new Promise((r) => setTimeout(r)); }
      labPopulated("lab-determinism");
    } catch (e) {
      $("ld-run-says").textContent = `The run could not be loaded: ${String(e)}`;
    }
  })();
  return { backend: "canvas2d" };
}
