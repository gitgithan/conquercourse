import { mountLabsNav } from "../ui/labs-nav";
import * as THREE from "three";
import { labsOn } from "../ui/labs";
import { labDefaultNote, labPopulated } from "../ui/lab-default";
import {
  BONES, DEFAULT_CAM, GAME_FIRST_PERSON_FOV, GAME_SIDE, IMG, JOINTS, LIMBS, LIMB_JOINTS, LIMB_LABEL, altPose, camFacts, clampCam, focalPx, foreshortening, makeCamera, maxBoneChange, maxDepthGap,
  maxPixelGap, poseA, rayThroughPixel, segmentPx, toPx, type CamSettings, type Limb,
} from "../labs/camera/camera-lab";

// Camera and perspective (CC-118 family of Labs). The player sets a lens, a height and a second angle, and sees what one photo can and cannot say.
// The pictures are made with the same three.js PerspectiveCamera the game draws with; the click-to-ray step is the editor's (Raycaster.setFromCamera).
// Nothing here talks or grades: numbers and pictures. The maths come last, behind a button (labs may show equations).
const INK = "#17201d", TEAL = "#0f6b5c", ORANGE = "#d9741a", GRID = "#d3dbd5", PURPLE = "#6d3fb3";
const SECOND_DEFAULT = 90;
const J = (n: string) => JOINTS.indexOf(n as (typeof JOINTS)[number]);

export function startLabCamera(host: HTMLElement): { backend: "canvas2d" } {
  const root = document.createElement("div");
  root.id = "lab-camera";
  root.style.cssText = `position:fixed;inset:0;overflow:auto;background:#f5f7f4;color:${INK};font:15px/1.4 system-ui,sans-serif`;
  host.append(root);
  mountLabsNav(host, "lab-camera");
  if (!labsOn()) {
    root.innerHTML = `<div style="max-width:520px;margin:12vh auto;padding:0 16px"><h1 style="font-size:22px">Camera and perspective</h1><p>Labs are switched off.</p><p><a href="?mode=lab-camera&labs=1" style="color:${TEAL}">Switch labs on</a></p></div>`;
    return { backend: "canvas2d" };
  }
  const style = document.createElement("style");
  style.textContent = `
    #lab-camera .wrap{max-width:1200px;margin:0 auto;padding:16px;display:grid;gap:14px}
    #lab-camera h1{font-size:22px;margin:0}#lab-camera h2{font-size:15px;margin:0 0 6px}
    #lab-camera .grid{display:grid;grid-template-columns:300px minmax(0,1fr);gap:14px;align-items:start}
    #lab-camera .pics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    #lab-camera .card{background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:12px}
    #lab-camera label{display:grid;gap:2px;margin:8px 0}#lab-camera input[type=range]{width:100%}
    #lab-camera label.chk{display:flex;gap:8px;align-items:center}
    #lab-camera canvas{width:100%;height:auto;display:block;border-radius:6px;background:#eef3ee}
    #lab-camera .cap{font-weight:600;font-size:13px;margin:0 0 4px}
    #lab-camera .facts{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:0}
    #lab-camera .facts dt{color:#52605a}#lab-camera .facts dd{margin:0;font-weight:600}
    #lab-camera table{border-collapse:collapse;width:100%;font-size:13px}#lab-camera th,#lab-camera td{text-align:left;padding:3px 8px 3px 0;border-bottom:1px solid #e3e8e4}
    #lab-camera .small{color:#52605a;font-size:13px}
    #lab-camera .eq{font:14px/1.6 ui-monospace,Menlo,monospace;background:#f1f4f1;border-radius:8px;padding:8px 10px;white-space:pre-wrap;overflow-x:auto}
    #lab-camera .go{font:700 14px system-ui;padding:8px 12px;border:0;border-radius:8px;background:${TEAL};color:#fff;cursor:pointer;width:100%;margin-top:6px}
    #lab-camera button.link{background:none;border:0;color:${TEAL};font:600 14px system-ui;cursor:pointer;padding:0;text-decoration:underline}
    #lab-camera a.back{color:${TEAL};font-weight:600}
    #lab-camera .sw{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-1px;margin-right:4px}
  `;
  root.append(style);
  const wrap = document.createElement("div"); wrap.className = "wrap"; root.append(wrap);
  wrap.innerHTML = `
    <div><a class="back" href="/?welcome=0">Back to the game</a>
    <h1 id="lc-h1">Camera and perspective</h1>
    <p class="small" style="margin:4px 0 0">The goal: find out why one photo cannot tell you how far away each part of a body is. Body <b style="color:${TEAL}">A</b> is a vault reach. Body <b style="color:${ORANGE}">B</b> is a different pose with the same bone lengths that makes the very same front photo. You choose the lens, the height and the angle of a second camera, and see when the second view gives B away.</p></div>
    <div class="grid">
      <div class="card" id="lc-controls">
        <h2>Your choices</h2>
        <label>Field of view: <b id="lc-fov-v"></b><input id="lc-fov" type="range" min="8" max="100" step="1"></label>
        <label>Camera height: <b id="lc-h-v"></b><input id="lc-h" type="range" min="0.2" max="4.5" step="0.1"></label>
        <label>Second camera angle: <b id="lc-a-v"></b><input id="lc-a" type="range" min="0" max="180" step="1"></label>
        <label class="chk"><input id="lc-keep" type="checkbox"> Keep the body the same size (move back as the lens zooms)</label>
        <label id="lc-d-row">Distance from the body: <b id="lc-d-v"></b><input id="lc-d" type="range" min="1.5" max="60" step="0.5"></label>
        <h2 style="margin-top:12px">Which limbs of body B are flipped?</h2>
        <div id="lc-flips"></div>
        <p class="small" style="margin:6px 0 0">A flipped joint sits on the same line of sight from the front camera, at the other spot that keeps the bone the same length.</p>
        <p class="small" style="margin:6px 0 0">Click the front photo to send a line of sight through that pixel.</p>
        <button class="go" id="lc-keepbtn">Keep this camera in the table</button>
      </div>
      <div style="display:grid;gap:14px;min-width:0">
        <div class="pics">
          <div class="card"><p class="cap">Front photo: A and B make the same picture</p><canvas id="lc-front" width="${IMG}" height="${IMG}"></canvas></div>
          <div class="card"><p class="cap">Second camera: body A</p><canvas id="lc-a-pic" width="${IMG}" height="${IMG}"></canvas></div>
          <div class="card"><p class="cap">Second camera: body B (A faint)</p><canvas id="lc-b-pic" width="${IMG}" height="${IMG}"></canvas></div>
        </div>
        <p class="small" style="margin:0"><span class="sw" style="background:${TEAL}"></span>Body A <span class="sw" style="background:${ORANGE};margin-left:10px"></span>Body B <span class="sw" style="background:${PURPLE};margin-left:10px"></span>Line of sight through the pixel you clicked <span class="sw" style="background:#9aa5a0;margin-left:10px"></span>Lines of sight through flipped joints</p>
        <div class="card"><h2>What the cameras show</h2><dl class="facts" id="lc-cam"></dl></div>
        <div class="card"><h2>Same photo, different body</h2><dl class="facts" id="lc-twin"></dl></div>
        <div class="card"><h2>How much of each bone you see (body A)</h2><table><thead><tr><th>Bone</th><th>Real length</th><th>Front: share shown</th><th>Second camera: share shown</th></tr></thead><tbody id="lc-fore"></tbody></table>
          <p class="small" style="margin:6px 0 0">Share shown: 1 means the bone lies across the picture; near 0 means it points at the lens.</p></div>
        <div class="card" id="lc-hist" hidden><h2>Cameras you kept</h2><table><thead><tr><th>#</th><th>Lens</th><th>Height</th><th>Second angle</th><th>Distance</th><th>Near/far size</th><th>B shows in second view by</th></tr></thead><tbody id="lc-rows"></tbody></table></div>
        <div class="card" id="lc-eq"><h2>The maths</h2><button class="link" id="lc-eq-btn">Show the maths behind this picture</button><div class="eq" id="lc-eq-body" hidden></div></div>
        <div class="card" id="lc-ours"><h2>What the game does</h2><div id="lc-ours-body"></div></div>
      </div>
    </div>`;
  const $ = <T extends HTMLElement>(id: string): T => wrap.querySelector("#" + id) as T;
  const cam: CamSettings = { ...DEFAULT_CAM }; // the front camera's lens and height; the second camera shares them
  let second = SECOND_DEFAULT;
  const flips = new Set<Limb>(["armR", "legR"]);
  const A = poseA();
  let click: { x: number; y: number } | null = null;
  let kept = 0;
  let lastGap = 0;

  const fixedFront = () => makeCamera({ ...clampCam(cam), angle: 0 });
  const secondCam = () => makeCamera({ ...clampCam(cam), angle: second });

  // ---- drawing ----
  const line = (g: CanvasRenderingContext2D, a: THREE.Vector3, b: THREE.Vector3, c: THREE.PerspectiveCamera) => { const s = segmentPx(c, a, b); if (!s) return; g.beginPath(); g.moveTo(s[0].x, s[0].y); g.lineTo(s[1].x, s[1].y); g.stroke(); };
  function drawBody(g: CanvasRenderingContext2D, c: THREE.PerspectiveCamera, pose: THREE.Vector3[], colour: string, w: number, alpha = 1) {
    const f = focalPx(c.fov);
    g.globalAlpha = alpha; g.strokeStyle = colour; g.fillStyle = colour; g.lineWidth = w; g.lineCap = "round";
    for (const [p, i] of BONES) line(g, pose[p], pose[i], c);
    for (let i = 0; i < pose.length; i++) { const p = toPx(c, pose[i]); if (p.depth <= 0.1) continue; const r = i === J("head") ? Math.max(3, (f * 0.11) / p.depth) : Math.max(2, (f * 0.03) / p.depth); g.beginPath(); g.arc(p.x, p.y, r, 0, 7); if (i === J("head")) { g.lineWidth = 2; g.stroke(); } else g.fill(); }
    g.globalAlpha = 1;
  }
  function drawScene(canvas: HTMLCanvasElement, c: THREE.PerspectiveCamera, layers: { pose: THREE.Vector3[]; colour: string; w: number; alpha?: number }[], rays: { a: THREE.Vector3; b: THREE.Vector3; colour: string; w: number; dash?: number[] }[], mark: number[]) {
    const g = canvas.getContext("2d")!;
    g.clearRect(0, 0, IMG, IMG);
    g.strokeStyle = GRID; g.lineWidth = 1; // a floor of 1 m squares: its lines meet at the vanishing points
    for (let k = -4; k <= 4; k++) { line(g, new THREE.Vector3(-60, 0, k), new THREE.Vector3(60, 0, k), c); line(g, new THREE.Vector3(k, 0, -60), new THREE.Vector3(k, 0, 60), c); }
    for (const r of rays) { g.strokeStyle = r.colour; g.lineWidth = r.w; g.setLineDash(r.dash ?? []); line(g, r.a, r.b, c); g.setLineDash([]); }
    for (const l of layers) drawBody(g, c, l.pose, l.colour, l.w, l.alpha ?? 1);
    for (const i of mark) { const p = toPx(c, layers[layers.length - 1].pose[i]); if (p.depth > 0.1) { g.strokeStyle = "#b91c1c"; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, 8, 0, 7); g.stroke(); } }
  }

  const f1 = (v: number, d = 1) => v.toFixed(d);
  const pt = (p: { x: number; y: number } | null) => (p ? `(${f1(p.x - IMG / 2, 0)}, ${f1(IMG / 2 - p.y, 0)}) px from the middle` : "none: the lines run across the picture, never meeting");

  function render() {
    const c = clampCam(cam);
    const front = fixedFront(), sc = secondCam();
    const alt = altPose(A, front, [...flips]);
    const B = alt.pose;
    const rays: { a: THREE.Vector3; b: THREE.Vector3; colour: string; w: number; dash?: number[] }[] = [];
    const reach = front.position.length() + 3;
    for (const l of flips) for (const j of [0, 1]) { const idx = LIMB_JOINTS[l][j]; const d = A[idx].clone().sub(front.position).normalize(); rays.push({ a: front.position.clone(), b: front.position.clone().addScaledVector(d, reach), colour: "#9aa5a0", w: 1.5 }); }
    if (click) { const r = rayThroughPixel(front, click.x, click.y); rays.push({ a: r.origin.clone(), b: r.origin.clone().addScaledVector(r.direction, reach), colour: PURPLE, w: 2.5, dash: [6, 4] }); }
    const bad = alt.approx;
    drawScene($("lc-front"), front, [{ pose: B, colour: ORANGE, w: 7 }, { pose: A, colour: TEAL, w: 3 }], click ? [{ a: front.position, b: front.position, colour: PURPLE, w: 1 }] : [], []);
    if (click) { const g = $<HTMLCanvasElement>("lc-front").getContext("2d")!; g.strokeStyle = PURPLE; g.lineWidth = 2; g.beginPath(); g.arc(click.x, click.y, 7, 0, 7); g.stroke(); }
    drawScene($("lc-a-pic"), sc, [{ pose: A, colour: TEAL, w: 4 }], rays, []);
    drawScene($("lc-b-pic"), sc, [{ pose: A, colour: TEAL, w: 3, alpha: 0.25 }, { pose: B, colour: ORANGE, w: 4 }], rays, bad);

    // controls text
    $("lc-fov-v").textContent = `${f1(c.fov, 0)} degrees`; $("lc-h-v").textContent = `${f1(c.height)} m`; $("lc-a-v").textContent = `${f1(second, 0)} degrees from the front`;
    $("lc-d-v").textContent = `${f1(c.dist)} m`; $("lc-d-row").hidden = c.keepSize;
    const cf = camFacts(front, A), sf = camFacts(sc, A);
    $("lc-cam").innerHTML = [
      ["Focal length (pixels)", `${f1(cf.focalPx, 0)} px, from the lens`],
      ["Distance and height", `${f1(cf.dist)} m back, ${f1(cf.height)} m up, looking ${f1(Math.abs(cf.tilt))} degrees ${cf.tilt < 0 ? "down" : "up"}`],
      ["Horizon row (front)", cf.horizon === null ? "off the picture" : `${f1(cf.horizon, 0)} px from the top (the middle is ${IMG / 2})`],
      ["Vanishing point of the lane (front)", pt(cf.vpTrack)],
      ["Vanishing point of the lane (second)", pt(sf.vpTrack)],
      ["Vanishing point across the lane (second)", pt(sf.vpAcross)],
      ["Nearest joint looks this much bigger than the farthest (front)", `${f1(cf.nearFar, 2)} times`],
      ["The same, second camera", `${f1(sf.nearFar, 2)} times`],
    ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
    const dgap = maxDepthGap(A, B, front), frontGap = maxPixelGap(front, A, B), secGap = maxPixelGap(sc, A, B);
    lastGap = secGap;
    $("lc-twin").innerHTML = [
      ["Gap between A and B in the front photo", `${frontGap.toFixed(3)} px${bad.length ? " (not counting the red-ringed joints)" : ""}`],
      ["Gap in depth, A to B (metres you cannot read off the photo)", `${f1(dgap, 2)} m`],
      ["Change in any bone length", `${maxBoneChange(A, B).toExponential(1)} m`],
      ["Gap between A and B in the second camera", `${f1(secGap, 0)} px${secGap < 4 ? ": the second camera cannot tell them apart" : ""}`],
      ["Joints with no exact twin", bad.length ? bad.map((i) => JOINTS[i]).join(", ") + ": the bone is too short to reach the line of sight, so B puts it at the nearest spot" : "none"],
    ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
    const fa = foreshortening(front, A), fs = foreshortening(sc, A);
    $("lc-fore").innerHTML = fa.map((r, i) => `<tr><td>${r.name}</td><td>${f1(r.trueLen * 100, 0)} cm</td><td>${f1(r.share, 2)}</td><td>${f1(fs[i].share, 2)}</td></tr>`).join("");
    document.documentElement.dataset.labCamGap = f1(secGap, 1);
  }

  // ---- controls ----
  const bind = (id: string, set: (v: number) => void) => $<HTMLInputElement>(id).addEventListener("input", (e) => { set(Number((e.target as HTMLInputElement).value)); render(); });
  bind("lc-fov", (v) => (cam.fov = v)); bind("lc-h", (v) => (cam.height = v)); bind("lc-a", (v) => (second = v)); bind("lc-d", (v) => (cam.dist = v));
  const setSliders = () => { $<HTMLInputElement>("lc-fov").value = String(cam.fov); $<HTMLInputElement>("lc-h").value = String(cam.height); $<HTMLInputElement>("lc-a").value = String(second); $<HTMLInputElement>("lc-d").value = String(cam.dist); $<HTMLInputElement>("lc-keep").checked = cam.keepSize; };
  $<HTMLInputElement>("lc-keep").addEventListener("change", (e) => { cam.keepSize = (e.target as HTMLInputElement).checked; render(); });
  const fl = $("lc-flips");
  for (const l of LIMBS) {
    const lab = document.createElement("label"); lab.className = "chk";
    lab.innerHTML = `<input type="checkbox" data-limb="${l}"> ${LIMB_LABEL[l]}`;
    const cb = lab.querySelector("input")!; cb.checked = flips.has(l);
    cb.addEventListener("change", () => { if (cb.checked) flips.add(l); else flips.delete(l); render(); });
    fl.append(lab);
  }
  $<HTMLCanvasElement>("lc-front").addEventListener("click", (e) => {
    const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
    click = { x: ((e.clientX - r.left) / r.width) * IMG, y: ((e.clientY - r.top) / r.height) * IMG };
    render();
  });
  $<HTMLButtonElement>("lc-keepbtn").onclick = () => {
    kept++; $("lc-hist").hidden = false;
    const c = clampCam(cam), f = camFacts(fixedFront(), A);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${kept}</td><td>${f1(c.fov, 0)} deg</td><td>${f1(c.height)} m</td><td>${f1(second, 0)} deg</td><td>${f1(f.dist)} m</td><td>${f1(f.nearFar, 2)}x</td><td>${f1(lastGap, 0)} px</td>`;
    $("lc-rows").append(tr);
    document.documentElement.dataset.labDone = String(kept);
  };

  // ---- compare: our setting last ----
  const g1 = makeCamera(GAME_SIDE), gf = camFacts(g1, A);
  const gShare = foreshortening(g1, A).find((r) => r.name === "right forearm")!.share;
  $("lc-ours-body").innerHTML = `
    <table><thead><tr><th>Camera</th><th>Lens</th><th>Where</th><th>Nearest joint looks bigger by</th></tr></thead><tbody>
    <tr><td>Side view (the one you play with)</td><td>40 degrees</td><td>about 25 m back, a few metres up</td><td>${f1(gf.nearFar, 2)}x</td></tr>
    <tr><td>Looking ahead (the corner window)</td><td>${GAME_FIRST_PERSON_FOV} degrees</td><td>at the runner's eyes</td><td>depends on the scene, the lens alone is wide</td></tr></tbody></table>
    <ul style="margin:8px 0 0;padding-left:20px">
      <li>The side view stands far back with a long-ish lens, so a thing 1 m nearer the camera looks only ${f1((gf.nearFar - 1) * 100, 0)} percent bigger.</li>
      <li>That keeps sizes and gaps along the lane true on screen, which is what a player needs to judge the next jump.</li>
      <li>It also looks across the lane, where a bone like the right forearm lies flat to the picture (share shown ${f1(gShare, 2)}), so the move reads clearly.</li>
      <li>The wide ${GAME_FIRST_PERSON_FOV}-degree window is the opposite: it exaggerates depth on purpose, so speed feels fast, and nothing there asks you to measure.</li>
      <li>For filming your own move we ask for a side or three-quarter view and a normal lens, because a front view cannot separate bodies like A and B (this Lab).</li>
    </ul>
    <button class="link" id="lc-try">Set the controls to the game's side camera</button>`;
  $<HTMLButtonElement>("lc-try").onclick = () => { Object.assign(cam, GAME_SIDE); second = 90; setSliders(); render(); };

  // ---- the maths, after a look ----
  $<HTMLButtonElement>("lc-eq-btn").onclick = () => {
    const c = clampCam(cam), f = focalPx(c.fov), d = fixedFront().position.length();
    const body = $("lc-eq-body"); body.hidden = false;
    body.textContent =
`Field of view to focal length (picture ${IMG} px tall):
  f = (H / 2) / tan(fov / 2) = ${IMG / 2} / tan(${f1(c.fov, 0)} / 2) = ${f1(f, 1)} px

Pinhole projection of a point (X, Y, Z) in the camera's frame, Z the distance along the view:
  u = cx + f · X / Z      v = cy − f · Y / Z
  Double the distance Z and everything is half as big, so the picture alone never says whether a thing is small and near or big and far.

Why one photo has many bodies (the line of sight):
  Every point  P(t) = O + t · r  on the ray  r  through a pixel lands on that pixel.
  A bone of length L from a known parent Q must satisfy  | O + t·r − Q |² = L²
  which is  t² + 2 t (r · w) + ( |w|² − L² ) = 0   with  w = O − Q
  Two answers, t = −r·w ± sqrt( (r·w)² − |w|² + L² ): one near, one far. Flipping a joint takes the other one.
  Here the front camera is O = ${fixedFront().position.toArray().map((v) => v.toFixed(2)).join(", ")} (${f1(d)} m from the middle).

Vanishing point of lines that run in direction d (camera frame d = (dx, dy, dz), dz not 0):
  u = cx + f · dx / dz      v = cy − f · dy / dz
  If dz = 0 the lines are parallel to the picture and never meet.

Foreshortening: a bone of length L at depth Z seen at angle a to the view direction shows
  s ≈ f · L · sin(a) / Z   pixels, so  share shown = sin(a)  (1 across the picture, 0 pointing at the lens).`;
    $<HTMLButtonElement>("lc-eq-btn").hidden = true;
  };

  setSliders();
  labDefaultNote(wrap, "live", $("lc-h1")); // opens on the front camera where bodies A and B look the same, with the game's cameras beside it
  render();
  labPopulated("lab-camera");
  document.documentElement.dataset.labReady = "true";
  return { backend: "canvas2d" };
}
