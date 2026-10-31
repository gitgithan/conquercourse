import { Vector3 } from "three";
import { parseClip, type Clip } from "../motion/clip";
import { loadRookie } from "../render/rookie";
import { labsOn } from "../ui/labs";
import { DEFAULT_CHOICES, ELBOW_MAX, GAME_POLE, MATCH, SHOULDER_MAX, SHOULDER_MIN, breakingPoint, deg, makeBody, maxReach, minReach, poseFor, residualMap, type Body, type Choices, type Pose } from "../labs/ik/ik-core";
import { NECK_LIMIT, SHOULDER_LIMIT } from "../motion/neck";

// Lab 3: Posing a character (inverse kinematics). The player drags a hand target (a bar or a ledge) and the Rookie's arm bends to reach it
// with the game's own two-bone reach and neck rule; an iterative solver is there to compare. Numbers and a picture; nothing talks or grades.
// Behind the labs switch (?labs=1). The equations are in a box that stays closed until opened.
const INK = "#17201d", TEAL = "#0f6b5c", GHOST = "#9aa5a0", BAD = "#b91c1c", AMBER = "#b45309";
const W = 900, H = 560, PPM = 280, X0 = -1.3, Y0 = -0.12; // canvas pixels; pixels per metre; the world's left edge and floor line (m)
const sx = (x: number) => (x - X0) * PPM, sy = (y: number) => H - (y - Y0) * PPM;
const wx = (px: number) => px / PPM + X0, wy = (py: number) => (H - py) / PPM + Y0;
const MAP_HALF = 0.95, MAP_STEP = 0.025;
const cm = (m: number) => (m * 100).toFixed(1);

const SOLVERS: [Choices["solver"], string, string][] = [
  ["two-bone", "Two-bone (the game)", "One exact answer from the lengths of the two arm bones. No loop, no tuning. This is what the game runs."],
  ["dls", "Damped least squares", "Small steps toward the target, many times. Not in the game: shown so you can compare it."],
];
const PRESETS: [string, string, number, number][] = [
  ["ledge", "A ledge ahead and up", 0.55, 1.45],
  ["bar", "A bar level with the chest", 0.5, 1.15],
  ["behind", "A bar behind the back", -0.15, 1.2],
  ["far", "Out of reach", 1.0, 1.5],
];

export async function startLabIk(host: HTMLElement): Promise<{ backend: "canvas2d" }> {
  const root = document.createElement("div");
  root.id = "lab-ik";
  root.style.cssText = `position:fixed;inset:0;overflow:auto;background:#f5f7f4;color:${INK};font:15px/1.4 system-ui,sans-serif`;
  host.append(root);
  if (!labsOn()) {
    root.innerHTML = `<div style="max-width:520px;margin:12vh auto;padding:0 16px"><h1 style="font-size:22px">Lab 3: Posing a character</h1><p>Labs are switched off.</p><p><a href="?mode=lab-ik&labs=1" style="color:${TEAL}">Switch labs on</a></p></div>`;
    return { backend: "canvas2d" };
  }
  const style = document.createElement("style");
  style.textContent = `
    #lab-ik .wrap{max-width:1240px;margin:0 auto;padding:16px;display:grid;gap:14px}
    #lab-ik h1{font-size:22px;margin:0}#lab-ik h2{font-size:15px;margin:0 0 6px}
    #lab-ik .grid{display:grid;grid-template-columns:minmax(260px,320px) minmax(0,1fr);gap:14px;align-items:start}
    #lab-ik .card{background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:12px}
    #lab-ik label{display:grid;gap:2px;margin:8px 0}#lab-ik input[type=range]{width:100%}
    #lab-ik .two{display:grid;grid-template-columns:1fr 1fr;gap:6px}
    #lab-ik .two button,#lab-ik .pre button{font:600 14px system-ui;padding:8px;border:1px solid #b9c4bb;border-radius:8px;background:#fff;color:${INK};cursor:pointer}
    #lab-ik .two button[aria-pressed=true]{border-color:${TEAL};background:#e6f2ee}
    #lab-ik .pre{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}
    #lab-ik .facts{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:0}
    #lab-ik .facts dt{color:#52605a}#lab-ik .facts dd{margin:0;font-weight:600}
    #lab-ik table{border-collapse:collapse;width:100%;font-size:13px}#lab-ik th,#lab-ik td{text-align:left;padding:3px 8px 3px 0;border-bottom:1px solid #e3e8e4}
    #lab-ik .small{color:#52605a;font-size:13px}
    #lab-ik .eq{font:14px/1.6 ui-monospace,Menlo,monospace;background:#f1f4f1;border-radius:8px;padding:8px 10px;white-space:pre-wrap;overflow-x:auto;margin-top:8px}
    #lab-ik summary{cursor:pointer;color:${TEAL};font-weight:700}
    #lab-ik .bad{color:${BAD}}#lab-ik .warn{color:${AMBER}}
    #lab-ik a.back{color:${TEAL};font-weight:600}
    #lab-ik canvas{touch-action:none;cursor:crosshair}
  `;
  root.append(style);
  const wrap = document.createElement("div"); wrap.className = "wrap"; root.append(wrap);
  wrap.innerHTML = `
    <div><a class="back" href="/?welcome=0">Back to the game</a>
    <h1>Lab 3: Posing a character</h1>
    <p class="small" style="margin:4px 0 0">The goal: put the Rookie's hand on a bar or a ledge, and find the exact place where the pose breaks. Drag the bar in the picture, or use the arrow keys. The arm is solved by the same code the game uses to put hands on a ledge.</p></div>
    <div class="grid">
      <div class="card" id="ik-controls">
        <h2>Your choices</h2>
        <div class="two" id="ik-solver" role="group" aria-label="Solver"></div>
        <p class="small" id="ik-about" style="margin:6px 0"></p>
        <label id="ik-damp-row">Damping (how careful each step is): <b id="ik-damp-v"></b><input id="ik-damp" type="range" min="0.02" max="0.8" step="0.02"></label>
        <h2 style="margin-top:10px">Joint limits</h2>
        <div class="two" id="ik-limits" role="group" aria-label="Joint limits"></div>
        <p class="small" id="ik-limits-about" style="margin:6px 0"></p>
        <h2 style="margin-top:10px">The neck rule</h2>
        <div class="two" id="ik-neck" role="group" aria-label="Neck rule"></div>
        <label>How crouched the body is: <b id="ik-fold-v"></b><input id="ik-fold" type="range" min="0" max="1" step="0.05"></label>
        <h2 style="margin-top:10px">Where the bar is</h2>
        <div class="pre" id="ik-presets"></div>
        <button id="ik-slide" style="margin-top:6px;width:100%;font:700 14px system-ui;padding:9px;border:0;border-radius:8px;background:${TEAL};color:#fff;cursor:pointer">Slide the bar out to the breaking point</button>
      </div>
      <div style="display:grid;gap:14px;min-width:0">
        <div class="card"><h2>The Rookie, seen from the side</h2>
          <canvas id="ik-pic" width="${W}" height="${H}" style="width:100%;height:auto;display:block;border-radius:6px;background:#eef3ee" tabindex="0" aria-label="Side view: drag the bar"></canvas>
          <div style="display:flex;gap:14px;align-items:center;margin-top:6px;flex-wrap:wrap"><label style="display:flex;gap:6px;margin:0;align-items:center"><input type="checkbox" id="ik-map" checked>Show where the hand can and cannot go</label><span class="small">Green: the hand lands on the bar. Red: it misses, darker is further. Ring: the breaking point on the line from the shoulder to the bar.</span></div></div>
        <div class="card" id="ik-out"><h2>What the arm is doing</h2><dl class="facts" id="ik-facts"></dl></div>
        <div class="card" id="ik-cmp"><h2>What the game does</h2><div id="ik-cmp-body"></div></div>
        <div class="card"><details id="ik-maths"><summary>The maths</summary><div class="eq" id="ik-maths-body"></div></details></div>
      </div>
    </div>`;
  const $ = <T extends HTMLElement>(id: string): T => wrap.querySelector("#" + id) as T;
  const msg = (t: string) => { $("ik-facts").innerHTML = `<dt>Loading</dt><dd>${t}</dd>`; };
  msg("the Rookie");

  let body: Body;
  try {
    const [runRaw, landRaw] = await Promise.all([fetch("/assets/motion/run.json").then((r) => r.json()), fetch("/assets/motion/land.json").then((r) => r.json())]);
    const run: Clip = parseClip(runRaw), land: Clip = parseClip(landRaw);
    const rookie = await loadRookie("a", run.names, run.parents);
    body = makeBody(run, land, rookie.rig.bones.map((b) => b.restPos.clone()), rookie.legLength);
  } catch (e) {
    $("ik-facts").innerHTML = `<dt>Could not load</dt><dd class="bad">${(e as Error).message}</dd>`;
    return { backend: "canvas2d" };
  }

  const c: Choices = { ...DEFAULT_CHOICES };
  const target = { x: PRESETS[0][2], y: PRESETS[0][3] };
  let warm: { phi: number; bend: number } | undefined;
  let dragging = false, flips = 0, lastFlip: { x: number; y: number } | null = null, lastSide: boolean | null = null;
  let pose: Pose;
  let mapKey = "";
  let mapPic: HTMLCanvasElement | null = null, mapN = 0;
  let solves = 0;

  const toggles = (id: string, items: [string, string][], isOn: (v: string) => boolean, set: (v: string) => void) => {
    const el = $(id); el.innerHTML = "";
    for (const [v, label] of items) { const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.dataset.v = v; b.setAttribute("aria-pressed", String(isOn(v))); b.onclick = () => { set(v); warm = undefined; lastSide = null; lastFlip = null; flips = 0; refresh(); }; el.append(b); }
  };

  // ---- solve, then draw and write ----
  const solve = () => {
    pose = poseFor(body, c, target.x, target.y, dragging ? warm : undefined);
    if (dragging || c.solver === "dls") warm = { phi: pose.arm.shoulder, bend: pose.arm.bend };
    const side = pose.arm.flipped;
    if (lastSide !== null && side !== lastSide) { flips++; lastFlip = { x: target.x, y: target.y }; }
    lastSide = side;
    solves++;
  };
  const ensureMap = () => {
    const key = JSON.stringify([c.solver, c.limits, c.neck, c.fold, c.solver === "dls" ? c.damping : 0]);
    if (key === mapKey || !($<HTMLInputElement>("ik-map").checked)) return;
    mapKey = key;
    const cells = residualMap(c, pose.shoulder, pose.l1, pose.l2, MAP_HALF, MAP_STEP);
    mapN = Math.round((2 * MAP_HALF) / MAP_STEP) + 1;
    mapPic = document.createElement("canvas"); mapPic.width = mapN; mapPic.height = mapN;
    const mg = mapPic.getContext("2d")!, img = mg.createImageData(mapN, mapN);
    cells.forEach((m, k) => { // cells run from the bottom row up; the picture's first row is the top
      const col = k % mapN, row = mapN - 1 - Math.floor(k / mapN), o = (row * mapN + col) * 4;
      const ok = m.r <= MATCH;
      img.data.set(ok ? [15, 107, 92, 52] : [185, 28, 28, Math.round(255 * Math.min(0.5, 0.08 + m.r * 1.2))], o);
    });
    mg.putImageData(img, 0, 0);
  };

  const canvas = $<HTMLCanvasElement>("ik-pic");
  const g = canvas.getContext("2d")!;
  const line = (a: Vector3 | { x: number; y: number }, b: Vector3 | { x: number; y: number }, col: string, w: number) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round"; g.beginPath(); g.moveTo(sx(a.x), sy(a.y)); g.lineTo(sx(b.x), sy(b.y)); g.stroke(); };
  const brk = () => breakingPoint(c, pose.shoulder, pose.l1, pose.l2, target.x, target.y);

  const draw = () => {
    g.clearRect(0, 0, W, H);
    // grid, every half metre
    g.font = "12px system-ui"; g.fillStyle = GHOST;
    for (let x = Math.ceil(X0 * 2) / 2; x < X0 + W / PPM; x += 0.5) { g.strokeStyle = "#dbe3dc"; g.lineWidth = 1; g.beginPath(); g.moveTo(sx(x), 0); g.lineTo(sx(x), H); g.stroke(); g.fillText(`${x.toFixed(1)} m`, sx(x) + 3, H - 4); }
    for (let y = 0; y < 2; y += 0.5) { g.strokeStyle = "#dbe3dc"; g.beginPath(); g.moveTo(0, sy(y)); g.lineTo(W, sy(y)); g.stroke(); if (y > 0) g.fillText(`${y.toFixed(1)} m`, 4, sy(y) - 3); }
    g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(0, sy(0)); g.lineTo(W, sy(0)); g.stroke();
    const sh = pose.shoulder;
    // where the hand can and cannot go
    if ($<HTMLInputElement>("ik-map").checked && mapPic) {
      g.imageSmoothingEnabled = false;
      const side = mapN * MAP_STEP * PPM;
      g.drawImage(mapPic, sx(sh.x) - side / 2, sy(sh.y) - side / 2, side, side);
    }
    // the reach: the circle the full arm draws, and the smallest circle the folded arm can make
    g.setLineDash([5, 5]); g.strokeStyle = GHOST; g.lineWidth = 1.5;
    g.beginPath(); g.arc(sx(sh.x), sy(sh.y), maxReach(pose.l1, pose.l2) * PPM, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(sx(sh.x), sy(sh.y), minReach(pose.l1, pose.l2) * PPM, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    // the body: bones from parent to child, the near arm in teal
    const J = pose.joints, n = body.names;
    const skip = /Eye$|Jaw$|ThumbEnd$|MiddleEnd$/;
    n.forEach((nm, i) => {
      if (i === 0 || skip.test(nm)) return;
      const arm = /^Left(Shoulder|Arm|ForeArm|Hand)$/.test(nm), far = /^Right(Shoulder|Arm|ForeArm|Hand)$/.test(nm);
      line(J[body.parents[i]], J[i], arm ? TEAL : far ? "#7fb3a8" : INK, arm ? 7 : far ? 5 : 5);
    });
    n.forEach((nm, i) => { if (skip.test(nm)) return; g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.arc(sx(J[i].x), sy(J[i].y), nm === "Head" ? 22 : 4.5, 0, Math.PI * 2); if (nm === "Head") { g.fillStyle = "rgba(255,255,255,.55)"; } g.fill(); g.stroke(); });
    // the breaking point on the line from the shoulder through the bar
    const b = brk();
    line(sh, { x: sh.x + (target.x - sh.x) * 1.6, y: sh.y + (target.y - sh.y) * 1.6 }, "rgba(23,32,29,.15)", 1);
    if (b) { g.strokeStyle = AMBER; g.lineWidth = 3; g.beginPath(); g.arc(sx(b.x), sy(b.y), 11, 0, Math.PI * 2); g.stroke(); g.fillStyle = AMBER; g.font = "bold 12px system-ui"; g.fillText("breaks here", sx(b.x) + 14, sy(b.y) - 10); }
    if (lastFlip) { g.strokeStyle = "#6d28d9"; g.lineWidth = 2; g.beginPath(); g.arc(sx(lastFlip.x), sy(lastFlip.y), 8, 0, Math.PI * 2); g.stroke(); g.fillStyle = "#6d28d9"; g.font = "12px system-ui"; g.fillText("elbow flipped here", sx(lastFlip.x) + 12, sy(lastFlip.y) + 16); }
    // the bar the hand is sent to; a dashed line shows the miss
    if (pose.arm.residual > MATCH) { g.setLineDash([4, 4]); line(pose.arm.hand, target, BAD, 2); g.setLineDash([]); }
    g.fillStyle = INK; g.beginPath(); g.roundRect(sx(target.x) - 24, sy(target.y) - 6, 48, 12, 6); g.fill();
    g.strokeStyle = "#fff"; g.lineWidth = 2; g.beginPath(); g.moveTo(sx(target.x) - 14, sy(target.y)); g.lineTo(sx(target.x) + 14, sy(target.y)); g.stroke();
    g.fillStyle = pose.arm.residual > MATCH ? BAD : TEAL; g.beginPath(); g.arc(sx(pose.arm.hand.x), sy(pose.arm.hand.y), 7, 0, Math.PI * 2); g.fill();
  };

  const fact = (k: string, v: string, cls = "") => `<dt>${k}</dt><dd${cls ? ` class="${cls}"` : ""}>${v}</dd>`;
  const write = () => {
    const a = pose.arm, sh = pose.shoulder;
    const dist = Math.hypot(target.x - sh.x, target.y - sh.y), R = maxReach(pose.l1, pose.l2), r0 = minReach(pose.l1, pose.l2);
    const b = brk();
    const out = a.residual > MATCH;
    const why = dist > R ? `the bar is ${cm(dist - R)} cm beyond the full stretch` : dist < r0 ? `the bar is ${cm(r0 - dist)} cm inside the smallest fold` : a.atLimit ? "a joint is held at its limit" : "the solver stopped short";
    const nk = pose.neck;
    $("ik-facts").innerHTML =
      fact("Result", out ? `Pose breaks: the hand misses by ${cm(a.residual)} cm (${why})` : "Hand is on the bar", out ? "bad" : "") +
      fact("Residual error", `${cm(a.residual)} cm`) +
      fact("Elbow bend", `${deg(a.bend).toFixed(0)}° (0° is a straight arm)`) +
      fact("Shoulder angle", `${deg(a.shoulder).toFixed(0)}° (0° is hanging, 90° is straight ahead)`) +
      fact("Elbow side", a.flipped ? "Flipped: the elbow points the wrong way for a person" : "Natural: the elbow points down", a.flipped ? "warn" : "") +
      fact("Elbow flips so far", String(flips)) +
      fact("Bar to shoulder", `${cm(dist)} cm`) +
      fact("Arm reach", `from ${cm(r0)} cm (folded) to ${cm(R)} cm (full stretch)`) +
      fact("Breaking point", b ? `${cm(b.distance)} cm from the shoulder along this line${b.distance + 0.001 < dist ? ` (the bar is ${cm(dist - b.distance)} cm past it)` : ""}` : "none found on this line") +
      (c.solver === "dls" ? fact("Steps used", `${a.iterations} (the game's two-bone uses none)`) : "") +
      fact("Joint limits", c.limits ? (a.atLimit ? "On, and one is at its end" : "On, none reached") : "Off") +
      fact("Neck bend from the trunk", `${nk.headDeg.toFixed(0)}° (the rule allows ${nk.limitDeg.toFixed(0)}°)`, nk.headDeg > nk.limitDeg + 0.5 ? "bad" : "") +
      fact("Shoulder off the chest", `${nk.shoulderCm.toFixed(1)} cm (the rule allows ${nk.shoulderLimitCm.toFixed(0)} cm)`, nk.shoulderCm > nk.shoulderLimitCm + 0.05 ? "bad" : "");
    // the game's setting on the same bar, shown last
    const game: Choices = { ...DEFAULT_CHOICES, fold: c.fold };
    const gp = poseFor(body, game, target.x, target.y);
    const row = (name: string, p: Pose, ch: Choices) => `<tr><td>${name}</td><td>${ch.solver === "two-bone" ? "Two-bone" : "Damped least squares"}</td><td>${ch.limits ? "On" : "Off"}</td><td>${ch.neck ? "On" : "Off"}</td><td>${cm(p.arm.residual)} cm</td><td>${deg(p.arm.bend).toFixed(0)}°${p.arm.flipped ? " (flipped)" : ""}</td><td>${p.neck.headDeg.toFixed(0)}°</td></tr>`;
    $("ik-cmp-body").innerHTML = `<table><thead><tr><th></th><th>Solver</th><th>Limits</th><th>Neck rule</th><th>Miss</th><th>Elbow</th><th>Head bend</th></tr></thead><tbody>${row("Yours", pose, c)}${row("The game", gp, game)}</tbody></table>
      <ul class="small" style="margin:8px 0 0;padding-left:18px">
        <li>The game uses the two-bone solver, because the arm has two bones and the answer is exact, so the same bar gives the same pose every time.</li>
        <li>It has no joint limits of its own: the hand stops at full stretch, and the elbow is pushed down and back (pole ${GAME_POLE.x}, ${GAME_POLE.y}). The hands only get a full pull when the ledge is within about one arm length, so they are never forced far past their reach.</li>
        <li>The neck rule is always on while the body is blended or hanging, because without it a crouch thrown into a hang leaves the head bent back by more than a person's neck allows.</li>
      </ul>`;
    const f = (x: number) => (x * 100).toFixed(1);
    const dl = c.damping;
    $("ik-maths-body").textContent =
`Two-bone reach (the game's solver)
  d = |target - shoulder| = ${f(dist)} cm,  l1 = ${f(pose.l1)} cm,  l2 = ${f(pose.l2)} cm
  the hand can only be on the bar if  |l1 - l2| < d < l1 + l2,  here ${f(r0)} < ${f(Math.min(Math.max(dist, 0), 9))} < ${f(R)}
  cos(elbow inside angle) = (l1^2 + l2^2 - d^2) / (2 l1 l2)
  along = (l1^2 - l2^2 + d^2) / (2 d),   out = sqrt(l1^2 - along^2)
  elbow = shoulder + along * u + out * s    (u points to the bar, s is the pole's side of u)
  past the reach d is cut to l1 + l2, so the hand stops short by d - (l1 + l2)

Damped least squares (this Lab only)
  angles q = (shoulder, elbow);  e = target - hand
  J = [ perp(hand - shoulder)   perp(hand - elbow) ]
  dq = J^T (J J^T + lambda^2 I)^-1 e,   lambda = ${dl.toFixed(2)}   (each step is cut to 0.3 rad)
  repeated until |e| < 0.5 mm.  Here: ${c.solver === "dls" ? `${a.iterations} steps` : "not used"}

Joint limits (this Lab only)
  elbow bend 0 to ${deg(ELBOW_MAX).toFixed(0)} degrees,  shoulder ${deg(SHOULDER_MIN).toFixed(0)} to ${deg(SHOULDER_MAX).toFixed(0)} degrees
  a value outside the range is cut to the range, then the arm is re-aimed at the bar

The neck rule (the game's)
  each neck bone may leave the trunk's turned standing line by ${NECK_LIMIT} rad (${deg(NECK_LIMIT).toFixed(0)} degrees), and so may the sum of the bends
  a shoulder may sit ${SHOULDER_LIMIT * 100} cm off its place on the chest; further than that, the extra is taken away
  now: head ${nk.headDeg.toFixed(1)} degrees, shoulder ${nk.shoulderCm.toFixed(1)} cm`;
  };

  const refresh = () => {
    $("ik-damp-row").hidden = c.solver !== "dls";
    $("ik-damp-v").textContent = c.damping.toFixed(2);
    $("ik-fold-v").textContent = c.fold.toFixed(2);
    $("ik-about").textContent = SOLVERS.find(([s]) => s === c.solver)![2];
    $("ik-limits-about").textContent = c.limits ? `A person's arm: the elbow bends ${deg(0).toFixed(0)}° to ${deg(ELBOW_MAX).toFixed(0)}° and only one way. The game has no such limits.` : "Only the full-stretch stop, as in the game.";
    toggles("ik-solver", SOLVERS.map(([s, l]) => [s, l]), (v) => c.solver === v, (v) => (c.solver = v as Choices["solver"]));
    toggles("ik-limits", [["on", "Limits on"], ["off", "Limits off"]], (v) => (v === "on") === c.limits, (v) => (c.limits = v === "on"));
    toggles("ik-neck", [["on", "Neck rule on"], ["off", "Neck rule off"]], (v) => (v === "on") === c.neck, (v) => (c.neck = v === "on"));
    solve(); ensureMap(); draw(); write();
    document.documentElement.dataset.labIk = String(solves);
  };

  $<HTMLInputElement>("ik-damp").value = String(c.damping);
  $<HTMLInputElement>("ik-fold").value = String(c.fold);
  $<HTMLInputElement>("ik-damp").addEventListener("input", (e) => { c.damping = Number((e.target as HTMLInputElement).value); mapKey = ""; warm = undefined; refresh(); });
  $<HTMLInputElement>("ik-fold").addEventListener("input", (e) => { c.fold = Number((e.target as HTMLInputElement).value); mapKey = ""; refresh(); });
  $<HTMLInputElement>("ik-map").addEventListener("change", () => { mapKey = ""; refresh(); });
  const presets = $("ik-presets");
  for (const [id, label, x, y] of PRESETS) { const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.dataset.preset = id; b.onclick = () => { target.x = x; target.y = y; warm = undefined; lastSide = null; lastFlip = null; flips = 0; refresh(); }; presets.append(b); }
  $("ik-slide").onclick = () => {
    const b = brk();
    if (b) { target.x = b.x; target.y = b.y; warm = undefined; refresh(); }
  };

  // ---- dragging the bar ----
  const at = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: wx(((e.clientX - r.left) / r.width) * W), y: wy(((e.clientY - r.top) / r.height) * H) }; };
  const place = (e: PointerEvent) => { const p = at(e); target.x = Math.min(wx(W - 30), Math.max(wx(30), p.x)); target.y = Math.min(wy(20), Math.max(0.05, p.y)); refresh(); };
  canvas.addEventListener("pointerdown", (e) => { dragging = true; flips = 0; lastFlip = null; lastSide = null; warm = undefined; canvas.setPointerCapture(e.pointerId); canvas.focus(); place(e); });
  canvas.addEventListener("pointermove", (e) => { if (dragging) place(e); });
  const up = () => { dragging = false; };
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (!d[e.key]) return;
    e.preventDefault(); target.x += d[e.key][0]; target.y += d[e.key][1]; refresh();
  });

  refresh();
  document.documentElement.dataset.labReady = "true";
  return { backend: "canvas2d" };
}
