import { mountLabsNav } from "../ui/labs-nav";
import * as THREE from "three/webgpu";
import { createStage } from "../render/scene";
import { loadRookie, type PosedRookie } from "../render/rookie";
import { clipToWorld } from "../motion/pose";
import { legLength } from "../motion/timeline";
import { MOTION_TABLE } from "../motion/motion-table";
import { labsOn } from "../ui/labs";
import { labDefaultNote, labPopulated } from "../ui/lab-default";
import { TICKS_PER_SECOND } from "../sim/units";
import { GATE_LIMITS, type SignalClip } from "../lab/signal-lab";
import { mountSignalPanel } from "../labs/signal/panel";
import { mountIkPanel } from "../labs/ik/panel";
import {
  LAB_CLIPS, RULE_WORDS, applyGameSmoothing, buildClip, checkShape, clipFrameAtTick, clipSeconds, clockOffPercent, dropLastName, frameTime, liftToFloor,
  onlyBoneLengths, REAL_MANIFEST_URL, retargetScale, ticksFor, verdict, whyFailed, withFps, type LabClip, type Verdict,
} from "../labs/motion/motion-core";

// Lab 13: Video to motion. Pipeline stage 2 of 3 (video -> pose -> gate -> clip on the character). Every number comes from the game's own gate and clip reader.
const INK = "#17201d", TEAL = "#0f6b5c", GREY = "#a7b0ab", BAD = "#b91c1c", AMBER = "#b45309";
const UNITS: Record<string, [number, string]> = { knees_bend_forward: [1, "deg"], legs_not_twisted: [1, "deg"], knees_within_range: [1, "deg"], flight_is_ballistic: [1, "m/s2"], held_clips_are_held: [1, "s"], feet_dont_sink: [100, "cm"], no_teleport: [1, "m/s"], bones_keep_length: [100, "%"], feet_dont_slide: [100, "cm"], no_jitter: [1, "m/s2"] };
const LIMITS: Record<string, string> = { knees_bend_forward: "under 120", legs_not_twisted: "at most 60", knees_within_range: "at most 165", flight_is_ballistic: "9.81 within 15%", held_clips_are_held: "at most 1", feet_dont_sink: "at most 3", no_teleport: "at most 12", bones_keep_length: "at most 2", feet_dont_slide: "at most 3", no_jitter: `at most ${GATE_LIMITS.maxAccel}` };
const ORIGIN_WORDS = { "recorded-pass": "recorded, passes", "recorded-fail": "recorded, fails", "broken-by-us": "made broken by us", "measured-raw": "raw, from the pose finder" } as const;

export function startLabMotion(host: HTMLElement): { backend: "canvas2d" } {
  const root = document.createElement("div");
  root.id = "lab-motion";
  root.style.cssText = `position:fixed;inset:0;overflow:auto;background:#f5f7f4;color:${INK};font:15px/1.4 system-ui,sans-serif`;
  host.append(root);
  mountLabsNav(host, "lab-motion");
  if (!labsOn()) {
    root.innerHTML = `<div style="max-width:520px;margin:12vh auto;padding:0 16px"><h1 style="font-size:22px">Lab 13: Video to motion</h1><p>Labs are switched off.</p><p><a href="?mode=lab-motion&labs=1" style="color:${TEAL}">Switch labs on</a></p></div>`;
    return { backend: "canvas2d" };
  }
  const style = document.createElement("style");
  style.textContent = `
    #lab-motion .wrap{max-width:1180px;margin:0 auto;padding:56px 16px 24px;display:grid;gap:14px}
    #lab-motion h1{font-size:22px;margin:0}#lab-motion h2{font-size:16px;margin:0 0 6px}
    #lab-motion .card{background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:12px;min-width:0}
    #lab-motion .two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}
    #lab-motion table{border-collapse:collapse;width:100%;font-size:13px}#lab-motion th,#lab-motion td{text-align:left;padding:3px 8px 3px 0;border-bottom:1px solid #e3e8e4}
    #lab-motion td.n,#lab-motion th.n{text-align:right;font-variant-numeric:tabular-nums}
    #lab-motion .small{color:#52605a;font-size:13px}
    #lab-motion select{font:14px system-ui;padding:6px;border:1px solid #b9c4bb;border-radius:6px;background:#fff;color:${INK}}
    #lab-motion button{font:600 13px system-ui;padding:7px 10px;border:1px solid #b9c4bb;border-radius:8px;background:#fff;color:${INK};cursor:pointer}
    #lab-motion [aria-pressed=true]{border-color:${TEAL};background:#e6f2ee}
    #lab-motion .bad{color:${BAD};font-weight:700}#lab-motion .ok{color:${TEAL};font-weight:700}
    #lab-motion .eq{font:13px/1.5 ui-monospace,Menlo,monospace;background:#f1f4f1;border-radius:8px;padding:8px 10px;white-space:pre-wrap}
    #lab-motion a{color:${TEAL};font-weight:600}
    #lab-motion .pill{display:inline-block;padding:1px 8px;border-radius:99px;font-size:12px;font-weight:700}
    #lab-motion #mo-view{width:100%;height:300px;border-radius:6px;overflow:hidden;position:relative;background:#9fc5e8}
    #lab-motion #mo-held{position:absolute;inset:0;display:none;align-items:center;justify-content:center;text-align:center;padding:16px;background:rgba(245,247,244,.94);font-weight:700;color:${BAD}}
    #lab-motion input[type=range]{width:100%}`;
  root.append(style);
  const wrap = document.createElement("div"); wrap.className = "wrap"; root.append(wrap);
  wrap.innerHTML = `
    <div><a href="/?welcome=0">Back to the game</a>
    <h1 id="mo-h1">Lab 13: Video to motion</h1>
    <p class="small" style="margin:2px 0">Video, pose, smoothing, gate, clip. The links above show the Labs each step uses.</p>
    <p class="small" style="margin:2px 0">Follow one filmed move and watch the gate stop a bad clip. Every clip is recorded; nothing runs on a GPU here.</p></div>

    <div class="card"><h2>Pick a clip</h2>
      <select id="mo-clip" aria-label="Clip"></select> <span id="mo-origin" class="pill"></span>
      <p class="small" id="mo-note" style="margin:6px 0 0"></p></div>

    <div class="two">
      <div class="card" id="s1"><h2>Step 1. Source frames, and the clock they carry</h2>
        <p class="small" style="margin:0 0 6px">Each frame is at i divided by the rate. Only 30 joint positions per frame are kept.</p>
        <div id="mo-s1"></div></div>
      <div class="card" id="s2"><h2>Step 2. Joint positions for each frame</h2>
        <p class="small" style="margin:0 0 6px">Every frame becomes 30 named joints in metres. Names and positions must match in length.</p>
        <canvas id="mo-frames" width="560" height="190" style="width:100%;height:auto;display:block;border-radius:6px;background:#f6f9f6"></canvas>
        <div id="mo-s2" style="margin-top:6px"></div></div>
    </div>

    <div class="card" id="s3"><h2>Step 3. Smoothing: only what the game applies</h2>
      <p class="small" style="margin:0 0 6px">Light 1-2-3-2-1 smoothing, then one length per bone. The trade-off is in <a href="?mode=lab-signal&labs=1&welcome=0">Lab 8, Signal processing</a>.</p>
      <div id="mo-s3"></div>
      <details id="mo-w8" style="margin-top:10px"><summary><b>Try the smoothing yourself, and the gate table</b> (the panel of Lab 8, same code)</summary><div id="mo-w8-body" style="margin-top:8px"></div></details></div>

    <div class="card" id="s4"><h2>Step 4. The plausibility gate</h2>
      <p class="small" style="margin:0 0 6px">Nothing plays before it passes. Hard rules block a clip; soft rules only report.</p>
      <div id="mo-s4"></div>
      <p class="small" style="margin:6px 0 0"><button id="mo-open-w8" type="button" class="link" style="background:none;border:0;color:#0f6b5c;font:600 13px system-ui;cursor:pointer;padding:0;text-decoration:underline">Open the gate table of Lab 8</button> (rule by rule, on a clean, a wobbly and a smoothed clip).</p>
      <h2 style="margin-top:12px">The gate on every clip</h2><div id="mo-all"></div>
      <h2 style="margin-top:12px">The recorded run of the real pipeline</h2><div id="mo-rec"></div>
      <h2 style="margin-top:12px">The pose finder's own output</h2><div id="mo-real"></div></div>

    <div class="two">
      <div class="card" id="s5"><h2>Step 5. Retarget to the standard skeleton, then play on the character</h2>
        <p class="small" style="margin:0 0 6px">Legs are scaled to match, bones turned to the joints. A failed clip never plays.</p>
        <div id="mo-view"><div id="mo-held"></div></div>
        <div id="mo-s5" class="small" style="margin-top:6px"></div>
        <details id="mo-w3" style="margin-top:10px"><summary><b>Try the reach yourself</b> (the panel of Lab 3, same code)</summary><div id="mo-w3-body" style="margin-top:8px"></div></details></div>
      <div class="card" id="s6"><h2>Step 6. The one clock</h2>
        <p class="small" style="margin:0 0 6px">The pose comes from the tick count (${TICKS_PER_SECOND} a second), never a timer.</p>
        <label class="small">Simulator tick: <b id="mo-tick-v"></b><input id="mo-tick" type="range" min="0" max="100" step="1"></label>
        <div id="mo-s6" style="margin-top:6px"></div>
        <h2 style="margin-top:12px">Which move uses which clip</h2><div id="mo-table"></div></div>
    </div>`;
  const $ = <T extends HTMLElement>(id: string): T => wrap.querySelector("#" + id) as T;
  // the shared panels of Lab 8 and Lab 3 mount the first time their box is opened (no second 3D view is made: step 5 plays the Rookie)
  const lazy = (id: string, mount: (host: HTMLElement) => unknown) => { const d = wrap.querySelector<HTMLDetailsElement>("#" + id)!; let done = false; d.addEventListener("toggle", () => { if (d.open && !done) { done = true; mount(d.querySelector<HTMLElement>("div")!); } }); return d; };
  const w8 = lazy("mo-w8", (h) => void mountSignalPanel(h, { rookie: false, markPage: false }).start());
  lazy("mo-w3", (h) => void mountIkPanel(h));
  $("mo-open-w8").addEventListener("click", () => { w8.open = true; w8.scrollIntoView({ block: "start" }); });
  const files: Record<string, SignalClip> = {};
  const built = new Map<string, SignalClip>();
  const verdicts = new Map<string, Verdict>();
  let current: LabClip = LAB_CLIPS[0];
  let tick = 0, playing = true;

  const sel = $<HTMLSelectElement>("mo-clip");
  sel.innerHTML = LAB_CLIPS.map((c) => `<option value="${c.id}">${c.label} (${ORIGIN_WORDS[c.origin]})</option>`).join("");
  const fmt = (v: number, d = 1) => v.toFixed(d);
  const clipOf = (s: LabClip): SignalClip => built.get(s.id)!;

  function pill(s: LabClip): void {
    const p = $("mo-origin");
    p.textContent = ORIGIN_WORDS[s.origin];
    p.style.background = s.origin === "recorded-pass" ? "#e6f2ee" : s.origin === "recorded-fail" ? "#fde8e8" : s.origin === "measured-raw" ? "#e8eefb" : "#fff1de";
    p.style.color = s.origin === "recorded-pass" ? TEAL : s.origin === "recorded-fail" ? BAD : s.origin === "measured-raw" ? "#1d4ed8" : AMBER;
    $("mo-note").textContent = s.note;
  }

  function fillS1(c: SignalClip): void {
    const n = c.frames.length, base = built.get(current.id)!;
    const real = base.fps;
    const leap = files["/assets/motion/leap.json"], leapSpec = LAB_CLIPS.find((x) => x.id === "leap")!;
    const typed30 = withFps(leap, 30), typed24 = withFps(leap, 24);
    const row = (label: string, k: SignalClip) => { const v = verdict(leapSpec, k); return `<tr><td>${label}</td><td class="n">${fmt(k.fps, 2)}</td><td class="n">${fmt(((k.frames.length - 1) / k.fps), 3)} s</td><td class="${v.pass ? "ok" : "bad"}">${v.pass ? "passes" : "fails: " + v.failed.map((r) => RULE_WORDS[r]).join(", ")}</td></tr>`; };
    $("mo-s1").innerHTML = `<p style="margin:0 0 6px"><b>${n}</b> frames at <b>${fmt(real, 2)}</b> frames a second: frame 10 is at <b>${fmt(frameTime(10, real), 4)} s</b>, the last frame at <b>${fmt(clipSeconds(c), 3)} s</b>.</p>
      <p class="small" style="margin:0 0 6px">A typed-in rate is a second clock; gravity gives it away.</p>
      <table><thead><tr><th>Rate used</th><th class="n">per s</th><th class="n">Length</th><th>Gate</th></tr></thead><tbody>${row("The source's own", leap)}${row("Typed as 30", typed30)}${row("Typed as 24", typed24)}</tbody></table>
      <p class="small" style="margin:6px 0 0">A rate typed as 30 for a 29.97 source is ${fmt(Math.abs(clockOffPercent(29.97, 30)), 2)}% off: harmless. Typed 24 for a 30 source is ${fmt(Math.abs(clockOffPercent(30, 24)), 0)}% off.</p>`;
  }

  function drawFrames(c: SignalClip): void {
    const cv = $<HTMLCanvasElement>("mo-frames"), g = cv.getContext("2d")!;
    g.clearRect(0, 0, cv.width, cv.height);
    const n = c.frames.length, shots = 8;
    let lo = Infinity, hi = -Infinity, zlo = Infinity, zhi = -Infinity;
    for (const fr of c.frames) for (const p of fr) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); zlo = Math.min(zlo, p[2]); zhi = Math.max(zhi, p[2]); }
    const H = cv.height - 28, k = H / Math.max(hi - lo, 1.4), cell = cv.width / shots;
    g.fillStyle = "#52605a"; g.font = "12px system-ui"; g.textAlign = "center";
    for (let s = 0; s < shots; s++) {
      const i = Math.round((s * (n - 1)) / (shots - 1)), fr = c.frames[i], cx = fr[0][2], x0 = s * cell + cell / 2;
      g.strokeStyle = TEAL; g.lineWidth = 2; g.beginPath();
      c.parents.forEach((p, j) => { if (p < 0) return; g.moveTo(x0 + (fr[p][2] - cx) * k, cv.height - 22 - (fr[p][1] - lo) * k); g.lineTo(x0 + (fr[j][2] - cx) * k, cv.height - 22 - (fr[j][1] - lo) * k); });
      g.stroke();
      g.strokeStyle = GREY; g.lineWidth = 1; g.beginPath(); const fy = cv.height - 22 - (0 - lo) * k; g.moveTo(s * cell + 4, fy); g.lineTo((s + 1) * cell - 4, fy); g.stroke();
      g.fillText(`${fmt(frameTime(i, c.fps), 2)} s`, x0, cv.height - 6);
    }
  }

  function fillS2(c: SignalClip): void {
    const raw = { names: c.names, parents: c.parents, fps: c.fps, frames: c.frames };
    const ok = checkShape(raw), bad = checkShape(dropLastName(c));
    $("mo-s2").innerHTML = `<table><tbody>
      <tr><td>Names</td><td class="n"><b>${c.names.length}</b> (${c.names.slice(0, 3).join(", ")} ... ${c.names[c.names.length - 1]})</td></tr>
      <tr><td>Positions in each frame</td><td class="n"><b>${c.frames[0].length}</b> x, y, z in metres, y up</td></tr>
      <tr><td>The game's check on this clip</td><td class="n ${ok.ok ? "ok" : "bad"}">${ok.message}</td></tr>
      <tr><td>The same clip with one name lost (off by one)</td><td class="n ${bad.ok ? "ok" : "bad"}">refused: ${bad.message}</td></tr></tbody></table>
      <p class="small" style="margin:6px 0 0">Eight frames of this clip, side view, at the time each was filmed.</p>`;
    drawFrames(c);
  }

  function softRow(label: string, c: SignalClip): string {
    const v = verdict(current, c), s = v.report.soft;
    const cell = (k: string) => `<td class="n ${s[k].ok ? "" : "bad"}">${fmt((s[k].value ?? 0) * UNITS[k][0], k === "bones_keep_length" ? 2 : 1)} ${UNITS[k][1]}</td>`;
    return `<tr><td>${label}</td>${cell("bones_keep_length")}${cell("no_jitter")}${cell("feet_dont_slide")}<td class="${v.pass ? "ok" : "bad"}">${v.pass ? "passes" : "fails"}</td></tr>`;
  }
  function fillS3(c: SignalClip): void {
    const tri = applyGameSmoothing(c), bones = onlyBoneLengths(c);
    $("mo-s3").innerHTML = `<table><thead><tr><th>Clip</th><th class="n">Bone length change (limit 2%)</th><th class="n">Peak acceleration (limit ${GATE_LIMITS.maxAccel})</th><th class="n">Planted-foot slide (limit 3 cm)</th><th>Hard rules</th></tr></thead><tbody>
      ${softRow("As measured", c)}${softRow("One length per bone only", bones)}${softRow("The game's: triangle, then one length per bone", tri)}</tbody></table>
      <p class="small" style="margin:6px 0 0">Soft rules: reported, they never stop a clip.</p>`;
  }

  function gateTable(v: Verdict): string {
    const rows = (hard: boolean) => Object.entries(hard ? v.report.hard : v.report.soft).map(([k, r]) => {
      const [mul, unit] = UNITS[k];
      return `<tr><td>${RULE_WORDS[k]} <span class="small">(${hard ? "hard" : "soft"})</span></td><td>${LIMITS[k]} ${unit}</td><td class="n ${r.ok ? "" : "bad"}">${r.value === null ? "not judged" : fmt(r.value * mul, k === "bones_keep_length" ? 2 : 1) + " " + unit}</td><td class="${r.ok ? "ok" : "bad"}">${r.ok ? "ok" : "FAILED"}</td></tr>`;
    }).join("");
    return `<table><thead><tr><th>Rule</th><th>Limit</th><th class="n">This clip</th><th></th></tr></thead><tbody>${rows(true)}${rows(false)}</tbody></table>`;
  }
  function fillS4(): void {
    const v = verdicts.get(current.id)!;
    const c = clipOf(current), lifted = liftToFloor(c.frames), after = verdict(current, { ...c, frames: lifted.frames });
    const repair = v.pass ? "" : `<p class="small" style="margin:6px 0 0">Small repair only: lift to the floor (${lifted.changed} frames) gives: ${after.pass ? `<span class="ok">passes now</span>` : `<span class="bad">still fails</span> - ${whyFailed(after)}`}</p>`;
    $("mo-s4").innerHTML = `<p style="margin:0 0 6px;font-size:16px">Verdict: ${v.pass ? `<span class="ok">passes</span>` : `<span class="bad">fails</span> - ${whyFailed(v)}`}</p>${gateTable(v)}${repair}`;
    $("mo-all").innerHTML = `<table><thead><tr><th>Clip</th><th>Where it came from</th><th>Verdict</th><th>Why</th></tr></thead><tbody>${LAB_CLIPS.map((s) => {
      const x = verdicts.get(s.id)!;
      return `<tr data-clip="${s.id}"><td><button class="link" data-pick="${s.id}" style="border:0;background:none;padding:0;color:${TEAL};text-decoration:underline">${s.label}</button></td><td>${ORIGIN_WORDS[s.origin]}</td><td class="${x.pass ? "ok" : "bad"}">${x.pass ? "passes" : "fails"}</td><td>${x.pass ? (x.softFailed.length ? "soft only: " + x.softFailed.map((k) => RULE_WORDS[k]).join(", ") : "") : x.failed.map((k) => RULE_WORDS[k]).join(", ")}</td></tr>`;
    }).join("")}</tbody></table><p class="small" style="margin:6px 0 0">The last four are shipped clips changed in one way, not recorded failures.</p>`;
    wrap.querySelectorAll<HTMLButtonElement>("[data-pick]").forEach((b) => { b.onclick = () => { sel.value = b.dataset.pick!; change(); }; });
  }

  /** The pose finder's recorded raw tracks: what the Python gate said when they were made, and what this page's gate and smoothing say now. */
  async function fillRealPack(): Promise<void> {
    const man = await (await fetch(REAL_MANIFEST_URL)).json();
    const rows = man.clips.filter((m: any) => LAB_CLIPS.some((x) => x.url.endsWith("/" + m.file))).map((m: any) => {
      const spec = LAB_CLIPS.find((x) => x.url.endsWith("/" + m.file))!, id = spec.id, c = clipOf(spec);
      const now = verdicts.get(id)!, sm = verdict(spec, applyGameSmoothing(c)), s = (v: Verdict, k: string) => `<td class="n ${v.report.soft[k].ok ? "" : "bad"}">${fmt((v.report.soft[k].value ?? 0) * UNITS[k][0], k === "bones_keep_length" ? 1 : 1)} ${UNITS[k][1]}</td>`;
      return `<tr><td>${m.label}</td><td class="n">${m.frames_measured} of ${m.frames}</td>${s(now, "bones_keep_length")}${s(sm, "bones_keep_length")}${s(now, "no_jitter")}${s(sm, "no_jitter")}<td class="${now.pass ? "ok" : "bad"}">${now.pass ? "passes" : "fails"}</td></tr>`;
    }).join("");
    $("mo-real").innerHTML = `<p class="small" style="margin:0 0 6px">Recorded when this Lab was built: a pose-finding model ran on a GPU over the frames of a filmed roll (one adult, London Parkour, CC BY), and these are its joints, before any cleaning. This page does not run the model.</p>
      <table><thead><tr><th>Clip</th><th class="n">Frames found</th><th class="n">Bone change, raw</th><th class="n">after smoothing</th><th class="n">Peak acceleration, raw</th><th class="n">after smoothing</th><th>Hard rules, raw</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  async function fillRecorded(): Promise<void> {
    const rec = await (await fetch("/assets/lab/motion-recorded.json")).json();
    const col = (r: any, k: string) => { const x = r.hard[k]; return `<td class="n ${x.ok ? "" : "bad"}">${x.value === null ? "-" : fmt(x.value * (UNITS[k]?.[0] ?? 1), 2)} ${x.ok ? "ok" : "FAILED"}</td>`; };
    const keys = Object.keys(rec.raw.hard);
    $("mo-rec").innerHTML = `<p class="small" style="margin:0 0 6px">The filmed jump roll (${rec.frames} frames), measured by the pipeline's own Python gate, raw then repaired.</p>
      <table><thead><tr><th>Rule</th><th class="n">Raw measurement</th><th class="n">After repairs</th></tr></thead><tbody>${keys.map((k) => `<tr><td>${RULE_WORDS[k]}</td>${col(rec.raw, k)}${col(rec.repaired, k)}</tr>`).join("")}</tbody></table>
      <p class="small" style="margin:6px 0 0">The repair fixes the sunk feet, not the missing falling arc: the film stays held back.</p>`;
  }

  // ---------- the Rookie ----------
  let stage: Awaited<ReturnType<typeof createStage>> | null = null;
  let rookie: PosedRookie | null = null;
  async function initRookie(): Promise<void> {
    const host = $("mo-view"), c = clipOf(LAB_CLIPS[0]);
    try {
      stage = await createStage(host, false);
      stage.renderer.domElement.style.cssText = "width:100%;height:100%;display:block";
      stage.scene.background = new THREE.Color(0xbfdcf2);
      for (let i = -4; i <= 40; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 0.8), new THREE.MeshStandardMaterial({ color: i % 5 === 0 ? 0x33403a : 0x9fb59a })); m.position.set(i * 0.5, 0.005, 0); stage.scene.add(m); }
      rookie = await loadRookie("a", c.names, c.parents);
      stage.scene.add(rookie.object);
      stage.renderer.setSize(host.clientWidth, host.clientHeight);
      stage.camera.aspect = host.clientWidth / host.clientHeight; stage.camera.updateProjectionMatrix();
      document.documentElement.dataset.motionRookie = "1";
    } catch { rookie = null; $("mo-held").style.display = "flex"; $("mo-held").textContent = "The 3D view needs a graphics-capable browser."; }
  }
  let acc = 0, last = performance.now();
  function loop(): void {
    requestAnimationFrame(loop);
    const now = performance.now();
    // the tick count is the clock: wall time only decides how many ticks to add, one at a time
    acc += now - last; last = now;
    const maxTick = ticksFor(clipOf(current));
    while (playing && acc >= 1000 / TICKS_PER_SECOND) { acc -= 1000 / TICKS_PER_SECOND; tick = tick >= maxTick + TICKS_PER_SECOND / 2 ? 0 : tick + 1; }
    if (acc > 1000) acc = 0;
    showTick();
  }
  function showTick(): void {
    const c = clipOf(current), v = verdicts.get(current.id)!;
    const maxTick = ticksFor(c), shown = Math.min(tick, maxTick);
    const f = clipFrameAtTick(shown, c.fps);
    $<HTMLInputElement>("mo-tick").max = String(maxTick);
    $<HTMLInputElement>("mo-tick").value = String(shown);
    $("mo-tick-v").textContent = `${shown} (${fmt(shown / TICKS_PER_SECOND, 3)} s)`;
    $("mo-s6").innerHTML = `<table><tbody><tr><td>Clip time</td><td class="n">tick ${shown} / ${TICKS_PER_SECOND} = <b>${fmt(shown / TICKS_PER_SECOND, 3)} s</b></td></tr><tr><td>Clip frame</td><td class="n">${fmt(shown / TICKS_PER_SECOND, 3)} s x ${fmt(c.fps, 2)} = <b>${fmt(f, 2)}</b> of ${c.frames.length - 1}</td></tr><tr><td>Ticks the clip lasts</td><td class="n">${maxTick}</td></tr></tbody></table>
      <p class="small" style="margin:6px 0 0">A replay, a ghost and a film read the same tick, so they cannot drift apart.</p>`;
    if (!rookie || !stage || !v.pass) return;
    const i = Math.min(c.frames.length - 1, Math.floor(f)), j = Math.min(c.frames.length - 1, i + 1), w = f - i;
    const first = c.frames[0], scale = retargetScale(rookie.legLength, legLength(c.names, (k) => new THREE.Vector3(...first[k])));
    const joints = c.frames[i].map((p, k) => { const q = c.frames[j][k]; return clipToWorld([p[0] + (q[0] - p[0]) * w, p[1] + (q[1] - p[1]) * w, p[2] + (q[2] - p[2]) * w]).multiplyScalar(scale); });
    rookie.apply(joints);
    stage.camera.position.set(joints[0].x + 0.3, 1.5, 4.3); stage.camera.lookAt(joints[0].x, 0.85, 0);
    document.documentElement.dataset.motionFrame = String(Math.round(f));
  }
  function fillS5(): void {
    const c = clipOf(current), v = verdicts.get(current.id)!, held = $("mo-held");
    const first = c.frames[0], clipLeg = legLength(c.names, (k) => new THREE.Vector3(...first[k]));
    $("mo-s5").innerHTML = `<p style="margin:0">Gate: ${v.pass ? `<span class="ok">passed, so it plays</span>` : `<span class="bad">failed, so nothing plays</span>`}. This clip's leg: <b>${fmt(clipLeg, 3)} m</b>${rookie ? `, the Rookie's leg: <b>${fmt(rookie.legLength, 3)} m</b>, every position scaled by <b>${fmt(retargetScale(rookie.legLength, clipLeg), 3)}</b>` : ""}.</p>`;
    if (v.pass) held.style.display = "none";
    else { held.style.display = "flex"; held.textContent = `Held back: it failed the plausibility gate (${v.failed.map((k) => RULE_WORDS[k]).join(", ")}). No motion is shown until it passes.`; }
  }
  function fillTable(): void {
    $("mo-table").innerHTML = `<table><thead><tr><th>Move</th><th>Clip</th><th>While no clip</th><th class="n">Ticks</th></tr></thead><tbody>${Object.entries(MOTION_TABLE).map(([m, e]) => `<tr><td>${m}</td><td>${e.clip ?? "none"}</td><td>${e.fallback}</td><td class="n">${e.ticks ?? "as long as the state"}</td></tr>`).join("")}</tbody></table>
      <p class="small" style="margin:6px 0 0">Built-pose rows (hands, tuck, pose) are made from bones in code, not from a clip; they are the fallback and are never called motion capture.</p>`;
  }

  function change(): void {
    current = LAB_CLIPS.find((c) => c.id === sel.value)!;
    tick = 0;
    pill(current);
    const c = clipOf(current);
    fillS1(c); fillS2(c); fillS3(c); fillS4(); fillS5(); fillTable();
    document.documentElement.dataset.labDone = String((Number(document.documentElement.dataset.labDone ?? 0)) + 1);
  }
  sel.onchange = change;
  $<HTMLInputElement>("mo-tick").addEventListener("input", (e) => { playing = false; tick = Number((e.target as HTMLInputElement).value); showTick(); });
  $("mo-tick").addEventListener("change", () => { playing = true; });

  (async () => {
    const urls = [...new Set(LAB_CLIPS.map((c) => c.url))];
    // the recorded pose pack is optional: if it cannot load, the Lab keeps its other clips
    await Promise.all(urls.map(async (u) => { try { files[u] = await (await fetch(u)).json(); } catch { if (!u.includes("/lab/motion/real/")) throw new Error("clip missing: " + u); } }));
    for (let i = LAB_CLIPS.length - 1; i >= 0; i--) if (!files[LAB_CLIPS[i].url]) LAB_CLIPS.splice(i, 1);
    sel.innerHTML = LAB_CLIPS.map((c) => `<option value="${c.id}">${c.label} (${ORIGIN_WORDS[c.origin]})</option>`).join("");
    for (const s of LAB_CLIPS) { const c = buildClip(s, files); built.set(s.id, c); verdicts.set(s.id, verdict(s, c)); }
    sel.value = "roll-whole"; // opens on the real failure so the gate's work is the first thing seen
    labDefaultNote(wrap, "live", $("mo-h1"));
    change();
    await fillRecorded();
    await fillRealPack().catch(() => { $("mo-real").textContent = ""; });
    document.documentElement.dataset.labReady = "true";
    labPopulated("lab-motion");
    loop();
    await initRookie();
    showTick();
  })();
  return { backend: "canvas2d" };
}
