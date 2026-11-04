import * as THREE from "three/webgpu";
import { createStage } from "../../render/scene";
import { loadRookie, type PosedRookie } from "../../render/rookie";
import { clipToWorld } from "../../motion/pose";
import { legLength } from "../../motion/timeline";
import {
  CLIPS, DEFAULT_CHOICE, FILTERS, GATE_LIMITS, MAX_STRENGTH, clampChoice, expAlpha, failures, gainAt, kernel, noiseGain, runGameSetting, runSignalLab,
  type Frames, type GateReport, type LabChoice, type Result, type SignalClip,
} from "../../lab/signal-lab";

// The Signal processing panel (smoothing choices, the joint before and after, the filter's gain, the Rookie, the gate table, what the game does, the maths).
// One module, mounted by Signal processing (src/modes/lab-signal.ts) and by Video to motion (src/modes/lab-motion.ts, Smoothing and Gate steps), so there is one copy of every widget.
// Signal processing. The player smooths a captured clip that has a little measurement noise added (the truth is known),
// and reads jitter against lag, and foot sliding, on the real gate numbers. Nothing here talks or grades: it shows numbers and pictures.
// The Rookie plays the result only if it passes the plausibility gate. Behind the labs switch (?labs=1).
// Signal processing. The player smooths a captured clip that has a little measurement noise added (the truth is known),
// and reads jitter against lag, and foot sliding, on the real gate numbers. Nothing here talks or grades: it shows numbers and pictures.
// The Rookie plays the result only if it passes the plausibility gate. Behind the labs switch (?labs=1).
const INK = "#17201d", TEAL = "#0f6b5c", GREY = "#a7b0ab", DARK = "#33403a", BAD = "#b91c1c", AMBER = "#b45309";
const RULE_WORDS: Record<string, string> = {
  knees_bend_forward: "Knees bend forward", legs_not_twisted: "Legs not twisted", knees_within_range: "Knees bend a possible amount", flight_is_ballistic: "A jump follows gravity",
  held_clips_are_held: "Something holds the body", feet_dont_sink: "Feet stay above the floor", no_teleport: "No sudden jumps in place", bones_keep_length: "Bones keep their length",
  feet_dont_slide: "Planted feet do not slide", no_jitter: "No jitter (peak acceleration)",
};
const UNITS: Record<string, [number, string]> = { knees_bend_forward: [1, "deg"], legs_not_twisted: [1, "deg"], knees_within_range: [1, "deg"], flight_is_ballistic: [1, "m/s2"], held_clips_are_held: [1, "s"], feet_dont_sink: [100, "cm"], no_teleport: [1, "m/s"], bones_keep_length: [100, "%"], feet_dont_slide: [100, "cm"], no_jitter: [1, "m/s2"] };
const LIMITS: Record<string, string> = {
  knees_bend_forward: "under 120", legs_not_twisted: "at most 60", knees_within_range: "at most 165", flight_is_ballistic: "9.81 within 15%", held_clips_are_held: "at most 1", feet_dont_sink: "at most 3",
  no_teleport: "at most 12", bones_keep_length: "at most 2", feet_dont_slide: "at most 3", no_jitter: `at most ${GATE_LIMITS.maxAccel}`,
};
const JOINTS: { id: string; label: string; joint: string; axis: 0 | 1 | 2; foot: boolean }[] = [
  { id: "hipsY", label: "Hips, height", joint: "Hips", axis: 1, foot: false },
  { id: "footY", label: "Right foot, height", joint: "RightFoot", axis: 1, foot: true },
  { id: "footZ", label: "Right foot, forward", joint: "RightFoot", axis: 2, foot: true },
  { id: "handY", label: "Right hand, height", joint: "RightHand", axis: 1, foot: false },
];

export interface SignalPanelOptions { rookie: boolean; markPage: boolean }
/** Build the panel inside `host`. `start()` loads the first clip and runs it; with rookie off the 3D view is replaced by a text line (Video to motion plays its own Rookie in step 5). */
export function mountSignalPanel(host: HTMLElement, opts: SignalPanelOptions): { start: (beforeFirstRun?: () => void) => Promise<void>; root: HTMLElement } {
  if (!document.getElementById("sg-panel-style")) { const st = document.createElement("style"); st.id = "sg-panel-style"; st.textContent = `
.sg-panel h2{font-size:15px;margin:0 0 6px}
    .sg-panel .grid{display:grid;grid-template-columns:minmax(260px,330px) minmax(0,1fr);gap:14px;align-items:start}
    .sg-panel .card{background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:12px}
    .sg-panel label{display:grid;gap:2px;margin:8px 0}.sg-panel input[type=range]{width:100%}
    .sg-panel select{font:14px system-ui;padding:6px;border:1px solid #b9c4bb;border-radius:6px;background:#fff;color:${INK}}
    .sg-panel .meth{display:grid;grid-template-columns:1fr 1fr;gap:6px}
    .sg-panel .meth button,.sg-panel .tog button{font:600 13px system-ui;padding:8px;border:1px solid #b9c4bb;border-radius:8px;background:#fff;color:${INK};cursor:pointer}
    .sg-panel [aria-pressed=true]{border-color:${TEAL}!important;background:#e6f2ee!important}
    .sg-panel .facts{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:0}
    .sg-panel .facts dt{color:#52605a}.sg-panel .facts dd{margin:0;font-weight:600}
    .sg-panel table{border-collapse:collapse;width:100%;font-size:13px}.sg-panel th,.sg-panel td{text-align:left;padding:3px 8px 3px 0;border-bottom:1px solid #e3e8e4}
    .sg-panel td.n,.sg-panel th.n{text-align:right;font-variant-numeric:tabular-nums}
    .sg-panel .small{color:#52605a;font-size:13px}
    .sg-panel .eq{font:14px/1.6 ui-monospace,Menlo,monospace;background:#f1f4f1;border-radius:8px;padding:8px 10px;white-space:pre-wrap;overflow-x:auto}
    .sg-panel .bad{color:${BAD};font-weight:700}.sg-panel .ok{color:${TEAL};font-weight:700}
    .sg-panel button.link{background:none;border:0;color:${TEAL};font:600 14px system-ui;cursor:pointer;padding:0;text-decoration:underline}
    .sg-panel .two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}
    .sg-panel #sg-view{width:100%;height:300px;border-radius:6px;overflow:hidden;position:relative;background:#9fc5e8}
    .sg-panel #sg-held{position:absolute;inset:0;display:none;align-items:center;justify-content:center;text-align:center;padding:16px;background:rgba(245,247,244,.94);font-weight:700;color:${BAD}}
  `; document.head.appendChild(st); }
  const panel = document.createElement("div"); panel.className = "sg-panel"; host.append(panel);
  panel.innerHTML = `
    <div class="grid">
      <div class="card" id="sg-controls">
        <h2>Your choices</h2>
        <label>Clip<select id="sg-clip"></select></label>
        <div class="meth" id="sg-kinds" role="group" aria-label="Filter"></div>
        <p class="small" id="sg-about" style="margin:6px 0"></p>
        <label>Strength: <b id="sg-s-v"></b><input id="sg-s" type="range" min="0" max="${MAX_STRENGTH}" step="1"></label>
        <label>Wobble added to the capture: <b id="sg-n-v"></b><input id="sg-n" type="range" min="0" max="4" step="0.5"></label>
        <label style="display:flex;gap:8px;align-items:center"><input id="sg-fix" type="checkbox"> Then give every bone one length (the game does)</label>
        <label>Joint to plot<select id="sg-joint"></select></label>
      </div>
      <div style="display:grid;gap:14px;min-width:0">
        <div class="two">
          <div class="card"><h2>The joint, before and after</h2>
            <canvas id="sg-trace" width="560" height="260" style="width:100%;height:auto;display:block;border-radius:6px;background:#f6f9f6"></canvas>
            <p class="small" style="margin:6px 0 0"><span style="color:${GREY}">Grey: what was measured.</span> <span style="color:${DARK}">Dark dashes: the true move.</span> <span style="color:${TEAL}">Teal: after your filter.</span> Blue bands: the foot is planted.</p></div>
          <div class="card"><h2>What the filter lets through</h2>
            <canvas id="sg-gain" width="560" height="260" style="width:100%;height:auto;display:block;border-radius:6px;background:#f6f9f6"></canvas>
            <p class="small" style="margin:6px 0 0" id="sg-gain-note"></p></div>
        </div>
        <div class="two">
          <div class="card"><h2>The clip on the Rookie</h2>
            <div id="sg-view"><div id="sg-held"></div></div>
            <div class="tog" style="display:flex;gap:6px;margin-top:6px;align-items:center"><button id="sg-after" aria-pressed="true">After the filter</button><button id="sg-before" aria-pressed="false">Before (measured)</button><span class="small" id="sg-gate-line"></span></div></div>
          <div class="card" id="sg-out"><h2>What happened</h2><dl class="facts" id="sg-facts"></dl></div>
        </div>
        <div class="card"><h2>The gate, rule by rule</h2><table><thead><tr><th>Rule</th><th>Limit</th><th class="n">Clean clip</th><th class="n">Measured</th><th class="n">After filter</th></tr></thead><tbody id="sg-gate"></tbody></table>
          <p class="small" style="margin:6px 0 0">Hard rules decide if a clip may be shown. Soft rules are reported. Numbers are the gate's own, in cm, degrees, m/s or m/s2.</p></div>
        <div class="card" id="sg-ours"><h2>What the game does</h2><p id="sg-ours-p" style="margin:0 0 8px"></p><table><thead><tr><th>Setting</th><th class="n">Wobble left (cm)</th><th class="n">Late (ms)</th><th class="n">Shape lost (cm)</th><th class="n">Peak accel (m/s2)</th><th class="n">Foot slide (cm)</th><th>Gate</th></tr></thead><tbody id="sg-cmp"></tbody></table></div>
        <div class="card"><h2>The maths</h2><button class="link" id="sg-eq-btn">Show the equations behind your setting</button><div class="eq" id="sg-eq-body" hidden></div></div>
      </div>
    </div>`;
  if (!opts.rookie) { const p = document.createElement("p"); p.id = "sg-held"; p.className = "small"; p.style.cssText = "margin:0;font-weight:600"; p.textContent = "Video to motion plays the result on the Rookie in step 5."; panel.querySelector("#sg-view")!.replaceWith(p); }
  const $ = <T extends HTMLElement>(id: string): T => panel.querySelector("#" + id) as T;
  const choice: LabChoice = { ...DEFAULT_CHOICE };
  const clips = new Map<string, SignalClip>();
  let result: Result | null = null;
  let runs = 0;
  let showBefore = false;
  let joint = JOINTS[0];

  // ---------- controls ----------
  const clipSel = $<HTMLSelectElement>("sg-clip"), jointSel = $<HTMLSelectElement>("sg-joint");
  clipSel.innerHTML = CLIPS.map((c) => `<option value="${c.id}">${c.label}</option>`).join("");
  jointSel.innerHTML = JOINTS.map((j) => `<option value="${j.id}">${j.label}</option>`).join("");
  clipSel.value = choice.clip;
  const syncControls = () => {
    const kinds = $("sg-kinds"); kinds.innerHTML = "";
    for (const f of FILTERS) {
      const b = document.createElement("button"); b.type = "button"; b.textContent = f.label; b.dataset.kind = f.kind; b.setAttribute("aria-pressed", String(choice.kind === f.kind));
      b.onclick = () => { choice.kind = f.kind; syncControls(); run(); };
      kinds.append(b);
    }
    $("sg-about").textContent = FILTERS.find((f) => f.kind === choice.kind)!.about;
    $("sg-s-v").textContent = choice.strength === 0 ? "0 (off)" : choice.kind === "exponential" ? `${choice.strength} (weight ${expAlpha(choice.strength).toFixed(2)})` : `${choice.strength} (looks ${choice.strength} frames each way)`;
    $("sg-n-v").textContent = `${choice.noiseCm.toFixed(1)} cm`;
    $<HTMLInputElement>("sg-s").value = String(choice.strength);
    $<HTMLInputElement>("sg-n").value = String(choice.noiseCm);
    $<HTMLInputElement>("sg-fix").checked = choice.fixBones;
  };
  $<HTMLInputElement>("sg-s").addEventListener("input", (e) => { choice.strength = Number((e.target as HTMLInputElement).value); syncControls(); run(); });
  $<HTMLInputElement>("sg-n").addEventListener("input", (e) => { choice.noiseCm = Number((e.target as HTMLInputElement).value); syncControls(); run(); });
  $<HTMLInputElement>("sg-fix").addEventListener("change", (e) => { choice.fixBones = (e.target as HTMLInputElement).checked; run(); });
  clipSel.onchange = () => { choice.clip = clipSel.value; load(choice.clip).then(run); };
  jointSel.onchange = () => { joint = JOINTS.find((j) => j.id === jointSel.value)!; if (result) drawTrace(); };
  $("sg-after").onclick = () => { showBefore = false; updateToggle(); showGateState(); };
  $("sg-before").onclick = () => { showBefore = true; updateToggle(); showGateState(); };
  const updateToggle = () => { $("sg-after").setAttribute("aria-pressed", String(!showBefore)); $("sg-before").setAttribute("aria-pressed", String(showBefore)); };
  syncControls();

  async function load(id: string): Promise<SignalClip> {
    if (!clips.has(id)) {
      const file = CLIPS.find((c) => c.id === id)!.file;
      const raw = await (await fetch(`/assets/motion/${file}.json`)).json();
      clips.set(id, raw as SignalClip);
    }
    return clips.get(id)!;
  }

  // ---------- pictures ----------
  const T = $<HTMLCanvasElement>("sg-trace"), tg = T.getContext("2d")!;
  const series = (f: Frames, j: number, a: number) => f.map((fr) => fr[j][a]);
  let cursor = 0; // clip seconds, drawn as a line while the Rookie plays
  function drawTrace(): void {
    if (!result) return;
    const clip = clips.get(choice.clip)!, ji = clip.names.indexOf(joint.joint);
    const W = T.width, H = T.height, L = 52, R = 10, Tp = 10, B = 28;
    const ys = [series(result.noisy, ji, joint.axis), series(result.clean, ji, joint.axis), series(result.filtered, ji, joint.axis)];
    let lo = Math.min(...ys.flat()), hi = Math.max(...ys.flat());
    const pad = (hi - lo) * 0.06 + 1e-3; lo -= pad; hi += pad;
    const n = result.clean.length, dur = (n - 1) / result.fps;
    const sx = (t: number) => L + (t / dur) * (W - L - R), sy = (v: number) => H - B - ((v - lo) / (hi - lo)) * (H - B - Tp);
    tg.clearRect(0, 0, W, H);
    tg.font = "12px system-ui"; tg.fillStyle = "#52605a"; tg.strokeStyle = "#dfe6e0"; tg.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { const v = lo + ((hi - lo) * i) / 4; tg.beginPath(); tg.moveTo(L, sy(v)); tg.lineTo(W - R, sy(v)); tg.stroke(); tg.textAlign = "right"; tg.fillText(v.toFixed(2) + " m", L - 4, sy(v) + 4); }
    tg.textAlign = "center";
    for (let t = 0; t <= dur + 1e-6; t += dur > 2.5 ? 0.5 : 0.25) tg.fillText(t.toFixed(2) + " s", sx(t), H - 8);
    if (joint.foot) { // planted frames of the filtered clip: low, and slow
      const f = result.filtered, y = series(f, ji, 1), floorish = Math.min(Math.min(...y) + 0.05, 0.15);
      tg.fillStyle = "rgba(100,150,220,.18)";
      let a = -1;
      for (let t = 0; t <= n; t++) {
        const planted = t < n && y[t] < floorish && Math.hypot(...[0, 1, 2].map((k) => (f[Math.min(n - 1, t + 1)][ji][k] - f[Math.max(0, t - 1)][ji][k]) * result!.fps / 2)) < 1;
        if (planted && a < 0) a = t;
        if (!planted && a >= 0) { if (t - a >= 2) tg.fillRect(sx(a / result.fps), Tp, sx((t - 1) / result.fps) - sx(a / result.fps), H - B - Tp); a = -1; }
      }
    }
    const line = (v: number[], color: string, w: number, dash: number[] = []) => { tg.beginPath(); tg.setLineDash(dash); tg.strokeStyle = color; tg.lineWidth = w; v.forEach((y, i) => (i ? tg.lineTo(sx(i / result!.fps), sy(y)) : tg.moveTo(sx(0), sy(y)))); tg.stroke(); tg.setLineDash([]); };
    line(ys[0], GREY, 1.2); line(ys[1], DARK, 1.5, [5, 4]); line(ys[2], TEAL, 2.5);
    if (cursor > 0) { tg.strokeStyle = AMBER; tg.lineWidth = 1.5; tg.beginPath(); tg.moveTo(sx(Math.min(cursor, dur)), Tp); tg.lineTo(sx(Math.min(cursor, dur)), H - B); tg.stroke(); }
  }
  const Gc = $<HTMLCanvasElement>("sg-gain"), gg = Gc.getContext("2d")!;
  function drawGain(): void {
    if (!result) return;
    const W = Gc.width, H = Gc.height, L = 44, R = 12, Tp = 10, B = 28, nyq = result.fps / 2;
    const sx = (f: number) => L + (f / nyq) * (W - L - R), sy = (g: number) => H - B - g * (H - B - Tp);
    gg.clearRect(0, 0, W, H);
    gg.font = "12px system-ui"; gg.fillStyle = "#52605a"; gg.strokeStyle = "#dfe6e0"; gg.lineWidth = 1;
    for (const g of [0, 0.5, 1]) { gg.beginPath(); gg.moveTo(L, sy(g)); gg.lineTo(W - R, sy(g)); gg.stroke(); gg.textAlign = "right"; gg.fillText(g.toFixed(1), L - 4, sy(g) + 4); }
    gg.textAlign = "center";
    for (let f = 0; f < nyq - 0.5; f += 3) gg.fillText(f + " Hz", sx(f), H - 8);
    gg.strokeStyle = GREY; gg.setLineDash([4, 4]); gg.beginPath(); gg.moveTo(L, sy(Math.SQRT1_2)); gg.lineTo(W - R, sy(Math.SQRT1_2)); gg.stroke(); gg.setLineDash([]);
    gg.beginPath(); gg.strokeStyle = TEAL; gg.lineWidth = 2.5;
    for (let i = 0; i <= 200; i++) { const f = (nyq * i) / 200, g = gainAt(choice.kind, choice.strength, (Math.PI * i) / 200); (i ? gg.lineTo : gg.moveTo).call(gg, sx(f), sy(g)); }
    gg.stroke();
    if (result.cutoffHz !== null) { gg.strokeStyle = AMBER; gg.lineWidth = 1.5; gg.beginPath(); gg.moveTo(sx(result.cutoffHz), Tp); gg.lineTo(sx(result.cutoffHz), H - B); gg.stroke(); gg.fillStyle = AMBER; gg.textAlign = "left"; gg.fillText(`cut-off ${result.cutoffHz.toFixed(1)} Hz`, Math.min(sx(result.cutoffHz) + 4, W - 110), Tp + 12); }
    $("sg-gain-note").textContent = result.cutoffHz === null ? "Strength 0: everything passes, the wobble too." : `Wiggles faster than ${result.cutoffHz.toFixed(1)} per second are cut to under 71%. The move's own wiggles slower than that stay.`;
  }

  // ---------- the Rookie ----------
  let stage: Awaited<ReturnType<typeof createStage>> | null = null;
  let rookie: PosedRookie | null = null;
  let scale = 1;
  let playFrames: Frames | null = null;
  let playFps = 30;
  let t0 = performance.now();
  const viewHost = $("sg-view");
  async function initRookie(clip: SignalClip): Promise<void> {
    try {
      stage = await createStage(viewHost, false);
      stage.renderer.domElement.style.cssText = "width:100%;height:100%;display:block";
      const { scene } = stage;
      scene.background = new THREE.Color(0xbfdcf2);
      for (let i = -4; i <= 40; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 0.8), new THREE.MeshStandardMaterial({ color: i % 5 === 0 ? 0x33403a : 0x9fb59a })); m.position.set(i * 0.5, 0.005, 0); scene.add(m); }
      rookie = await loadRookie("a", clip.names, clip.parents);
      scene.add(rookie.object);
      stage.renderer.setSize(viewHost.clientWidth, viewHost.clientHeight);
      stage.camera.aspect = viewHost.clientWidth / viewHost.clientHeight; stage.camera.updateProjectionMatrix();
      document.documentElement.dataset.signalRookie = "1";
    } catch { rookie = null; $("sg-held").style.display = "flex"; $("sg-held").textContent = "The 3D view needs a graphics-capable browser."; }
  }
  function frameLoop(): void {
    requestAnimationFrame(frameLoop);
    if (!playFrames || !rookie || !stage) { return; }
    const dur = (playFrames.length - 1) / playFps;
    const t = ((performance.now() - t0) / 1000) % (dur + 0.6); // a short pause between loops
    cursor = Math.min(t, dur);
    const fi = Math.min(playFrames.length - 1, Math.round(cursor * playFps));
    const first = playFrames[0], clip = clips.get(choice.clip)!;
    scale = rookie.legLength / legLength(clip.names, (i) => new THREE.Vector3(...first[i]));
    const joints = playFrames[fi].map((p) => clipToWorld(p).multiplyScalar(scale));
    rookie.apply(joints);
    const hx = joints[0].x;
    stage.camera.position.set(hx + 0.3, 1.5, 4.3); stage.camera.lookAt(hx, 0.85, 0);
    drawTrace();
    document.documentElement.dataset.signalFrame = String(fi);
  }
  function showGateState(): void {
    if (!result) return;
    const g: GateReport = showBefore ? result.gateNoisy : result.gateFiltered;
    const held = $("sg-held");
    if (g.pass) { playFrames = showBefore ? result.noisy : result.filtered; playFps = result.fps; held.style.display = "none"; $("sg-gate-line").innerHTML = `<span class="ok">Passed the gate</span>`; }
    else {
      playFrames = null; cursor = 0;
      const rules = failures(g).map((k) => RULE_WORDS[k]).join(", ");
      held.style.display = "flex"; held.textContent = `Held back: it failed the plausibility gate (${rules}). No motion is shown until it passes.`;
      $("sg-gate-line").innerHTML = `<span class="bad">Failed the gate</span>`;
      drawTrace();
    }
  }

  // ---------- run and report ----------
  const fmt = (v: number, d = 1) => v.toFixed(d);
  function gateRow(k: string, hard: boolean, r: Result): string {
    const get = (g: GateReport) => (hard ? g.hard : g.soft)[k];
    const cell = (g: GateReport) => { const x = get(g); if (!x) return `<td class="n">-</td>`; const [mul] = UNITS[k]; return `<td class="n ${x.ok ? "" : "bad"}">${x.value === null ? "n/a" : (x.value * mul).toFixed(k === "bones_keep_length" ? 2 : 1)}${x.ok ? "" : " &#10007;"}</td>`; };
    return `<tr><td>${RULE_WORDS[k]} <span class="small">${hard ? "(hard)" : "(soft)"}</span></td><td>${LIMITS[k]} ${UNITS[k][1]}</td>${cell(r.gateClean)}${cell(r.gateNoisy)}${cell(r.gateFiltered)}</tr>`;
  }
  const verdict = (g: GateReport) => (g.pass ? `<span class="ok">passes</span>` : `<span class="bad">fails: ${failures(g).map((k) => RULE_WORDS[k]).join(", ")}</span>`);
  function report(r: Result, game: Result): void {
    const cut = r.cutoffHz === null ? "none (filter off)" : `${fmt(r.cutoffHz)} Hz`;
    $("sg-facts").innerHTML = `
      <dt>Wobble that went in</dt><dd>${fmt(r.noiseInCm, 2)} cm</dd>
      <dt>Wobble left after</dt><dd>${fmt(r.noiseLeftCm, 2)} cm (${(noiseGain(r.choice.kind, r.choice.strength) * 100).toFixed(0)}% of it passes)</dd>
      <dt>Runs late by</dt><dd>${fmt(r.lagMs, 0)} ms</dd>
      <dt>Shape lost</dt><dd>${fmt(r.shapeLostCm, 2)} cm (the filter alone, no wobble)</dd>
      <dt>Total error</dt><dd>${fmt(r.totalErrCm, 2)} cm against the true move</dd>
      <dt>Cut-off</dt><dd>${cut}</dd>
      <dt>Peak acceleration</dt><dd>${fmt(r.maxAccel, 0)} m/s2 (gate limit ${GATE_LIMITS.maxAccel})</dd>
      <dt>Planted-foot slide</dt><dd>${fmt(r.footSlideM * 100)} cm (gate limit ${GATE_LIMITS.footSlide * 100})</dd>
      <dt>Gate on your result</dt><dd>${verdict(r.gateFiltered)}</dd>`;
    const hard = Object.keys(r.gateFiltered.hard), soft = Object.keys(r.gateFiltered.soft);
    $("sg-gate").innerHTML = hard.map((k) => gateRow(k, true, r)).join("") + soft.map((k) => gateRow(k, false, r)).join("");
    $("sg-ours-p").textContent = "The game smooths filmed clips with the 1-2-3-2-1 triangle (width 2) and then gives every bone one length. It is light on purpose: it takes the per-frame wobble out of a video measurement, runs on no live data, and keeps the planted feet and the arc of a jump. Heavier smoothing here costs the move its sharp peaks, and a live one-pole filter lags.";
    const row = (name: string, x: Result) => `<tr><td>${name}</td><td class="n">${fmt(x.noiseLeftCm, 2)}</td><td class="n">${fmt(x.lagMs, 0)}</td><td class="n">${fmt(x.shapeLostCm, 2)}</td><td class="n">${fmt(x.maxAccel, 0)}</td><td class="n">${fmt(x.footSlideM * 100)}</td><td>${verdict(x.gateFiltered)}</td></tr>`;
    $("sg-cmp").innerHTML = row("Yours", r) + row("The game's (triangle 2, fixed bones)", game);
    runs++; if (opts.markPage) document.documentElement.dataset.labDone = String(runs);
    if (!$("sg-eq-body").hidden) fillEq(r);
  }
  function fillEq(r: Result): void {
    const c = r.choice, fps = r.fps, ng = noiseGain(c.kind, c.strength);
    const win = c.kind !== "exponential" && c.strength > 0 ? kernel(c.kind, c.strength).map((v) => v.toFixed(3)).join("  ") : "";
    $("sg-eq-body").textContent =
`A smoother is a low-pass filter: it keeps slow changes (the move) and cuts fast ones (the wobble).

Window filters:   y[n] = sum over k of  c[k] * x[n + k]      k = -h ... h, the weights c sum to 1
  average:   c[k] = 1 / (2h + 1)
  triangle:  c[k] = (h + 1 - |k|) / (h + 1)^2        (the game: h = 2, weights 1 2 3 2 1 over 9)
  curve fit: c[k] = 3 (3h^2 + 3h - 1 - 5k^2) / ((2h - 1)(2h + 1)(2h + 3))   (a quadratic fitted by least squares)
Live one-pole:    y[n] = y[n - 1] + a (x[n] - y[n - 1]),   a = 1 / (1 + s)

How fast a wiggle of frequency f is cut:   |H(w)| = | sum c[k] cos(k w) |,   w = 2 pi f / fps     (window)
                                           |H(w)|^2 = a^2 / (1 - 2 (1 - a) cos w + (1 - a)^2)   (one-pole)
Cut-off f_c: the f where |H| = 1/sqrt(2).   Yours: ${r.cutoffHz === null ? "none, the filter is off" : r.cutoffHz.toFixed(2) + " Hz at " + fps.toFixed(1) + " frames per second"}.

The trade-off:
  wobble left:  sigma_out = sigma_in * sqrt(sum c[k]^2)  =  ${r.noiseInCm.toFixed(2)} cm * ${ng.toFixed(3)}  ~  ${(r.noiseInCm * ng).toFixed(2)} cm
  lag:          window filters are symmetric, so they look ahead as much as back: 0 delay.
                the one-pole only looks back: a delay of (1 - a) / a frames at slow changes${c.kind === "exponential" ? `  =  ${((1 - expAlpha(c.strength)) / expAlpha(c.strength)).toFixed(2)} frames = ${(((1 - expAlpha(c.strength)) / expAlpha(c.strength)) / fps * 1000).toFixed(0)} ms` : ""}.
  peaks:        a stronger filter lowers the cut-off, so a quick peak (a push-off, a landing) is rounded off; the curve fit rounds them least.
  So a lower cut-off buys less wobble and costs lag or a flattened move. There is no setting that gives both.
${win ? `\nYour weights (h = ${c.strength}):  ${win}` : ""}`;
  }
  async function run(): Promise<void> {
    const clip = await load(choice.clip);
    const ch = clampChoice(choice);
    result = runSignalLab(clip, ch);
    const game = runGameSetting(clip, ch.noiseCm);
    report(result, game);
    drawTrace(); drawGain();
    t0 = performance.now();
    showGateState();
  }
  $<HTMLButtonElement>("sg-eq-btn").onclick = () => { $("sg-eq-body").hidden = false; $("sg-eq-btn").hidden = true; if (result) fillEq(result); };


  async function start(beforeFirstRun?: () => void): Promise<void> {
    const clip = await load(choice.clip);
    beforeFirstRun?.(); await run();
    if (opts.markPage) { document.documentElement.dataset.labReady = "true"; document.documentElement.dataset.labNumbersAt = String(Math.round(performance.now())); }
    if (opts.rookie) { await initRookie(clip); frameLoop(); }
  }
  return { start, root: panel };
}
