import { mountSkinCollider } from "../labs/collision/skin-widget";
import { mountLabsNav } from "../ui/labs-nav";
import { labsOn } from "../ui/labs";
import { labDefaultNote, labPopulated } from "../ui/lab-default";
import { readGlbMesh } from "../slice/glb";
import type { Mesh } from "../slice/slice";
import type { InputLog } from "../sim/replay";
import { trackFromPlan } from "../sim/replay";
import { searchIdealRun } from "../sim/ideal";
import {
  BREAKS, DEFAULT_BREAK, DEFAULT_VOXEL, DEMO_COURSE_URL, DEMO_RUN_URL, GAP_MAX, GAP_MIN, GLB_URL, compareBreak, courseFor, gapTable, playKeys, runStages,
  type Break, type BreakKind, type Compare, type Played, type Side, type Stages,
} from "../labs/collision/collision-core";

// Collision from a 3D lift (pipeline stage 4 of 8). The player scrubs through the steps the game takes to turn a lifted photo object into a collider, each drawn side-on
// with its outputs; then breaks the lift and sees the fitted row stay regular. Every number is computed in the page by src/slice/role-collider.ts (the game's own code) on the
// real Saienji CC0 monkey-bars lift. Nothing here talks or grades. Equations come last, behind a button (labs may show equations). Behind the labs switch (?labs=1).
const INK = "#17201d", TEAL = "#0f6b5c", ORANGE = "#d9741a", GREY = "#9aa5a0", PALE = "#cdd8d1", RED = "#b91c1c", BLUE = "#5b7fa6";
const W = 1100, H = 330, CH = 170;
const STEPS = [
  { id: 1, name: "The lifted skin", does: "The lift is a mesh of triangles. It is the skin, never the collider." },
  { id: 2, name: "Voxelise", does: "Split every triangle until it is shorter than a cell, then mark the cells it touches." },
  { id: 3, name: "Close holes", does: "Grow the cells by one, then shrink by one: cracks close, thin rungs stay. (The code does this before keeping the biggest piece, so a frame the holes cut in two is one piece again.)" },
  { id: 4, name: "Keep the largest piece", does: "Label the touching cells; keep the biggest piece; floating blobs go." },
  { id: 5, name: "Top band", does: "Only the top 0.3 m under the highest cell is looked at, so legs and posts do not count." },
  { id: 6, name: "Rung peaks per slice", does: "Count cells in each slice along the row; a rung is a peak above the median plus 40% of the way to the maximum." },
  { id: 7, name: "One spacing", does: "Round each gap to a whole number of unit gaps, then fit one line through the places." },
  { id: 8, name: "The BarRun", does: "Keep four numbers: first place, height, rungs, spacing. The editor's limits are applied here." },
  { id: 9, name: "In the simulator", does: "Drop the row into the bars simulator and play the recorded ideal run." },
];

export function startLabCollision(host: HTMLElement): { backend: "canvas2d" } {
  const root = document.createElement("div");
  root.id = "lab-collision";
  root.style.cssText = `position:fixed;inset:0;overflow:auto;background:#f5f7f4;color:${INK};font:15px/1.4 system-ui,sans-serif`;
  host.append(root);
  mountLabsNav(host, "lab-collision");
  if (!labsOn()) {
    root.innerHTML = `<div style="max-width:520px;margin:12vh auto;padding:0 16px"><h1 style="font-size:22px">Collision from a 3D lift</h1><p>Labs are switched off.</p><p><a href="?mode=lab-collision&labs=1" style="color:${TEAL}">Switch labs on</a></p></div>`;
    return { backend: "canvas2d" };
  }
  const style = document.createElement("style");
  style.textContent = `
    #lab-collision .wrap{max-width:1200px;margin:0 auto;padding:16px;display:grid;gap:14px}
    #lab-collision h1{font-size:22px;margin:0}#lab-collision h2{font-size:15px;margin:0 0 6px}
    #lab-collision .grid{display:grid;grid-template-columns:300px minmax(0,1fr);gap:14px;align-items:start}
    #lab-collision .card{background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:12px}
    #lab-collision label{display:grid;gap:2px;margin:8px 0}#lab-collision input[type=range]{width:100%}
    #lab-collision select{font:14px system-ui;padding:6px;border:1px solid #b9c4bb;border-radius:8px}
    #lab-collision canvas{width:100%;height:auto;display:block;border-radius:6px;background:#eef3ee}
    #lab-collision .small{color:#52605a;font-size:13px}
    #lab-collision .steps{display:flex;flex-wrap:wrap;gap:6px}
    #lab-collision .steps button,#lab-collision .nav button{font:600 13px system-ui;padding:6px 9px;border:1px solid #b9c4bb;border-radius:8px;background:#fff;color:${INK};cursor:pointer}
    #lab-collision .steps button[aria-pressed=true]{border-color:${TEAL};background:#e6f2ee}
    #lab-collision .nav{display:flex;gap:6px;margin-top:8px}
    #lab-collision .facts{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:0}
    #lab-collision .facts dt{color:#52605a}#lab-collision .facts dd{margin:0;font-weight:600}
    #lab-collision table{border-collapse:collapse;width:100%;font-size:13px}#lab-collision th,#lab-collision td{text-align:left;padding:3px 8px 3px 0;border-bottom:1px solid #e3e8e4;vertical-align:top}
    #lab-collision tr.cur td{background:#e6f2ee}#lab-collision tbody.pick tr{cursor:pointer}
    #lab-collision .eq{font:14px/1.6 ui-monospace,Menlo,monospace;background:#f1f4f1;border-radius:8px;padding:8px 10px;white-space:pre-wrap}
    #lab-collision .go{font:700 14px system-ui;padding:8px 12px;border:0;border-radius:8px;background:${TEAL};color:#fff;cursor:pointer;margin-top:6px}
    #lab-collision button.link{background:none;border:0;color:${TEAL};font:600 14px system-ui;cursor:pointer;padding:0;text-decoration:underline}
    #lab-collision a.back{color:${TEAL};font-weight:600}
    #lab-collision .sw{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-1px;margin-right:4px}
    #lab-collision [hidden]{display:none !important}
    #lab-collision .good{color:${TEAL};font-weight:700}#lab-collision .bad{color:${RED};font-weight:700}
  `;
  root.append(style);
  const wrap = document.createElement("div"); wrap.className = "wrap"; root.append(wrap);
  wrap.innerHTML = `
    <div><a class="back" href="/?welcome=0">Back to the game</a>
    <h1>Collision from a 3D lift</h1>
    <p class="small" style="margin:2px 0 0"><b>Pipeline stage 4 of 8: Collision from 3D.</b> Before it: baking the lift to a game object. After it: placing the object on a course and proving it with the simulator (the last step here does that for the bars). The same story is in the doc <code>docs/labs/collision.md</code>.</p>
    <p class="small" style="margin:6px 0 0">The goal: see how a noisy 3D lift of a real set of monkey bars becomes four clean numbers the physics can trust. The lift is only the <b>skin</b>. The collider is a <b>fitted row</b>: one spacing, never a copy of the mesh. Scrub through the steps, then break the lift and watch the row.</p></div>
    <div class="grid">
      <div style="display:grid;gap:14px">
        <div class="card"><h2>Steps</h2><div class="steps" id="lcol-steps"></div>
          <div class="nav"><button id="lcol-prev">Previous step</button><button id="lcol-next">Next step</button></div>
          <label>Cell size: <b id="lcol-vox-v"></b><input id="lcol-vox" type="range" min="0.03" max="0.12" step="0.01"></label>
          <p class="small" style="margin:0">The game uses 5 cm. Change it and every step is run again with the game's code.</p></div>
        <div class="card"><h2>Break it</h2>
          <label>What goes wrong in the lift<select id="lcol-brk"></select></label>
          <label id="lcol-idx-row">Which rung: <b id="lcol-idx-v"></b><input id="lcol-idx" type="range" min="0" max="12" step="1"></label>
          <label id="lcol-sig-row">Wobble: <b id="lcol-sig-v"></b><input id="lcol-sig" type="range" min="0" max="10" step="0.5"></label>
          <label id="lcol-seed-row">Seed: <b id="lcol-seed-v"></b><input id="lcol-seed" type="range" min="1" max="20" step="1"></label>
          <p class="small" id="lcol-brk-says" style="margin:0"></p></div>
      </div>
      <div style="display:grid;gap:14px;min-width:0">
        <div class="card"><h2 id="lcol-title"></h2><p class="small" id="lcol-does" style="margin:0 0 6px"></p>
          <canvas id="lcol-side" width="${W}" height="${H}"></canvas>
          <canvas id="lcol-chart" width="${W}" height="${CH}" style="margin-top:8px"></canvas>
          <p class="small" id="lcol-legend" style="margin:6px 0 0"></p>
          <dl class="facts" id="lcol-facts" style="margin-top:8px"></dl></div>
        <div class="card"><h2>Every step and what it gives</h2><table><thead><tr><th>#</th><th>Step</th><th>Output</th></tr></thead><tbody class="pick" id="lcol-all"></tbody></table></div>
        <div class="card"><h2>Break it: a collider that copies the mesh against the fitted row</h2>
          <canvas id="lcol-cmp" width="${W}" height="${CH}"></canvas>
          <table style="margin-top:8px"><thead><tr><th></th><th>Copies the mesh</th><th>Fitted row (the game)</th></tr></thead><tbody id="lcol-cmp-t"></tbody></table>
          <p id="lcol-verdict" style="margin:8px 0 0"></p></div>
        <div class="card"><h2>The fitted row in the bars simulator</h2>
          <canvas id="lcol-sim" width="${W}" height="${H}"></canvas>
          <label>Tick: <b id="lcol-tick-v"></b><input id="lcol-tick" type="range" min="0" max="1" step="1"></label>
          <p class="small" id="lcol-sim-says" style="margin:0"></p>
          <button class="go" id="lcol-search">Search a new run for this row (about 5 seconds)</button></div>
        <div class="card" id="lskin"><h2>Step 10: Skin versus collider</h2>
          <p class="small" style="margin:0 0 6px">A photo gives a skin to look at. The simulator needs a simple collider it can trust: the same ball, rolled over two lifts of the same photo, must run the same.</p>
          <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center">
            <label style="margin:0">Object <select id="lskin-obj"></select></label>
            <span><label style="display:flex;gap:6px;align-items:center;margin:0"><input type="radio" name="lskin-m" value="skin" checked> Collide with the skin</label>
            <label style="display:flex;gap:6px;align-items:center;margin:0"><input type="radio" name="lskin-m" value="collider"> Collide with the collider (a box rounded to 5 cm)</label></span>
            <label id="lskin-det-row" style="margin:0;min-width:260px">Skin detail: <b id="lskin-det-v"></b> triangles<input id="lskin-det" type="range" min="50" max="5820" step="10"></label>
          </div>
          <canvas id="lskin-cv" width="1100" height="300" style="margin-top:8px"></canvas>
          <p class="small" style="margin:6px 0 0"><span class="sw" style="background:#5b7fa6"></span>the lifted skin <span class="sw" style="background:${ORANGE};margin-left:10px"></span>what the ball collides with <span class="sw" style="background:${TEAL};margin-left:10px"></span>run on the first lift <span class="sw" style="background:${RED};margin-left:10px"></span>run on the same photo lifted again (5 mm of change). <span id="lskin-credit"></span></p>
          <label>Tick: <input id="lskin-tick" type="range" min="0" max="1" step="1"></label>
          <table><thead><tr><th></th><th>Triangles</th><th>Checks</th><th>Snags</th><th>Jitter (mm)</th><th>Run hash</th><th>Gets across</th></tr></thead><tbody id="lskin-facts"></tbody></table>
          <p class="small" id="lskin-cost" style="margin:6px 0 0"></p><p id="lskin-verdict" style="margin:4px 0 0"></p>
          <h2 style="margin-top:12px">Challenge: pick the collider that keeps the run identical</h2>
          <div id="lskin-pick"></div><button class="go" id="lskin-check">Check my pick</button> <span id="lskin-result"></span>
          <table style="margin-top:8px"><thead><tr><th>Collider</th><th>Triangles</th><th>Same run on both lifts</th><th>Top off by</th><th>Keeps the run</th><th></th></tr></thead><tbody id="lskin-all"></tbody></table></div>
        <div class="card"><h2>The maths</h2><button class="link" id="lcol-eq-btn">Show the maths behind the fitted row</button><div class="eq" id="lcol-eq" hidden></div></div>
      </div>
    </div>`;
  const $ = <T extends HTMLElement>(id: string): T => wrap.querySelector("#" + id) as T;
  const note = labDefaultNote(wrap, "live", wrap.querySelector("p.small") as HTMLElement | null);
  void note;

  let mesh: Mesh | null = null, log: InputLog = [], baseline: Played | null = null;
  let voxel = DEFAULT_VOXEL, step = 6, st: Stages | null = null;
  let brk: Break = { ...DEFAULT_BREAK };
  let cmp: Compare | null = null, played: Played | null = null, searched: Played | null = null;
  const f = (v: number, d = 3) => v.toFixed(d);

  // ---- drawing ----
  const frame = (s: Stages) => {
    const p = s.profile, x0 = p.a0 - 0.3, x1 = p.a1 + 0.3, y0 = p.bottom - 0.15, y1 = p.top + 0.25, sc = Math.min((W - 24) / (x1 - x0), (H - 24) / (y1 - y0));
    return { sc, px: (x: number) => 12 + (x - x0) * sc, py: (y: number) => H - 12 - (y - y0) * sc };
  };
  type Fr = ReturnType<typeof frame>;
  const cells = (g: CanvasRenderingContext2D, fr: Fr, side: Side, colour: string, keep?: (x: number, y: number, yc: number) => boolean) => {
    g.fillStyle = colour;
    for (let y = 0; y < side.h; y++) for (let x = 0; x < side.w; x++) if (side.cells[x + side.w * y]) {
      const xc = side.ox + (x + 0.5) * side.size, yc = side.oy + (y + 0.5) * side.size;
      if (keep && !keep(x, y, yc)) continue;
      g.fillRect(fr.px(xc - side.size / 2), fr.py(yc + side.size / 2), side.size * fr.sc + 0.6, side.size * fr.sc + 0.6);
    }
  };
  const label = (g: CanvasRenderingContext2D, t: string, x: number, y: number, c = INK, align: CanvasTextAlign = "left") => { g.fillStyle = c; g.font = "600 13px system-ui"; g.textAlign = align; g.fillText(t, x, y); };
  const dot = (g: CanvasRenderingContext2D, x: number, y: number, r: number, c: string, fill = true) => { g.beginPath(); g.arc(x, y, r, 0, 7); if (fill) { g.fillStyle = c; g.fill(); } else { g.strokeStyle = c; g.lineWidth = 2; g.stroke(); } };

  function drawSide(s: Stages) {
    const g = $<HTMLCanvasElement>("lcol-side").getContext("2d")!, fr = frame(s), p = s.profile;
    g.clearRect(0, 0, W, H);
    const bandY = p.top - p.band, inBand = (_x: number, _y: number, yc: number) => yc >= bandY;
    const leg: string[] = [];
    if (step === 1) {
      g.fillStyle = BLUE;
      const pos = s.scaled.positions, ax = p.axis === "x" ? 0 : 2;
      for (let i = 0; i < pos.length; i += 3) g.fillRect(fr.px(pos[i + ax]) - 1, fr.py(pos[i + 1]) - 1, 2, 2);
      leg.push(`<span class="sw" style="background:${BLUE}"></span>${(pos.length / 3).toLocaleString()} mesh points, seen from the side, scaled to 2.2 m tall`);
    } else if (step === 2) { cells(g, fr, s.side.raw, BLUE); leg.push(`<span class="sw" style="background:${BLUE}"></span>cells the surface touches (${s.counts.raw.toLocaleString()})`); }
    else if (step === 3) { cells(g, fr, s.side.closed, TEAL); cells(g, fr, s.side.raw, "#0b4f44"); const rawSet = s.side.raw; cells(g, fr, { ...s.side.closed, cells: s.side.closed.cells.map((v, i) => (v && !rawSet.cells[i] ? 1 : 0)) as Uint8Array }, ORANGE); leg.push(`<span class="sw" style="background:#0b4f44"></span>cells from step 2 <span class="sw" style="background:${ORANGE};margin-left:10px"></span>cells closing filled (${s.counts.filled}; a cell counts once per side-on column, so a few hide behind others)`); }
    else if (step === 4) { cells(g, fr, s.side.kept, TEAL); cells(g, fr, { ...s.side.closed, cells: s.side.closed.cells.map((v, i) => (v && !s.side.kept.cells[i] ? 1 : 0)) as Uint8Array }, RED); leg.push(`<span class="sw" style="background:${TEAL}"></span>the biggest piece (${s.counts.kept.toLocaleString()} cells) <span class="sw" style="background:${RED};margin-left:10px"></span>dropped (${s.counts.dropped} cells in ${Math.max(0, s.counts.pieces - 1)} other pieces)`); }
    else {
      cells(g, fr, s.side.kept, PALE);
      cells(g, fr, s.side.kept, TEAL, inBand);
      g.setLineDash([6, 4]); g.strokeStyle = ORANGE; g.lineWidth = 1.5;
      for (const y of [p.top, bandY]) { g.beginPath(); g.moveTo(0, fr.py(y)); g.lineTo(W, fr.py(y)); g.stroke(); }
      g.setLineDash([]);
      label(g, `top band, ${f(p.band, 1)} m`, W - 8, fr.py(bandY) + 16, ORANGE, "right");
      leg.push(`<span class="sw" style="background:${TEAL}"></span>cells in the top band <span class="sw" style="background:${PALE};margin-left:10px"></span>cells that are not looked at`);
      if (step >= 6) {
        g.lineWidth = 1;
        for (const i of p.cand) { const x = fr.px(p.a0 + (i + 0.5) * s.voxel); g.strokeStyle = p.kept.includes(i) ? INK : GREY; g.setLineDash(p.kept.includes(i) ? [] : [3, 4]); g.beginPath(); g.moveTo(x, fr.py(p.top) - 12); g.lineTo(x, fr.py(p.top) + 40); g.stroke(); }
        g.setLineDash([]);
        p.kept.forEach((_, k) => label(g, String(k + 1), fr.px(p.mid + p.peakU[k]), fr.py(p.top) - 16, INK, "center"));
        leg.push(`<span class="sw" style="background:${INK}"></span>rung peaks kept (${p.kept.length}) <span class="sw" style="background:${GREY};margin-left:10px"></span>peaks dropped as too close or an end post (${p.cand.length - p.kept.length})`);
      }
      if (step >= 7 && cmp) {
        const fit = cmp.fit, unit = fit.stride > 1 ? fit.fitGap : fit.gap, ry = fr.py(s.run.y);
        for (let i = 0; i < (fit.n - 1) * fit.stride + 1; i++) dot(g, fr.px(p.mid + fit.first + i * unit), ry + 30, 5, ORANGE, false);
        for (let i = 0; i < fit.n; i++) { const x = fr.px(p.mid + fit.first + i * fit.gap); dot(g, x, ry + 30, 6, TEAL); }
        for (const u of cmp.peaks) { const x = fr.px(p.mid + u); g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.moveTo(x, fr.py(p.top) + 40); g.lineTo(x, ry + 24); g.stroke(); }
        leg.push(`<span class="sw" style="background:${TEAL}"></span>the fitted rungs <span class="sw" style="background:#fff;border:2px solid ${ORANGE};margin-left:10px;box-sizing:border-box"></span>the fitted unit places (${f(fit.fitGap)} m apart; every ${fit.stride === 1 ? "one" : `${fit.stride}th one`} is a rung)`);
      }
      if (step >= 8 && cmp) {
        const r = cmp.run, rr = Math.max(3, s.measure.radius * fr.sc), yy = fr.py(r.y + s.measure.radius);
        for (let i = 0; i < r.n; i++) dot(g, fr.px(p.mid + r.x + i * r.gap), yy, rr, ORANGE);
        g.strokeStyle = INK; g.lineWidth = 1.5; const xh = fr.px(p.a0) - 2;
        g.beginPath(); g.moveTo(xh, fr.py(p.bottom)); g.lineTo(xh, yy); g.stroke(); label(g, `y ${f(r.y, 2)} m`, xh + 6, (fr.py(p.bottom) + yy) / 2, INK);
        leg.push(`<span class="sw" style="background:${ORANGE}"></span>the BarRun: rung radius ${f(s.measure.radius, 3)} m, drawn big enough to see`);
      }
    }
    $("lcol-legend").innerHTML = leg.join(" ");
  }

  function drawChart(s: Stages) {
    const c = $<HTMLCanvasElement>("lcol-chart"), g = c.getContext("2d")!, p = s.profile;
    g.clearRect(0, 0, W, CH);
    const pad = 28, base = CH - 26;
    const bars = (vals: number[], max: number, cols: (i: number) => string, lab: (i: number) => string) => {
      const bw = (W - 2 * pad) / vals.length;
      vals.forEach((v, i) => { const h = (v / max) * (base - 24); g.fillStyle = cols(i); g.fillRect(pad + i * bw + 1, base - h, Math.max(1, bw - 2), h); const t = lab(i); if (t) label(g, t, pad + (i + 0.5) * bw, CH - 8, INK, "center"); });
      return bw;
    };
    if (step <= 4) {
      const v = [s.counts.raw, s.counts.closed, s.counts.kept], names = ["voxelised", "after closing holes", "after keeping the biggest piece"];
      bars(v, Math.max(...v) * 1.1, (i) => [BLUE, TEAL, "#0b4f44"][i], (i) => `${names[i]}: ${v[i].toLocaleString()} cells`);
    } else if (step <= 6) {
      const bw = bars(p.sm, p.max * 1.1, (i) => (p.kept.includes(i) ? INK : p.cand.includes(i) ? GREY : PALE), () => "");
      const y = (v: number) => base - (v / (p.max * 1.1)) * (base - 24);
      g.setLineDash([6, 4]); g.lineWidth = 1.5;
      g.strokeStyle = ORANGE; g.beginPath(); g.moveTo(pad, y(p.thr)); g.lineTo(W - pad, y(p.thr)); g.stroke();
      g.strokeStyle = BLUE; g.beginPath(); g.moveTo(pad, y(p.base)); g.lineTo(W - pad, y(p.base)); g.stroke(); g.setLineDash([]);
      label(g, `peak line ${f(p.thr, 1)} = median ${f(p.base, 1)} + 40% of the way to the biggest ${f(p.max, 1)}`, pad + 4, 16, ORANGE);
      label(g, `cells in the top band, per slice along the row (${p.cols} slices of ${Math.round(s.voxel * 100)} cm)`, W / 2, CH - 8, INK, "center");
      void bw;
    } else {
      const rows = gapTable(p.peakU);
      if (!rows.length) { label(g, "fewer than two peaks", W / 2, CH / 2, INK, "center"); return; }
      const max = Math.max(...rows.map((r) => r.raw), rows[0].unit * 2) * 1.15, bw = (W - 2 * pad) / rows.length, y = (v: number) => base - (v / max) * (base - 24);
      rows.forEach((r, i) => { g.fillStyle = r.units === 1 ? TEAL : ORANGE; const h = (r.raw / max) * (base - 24); g.fillRect(pad + i * bw + 4, base - h, bw - 8, h); label(g, `${f(r.raw, 2)} = ${r.units}x`, pad + (i + 0.5) * bw, base - h - 4, INK, "center"); label(g, `${i + 1}-${i + 2}`, pad + (i + 0.5) * bw, CH - 8, INK, "center"); });
      g.setLineDash([6, 4]); g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.moveTo(pad, y(rows[0].unit)); g.lineTo(W - pad, y(rows[0].unit)); g.stroke(); g.setLineDash([]);
      label(g, `raw gap between neighbouring peaks (m) = how many unit gaps (${f(rows[0].unit)} m). Orange: a double gap, so a rung was missed or the rungs are two cells thick.`, pad + 2, 16, INK);
    }
  }

  function drawCmp(s: Stages) {
    const g = $<HTMLCanvasElement>("lcol-cmp").getContext("2d")!, p = s.profile;
    g.clearRect(0, 0, W, CH);
    if (!cmp) return;
    const fit = cmp.fit;
    const x0 = p.mid - (p.a1 - p.a0) / 2 - 0.2, sc = (W - 24) / (p.a1 - p.a0 + 0.4), px = (u: number) => 12 + (p.mid + u - x0) * sc;
    const base = compareBreak(s, { ...brk, kind: "none" }), truth = Array.from({ length: base.fit.n }, (_, i) => base.fit.first + i * base.fit.gap);
    const rows: [string, number[], string][] = [["truth: the unbroken fitted row", truth, GREY], ["copies the mesh: rungs where the peaks are", cmp.peaks, ORANGE], ["fitted row", Array.from({ length: fit.n }, (_, i) => fit.first + i * fit.gap), TEAL]];
    rows.forEach(([name, xs, c], r) => { const y = 36 + r * 48; g.strokeStyle = PALE; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); label(g, `${name} (${xs.length} rungs)`, 12, y - 16, INK); xs.forEach((u) => dot(g, px(u), y, 6, c)); });
  }

  function drawSim() {
    const c = $<HTMLCanvasElement>("lcol-sim"), g = c.getContext("2d")!;
    g.clearRect(0, 0, W, H);
    if (!cmp || !played) return;
    const course = courseFor(cmp.run), x0 = -3, x1 = course.finishX + 3, sc = (W - 24) / (x1 - x0), px = (x: number) => 12 + (x - x0) * sc, y0 = H - 40, py = (y: number) => y0 - y * sc * 1.0;
    g.fillStyle = "#cbd5cd"; for (const pl of course.terrain.platforms) g.fillRect(px(pl.x0), py(pl.top), (pl.x1 - pl.x0) * sc, 40);
    g.fillStyle = "#b7d3ee"; g.fillRect(px(9), py(0) + 2, (course.terrain.platforms[1].x0 - 9) * sc, 38);
    g.strokeStyle = GREY; g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); (baseline?.xs ?? []).forEach((x, i) => { const X = px(x), Y = py(baseline!.ys[i]); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.stroke(); g.setLineDash([]);
    const run = course.bars![0];
    for (let i = 0; i < run.n; i++) dot(g, px(run.x + i * run.gap), py(run.y), 5, ORANGE);
    const use = searched ?? played, col = use.cleared ? TEAL : RED;
    g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath(); use.xs.forEach((x, i) => { const X = px(x), Y = py(use.ys[i]); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.stroke();
    const t = Math.min(Number($<HTMLInputElement>("lcol-tick").value), use.xs.length - 1);
    dot(g, px(use.xs[t]), py(use.ys[t]) - 8, 8, col);
    label(g, "start", px(0), py(0) + 28, INK, "center"); label(g, "finish", px(course.finishX), py(0) + 28, INK, "center");
  }

  // ---- the page ----
  function table(s: Stages) {
    const m = s.measure, c = s.counts, p = s.profile, r = cmp!.run;
    const rows: string[] = [
      `${(s.scaled.positions.length / 3).toLocaleString()} points, scaled by ${f(s.scale, 4)} to 2.2 m tall`,
      `${c.raw.toLocaleString()} cells of ${Math.round(s.voxel * 100)} cm`,
      `${c.filled} cells filled, ${c.closed.toLocaleString()} cells`,
      `${c.pieces} piece${c.pieces === 1 ? "" : "s"}, ${c.dropped} cells dropped, ${c.kept.toLocaleString()} kept`,
      `rows along ${p.axis}, band ${f(p.band, 1)} m, height from ${f(p.bottom, 2)} to ${f(p.top, 2)} m`,
      `${p.cand.length} peaks, ${p.kept.length} kept; raw gaps ${f(Math.min(...m.gaps), 2)} to ${f(Math.max(...m.gaps), 2)} m`,
      `unit ${f(cmp!.fit.fitGap)} m, every ${cmp!.fit.stride === 1 ? "one" : cmp!.fit.stride + "th"} rung used: ${r.n} rungs, ${f(r.gap)} m apart`,
      `{ x: ${f(r.x)}, y: ${f(r.y, 2)}, n: ${r.n}, gap: ${f(r.gap)} }`,
      played ? (played.cleared ? `the recorded keys clear it in ${played.ticks} ticks` : `the recorded keys do not clear this row`) : "",
    ];
    $("lcol-all").innerHTML = STEPS.map((x, i) => `<tr data-step="${x.id}" class="${x.id === step ? "cur" : ""}"><td>${x.id}</td><td>${x.name}</td><td>${rows[i]}</td></tr>`).join("");
    $("lcol-all").querySelectorAll("tr").forEach((tr) => tr.addEventListener("click", () => { step = Number((tr as HTMLElement).dataset.step); show(); }));
  }

  function facts(s: Stages) {
    const m = s.measure, r = cmp!.run, fit = cmp!.fit, c = s.counts;
    const d: [string, string][] = [];
    if (step === 1) d.push(["Triangles", String(Math.round((s.scaled.indices?.length ?? 0) / 3)).replace(/\B(?=(\d{3})+$)/g, ",")], ["Scale used", f(s.scale, 4)]);
    if (step === 2 || step === 3 || step === 4) d.push(["Cells voxelised", c.raw.toLocaleString()], ["Cells after closing", c.closed.toLocaleString()], ["Pieces", String(c.pieces)], ["Cells dropped", String(c.dropped)], ["Cells kept", c.kept.toLocaleString()]);
    if (step === 5 || step === 6) d.push(["Axis (the way the row runs)", s.profile.axis], ["Span", `${f(m.span, 2)} m`], ["Slices", String(s.profile.cols)], ["Peaks / kept", `${s.profile.cand.length} / ${s.profile.kept.length}`]);
    if (step === 7) d.push(["Unit gap (median of rounded gaps)", `${f(fit.fitGap)} m`], ["Places on the row", String((fit.n - 1) * fit.stride + 1)], [`Smaller than ${GAP_MIN} m?`, fit.stride > 1 ? `yes: every ${fit.stride}th rung is used` : "no"], [`Bigger than ${GAP_MAX} m?`, fit.gap > GAP_MAX ? "yes, held at the limit" : "no"]);
    if (step >= 8) d.push(["x (first rung from the middle)", `${f(r.x)} m`], ["y (rung height)", `${f(r.y, 2)} m`], ["n (rungs)", String(r.n)], ["gap (spacing)", `${f(r.gap)} m`], ["Notes from the code", [...m.notes, ...fit.notes].filter((v, i, a) => a.indexOf(v) === i).join("; ") || "none"]);
    $("lcol-facts").innerHTML = d.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  }

  function verdict() {
    const cp = cmp!.copied, ft = cmp!.fitted;
    $("lcol-cmp-t").innerHTML = `
      <tr><td>Rungs</td><td>${cp.rungs}</td><td>${ft.rungs}</td></tr>
      <tr><td>Gaps between rungs</td><td>${f(cp.gapMin, 2)} to ${f(cp.gapMax, 2)} m (spread ${f(cp.gapStd, 3)})</td><td>all ${f(ft.gap)} m (spread 0)</td></tr>
      <tr><td>Gaps the editor would not allow (${GAP_MIN} to ${GAP_MAX} m)</td><td>${cp.outsideEditor} of ${Math.max(0, cp.rungs - 1)}</td><td>${ft.outsideEditor} of 1</td></tr>
      <tr><td>Worst distance from a true rung</td><td>${f(cp.worstPlace, 2)} m</td><td>${f(ft.worstPlace, 2)} m</td></tr>`;
    const same = cmp!.sameAsGame, game = compareBreak(st!, { ...brk, kind: "none" }).run;
    $("lcol-verdict").innerHTML = brk.kind === "none" ? "Nothing is broken: the fitted row is the game's row." : same
      ? `<span class="good">The fitted row did not change.</span> The broken lift still gives ${cmp!.run.n} rungs ${f(cmp!.run.gap)} m apart, the same row as the unbroken lift. A collider that copies the mesh keeps the break: ${cp.rungs} rungs, gaps from ${f(cp.gapMin, 2)} to ${f(cp.gapMax, 2)} m.`
      : `<span class="bad">The fitted row changed.</span> It is still perfectly regular (one spacing), but it is ${cmp!.run.n} rungs ${f(cmp!.run.gap)} m apart, not the game's ${game.n} rungs ${f(game.gap)} m. Regular does not always mean right: see the limits in the doc.`;
  }

  function simSays() {
    const base = baseline, b = played;
    const parts = [base ? `The game's row with the recorded keys: ${base.cleared ? "cleared" : "not cleared"} in ${base.ticks} ticks (grey).` : ""];
    if (b) parts.push(`This row with the same keys: ${b.cleared ? `<span class="good">cleared</span> in ${b.ticks} ticks` : `<span class="bad">not cleared</span>`}.`);
    if (searched) parts.push(`A new search for this row: ${searched.cleared ? `<span class="good">found a clear run</span>, ${searched.ticks} ticks` : `<span class="bad">found no clear run</span>`}.`);
    $("lcol-sim-says").innerHTML = parts.join(" ") + " The recorded keys are the ideal-run search's plan for the game's row (public/assets/demo/bars-lift.run.json).";
    const use = searched ?? b;
    const tk = $<HTMLInputElement>("lcol-tick"); tk.max = String(Math.max(1, (use?.xs.length ?? 2) - 1)); $("lcol-tick-v").textContent = tk.value;
  }

  function show() {
    if (!st || !cmp) return;
    const s = STEPS[step - 1];
    $("lcol-title").textContent = `Step ${s.id} of 9: ${s.name}`; $("lcol-does").textContent = s.does;
    $("lcol-steps").innerHTML = STEPS.map((x) => `<button aria-pressed="${x.id === step}" data-step="${x.id}">${x.id}. ${x.name}</button>`).join("");
    $("lcol-steps").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { step = Number((b as HTMLElement).dataset.step); show(); }));
    ($("lcol-prev") as HTMLButtonElement).disabled = step <= 1; ($("lcol-next") as HTMLButtonElement).disabled = step >= 9;
    drawSide(st); drawChart(st); facts(st); table(st); drawCmp(st); verdict(); simSays(); drawSim();
  }

  function recompute() {
    if (!mesh) return;
    if (!st || st.voxel !== voxel) st = runStages(mesh, { voxel });
    const maxIdx = Math.max(0, st.profile.peakU.length - 3);
    const idx = $<HTMLInputElement>("lcol-idx"); idx.max = String(maxIdx); brk.index = Math.min(brk.index, maxIdx); idx.value = String(brk.index);
    cmp = compareBreak(st, brk);
    played = playKeys(courseFor(cmp.run), log); searched = null;
    $("lcol-vox-v").textContent = `${Math.round(voxel * 100)} cm`; $("lcol-idx-v").textContent = `${brk.index + 1}`; $("lcol-sig-v").textContent = `${Math.round(brk.sigma * 100)} cm`; $("lcol-seed-v").textContent = String(brk.seed);
    $("lcol-idx-row").hidden = !(["missed", "split", "fused"] as BreakKind[]).includes(brk.kind); $("lcol-sig-row").hidden = brk.kind !== "noise"; $("lcol-seed-row").hidden = brk.kind !== "noise";
    $("lcol-brk-says").textContent = BREAKS.find((b) => b.kind === brk.kind)!.says;
    show();
  }

  $("lcol-brk").innerHTML = BREAKS.map((b) => `<option value="${b.kind}">${b.name}</option>`).join("");
  ($("lcol-brk") as HTMLSelectElement).value = brk.kind;
  ($("lcol-sig") as HTMLInputElement).value = String(brk.sigma * 100); ($("lcol-seed") as HTMLInputElement).value = String(brk.seed); ($("lcol-vox") as HTMLInputElement).value = String(voxel);
  $("lcol-brk").addEventListener("change", () => { brk.kind = ($("lcol-brk") as HTMLSelectElement).value as BreakKind; recompute(); });
  $("lcol-idx").addEventListener("input", () => { brk.index = Number(($("lcol-idx") as HTMLInputElement).value); recompute(); });
  $("lcol-sig").addEventListener("input", () => { brk.sigma = Number(($("lcol-sig") as HTMLInputElement).value) / 100; recompute(); });
  $("lcol-seed").addEventListener("input", () => { brk.seed = Number(($("lcol-seed") as HTMLInputElement).value); recompute(); });
  $("lcol-vox").addEventListener("input", () => { $("lcol-vox-v").textContent = `${Math.round(Number(($("lcol-vox") as HTMLInputElement).value) * 100)} cm`; });
  $("lcol-vox").addEventListener("change", () => { voxel = Number(($("lcol-vox") as HTMLInputElement).value); setTimeout(recompute, 20); });
  $("lcol-prev").addEventListener("click", () => { step = Math.max(1, step - 1); show(); });
  $("lcol-next").addEventListener("click", () => { step = Math.min(9, step + 1); show(); });
  $("lcol-tick").addEventListener("input", () => { $("lcol-tick-v").textContent = ($("lcol-tick") as HTMLInputElement).value; drawSim(); });
  $("lcol-search").addEventListener("click", () => {
    const b = $("lcol-search") as HTMLButtonElement; b.disabled = true; b.textContent = "Searching...";
    setTimeout(() => {
      const course = courseFor(cmp!.run), found = searchIdealRun(course), tr = trackFromPlan(course, found.plan);
      searched = { cleared: found.cleared, ticks: tr.ticks, xs: Array.from(tr.xs), ys: Array.from(tr.ys) };
      b.disabled = false; b.textContent = "Search a new run for this row (about 5 seconds)"; simSays(); drawSim();
    }, 30);
  });
  $("lcol-eq-btn").addEventListener("click", () => {
    const e = $("lcol-eq"); e.hidden = !e.hidden;
    e.textContent = `Peaks p_0..p_m (metres). Gaps d_i = p_(i+1) - p_i.
Unit u = median of ( d_i / round(d_i / median(d)) ).
Place of peak i: k_i = k_(i-1) + max(1, round(d_(i-1) / u)).
Least squares through (k_i, p_i): gap = sum((k - mean k)(p - mean p)) / sum((k - mean k)^2); first = mean p - gap * mean k.
Rung i sits at first + i * gap. If gap < ${GAP_MIN} m use every ceil(${GAP_MIN} / gap)-th rung; if gap > ${GAP_MAX} m hold it at ${GAP_MAX} m.`;
  });

  void (async () => {
    try {
      const [buf, course, run] = await Promise.all([fetch(GLB_URL).then((r) => r.arrayBuffer()), fetch(DEMO_COURSE_URL).then((r) => r.json()), fetch(DEMO_RUN_URL).then((r) => r.json())]);
      mesh = readGlbMesh(buf); log = run.log as InputLog; baseline = playKeys(course, log);
      recompute();
      mountSkinCollider(wrap, () => labPopulated("lab-collision"));
    } catch (e) {
      $("lcol-title").textContent = "The lift could not be loaded"; $("lcol-does").textContent = String(e);
    }
  })();
  return { backend: "canvas2d" };
}
