import { mountLabsNav } from "../ui/labs-nav";
import { labsOn } from "../ui/labs";
import { labDefaultNote, labPopulated } from "../ui/lab-default";
import { readGlbMesh } from "../slice/glb";
import type { Mesh } from "../slice/slice";
import {
  ALL_STEPS, FACE_CAP, clampPitch, clampZoom, dragTurn, normTurn, parseRawGlb, realToMeta, toDisplay, type RealLift, RECORDED_COST, RECORDED_LIFTS, STEP_NAMES, barLength, bake, bounds, recipeFor, sizeWarning, withExtraYaw, typicalHeight, unbake, parseRawPack, rawFromPack, type RawPackMeta, type Steps,
} from "../labs/lift/lift-core";
import { drawOrbit, frameCam } from "../labs/lift/orbit-view";

// Lab 14: Cut-out, lift and bake (pipeline stages 3 and 4 of 6).
// It runs the bake rules from src/labs/lift/lift-core.ts on a recorded, baked game object turned back into a raw-looking lift.
// Nothing talks or grades: numbers and pictures. No model is run; the cut-outs, lifts and costs are recorded.
const INK = "#17201d", TEAL = "#0f6b5c", ORANGE = "#d9741a", GRID = "#d3dbd5";
interface Obj { name: string; label: string; glb: string; height_m: number; photo: string; faces: number; scale_source: string; author?: string; licence?: string }
const CUTOUTS: Record<string, string> = { "bench-concrete": "bench01-cutout.jpg", "railing-iron": "rail01-cutout.jpg" };

export function startLabLift(host: HTMLElement): { backend: "canvas2d" } {
  const root = document.createElement("div");
  root.id = "lab-lift";
  root.style.cssText = `position:fixed;inset:0;overflow:auto;background:#f5f7f4;color:${INK};font:15px/1.4 system-ui,sans-serif`;
  host.append(root);
  mountLabsNav(host, "lab-lift");
  if (!labsOn()) {
    root.innerHTML = `<div style="max-width:520px;margin:12vh auto;padding:0 16px"><h1 style="font-size:22px">Lab 14: Cut-out, lift and bake</h1><p>Labs are switched off.</p><p><a href="?mode=lab-lift&labs=1" style="color:${TEAL}">Switch labs on</a></p></div>`;
    return { backend: "canvas2d" };
  }
  const style = document.createElement("style");
  style.textContent = `
    #lab-lift .wrap{max-width:1200px;margin:0 auto;padding:60px 16px 16px;display:grid;gap:14px}
    #lab-lift h1{font-size:22px;margin:0}#lab-lift h2{font-size:15px;margin:0 0 6px}
    #lab-lift .grid{display:grid;grid-template-columns:340px minmax(0,1fr);gap:14px;align-items:start}
    #lab-lift .pics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    #lab-lift .card{background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:12px}
    #lab-lift label{display:grid;gap:2px;margin:6px 0}#lab-lift input[type=range]{width:100%}
    #lab-lift label.chk{display:flex;gap:8px;align-items:flex-start}
    #lab-lift canvas{width:100%;height:auto;display:block;border-radius:6px;background:#eef3ee}
    #lab-lift .cap{font-weight:600;font-size:13px;margin:0 0 4px}
    #lab-lift .facts{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:0}
    #lab-lift .facts dt{color:#52605a}#lab-lift .facts dd{margin:0;font-weight:600}
    #lab-lift table{border-collapse:collapse;width:100%;font-size:13px}#lab-lift th,#lab-lift td{text-align:left;padding:3px 8px 3px 0;border-bottom:1px solid #e3e8e4}
    #lab-lift .small{color:#52605a;font-size:13px}#lab-lift .bad{color:${ORANGE};font-weight:700}
    #lab-lift a{color:${TEAL};font-weight:600}#lab-lift img{max-width:100%;border-radius:6px;display:block}
    #lab-lift select{font:inherit;width:100%;padding:4px}
    #lab-lift .eq{font:14px/1.6 ui-monospace,Menlo,monospace;background:#f1f4f1;border-radius:8px;padding:8px 10px;white-space:pre-wrap}
  `;
  root.append(style);
  const wrap = document.createElement("div"); wrap.className = "wrap"; root.append(wrap);
  wrap.innerHTML = `
    <div><a href="/?welcome=0">Back to the game</a>
    <h1>Lab 14: Cut-out, lift and bake</h1>
    <p class="small" style="margin:2px 0"><b>Pipeline stages 3 and 4 of 6: Lift to 3D, then Bake</b> (photo to course object; stage 2, the cut-out, is shown here as recorded). Before: <a href="?mode=lab-vision&labs=1&welcome=0">Lab 4, Computer vision</a> (the cut-out: which photos are safe) and <a href="?mode=lab-camera&labs=1&welcome=0">Lab 5, Camera and perspective</a> (why one photo gives no depth). After: collision fitted from the 3D, then placing it on a course (collision from 3D (<code>docs/collision-from-3d.md</code>)).</p>
    <p class="small" style="margin:4px 0 0">The goal: see how a photo becomes a game object. A person draws a box, a model cuts the object out, a second model lifts it into 3D, and seven plain bake rules make it upright, facing the side camera, on the ground, small enough and the right size. Pick an object, drag the height, and switch each rule off to see what it was for. The cut-outs, lifts and costs are recorded; the bake rules run live.</p></div>
    <div class="card" id="ll-3d"><h2>Spin it in 3D</h2>
      <p class="small" style="margin:0 0 6px">Drag the left one to turn the raw lift. Drag the right one to walk around the baked object. Wheel or the buttons zoom. Arrow keys work too.</p>
      <div class="pics" style="grid-template-columns:repeat(2,minmax(0,1fr))">
        <div><p class="cap">Raw lift: tilted, floating, its own size</p><canvas id="ll-3d-raw" width="590" height="400" tabindex="0" aria-label="Raw lift in 3D: drag to turn" style="cursor:grab;touch-action:none"></canvas></div>
        <div><p class="cap">After the bake: upright, on the ground, facing the side camera</p><canvas id="ll-3d-baked" width="590" height="400" tabindex="0" aria-label="Baked object in 3D: drag to walk around" style="cursor:grab;touch-action:none"></canvas></div>
      </div>
      <p style="margin:8px 0 0;display:flex;gap:8px;flex-wrap:wrap"><button id="ll-zin" type="button">Zoom in</button><button id="ll-zout" type="button">Zoom out</button><button id="ll-reset" type="button">Reset view</button></p>
    </div>
    <div class="grid">
      <div class="card" id="ll-controls">
        <h2>Your choices</h2>
        <label>Object (a real raw lift, or a baked game object)<select id="ll-obj"></select></label>
        <label class="chk"><input id="ll-typed-on" type="checkbox"> <span>Type a height (otherwise the typical one for the label)</span></label>
        <label>Typed height: <b id="ll-h-v"></b><input id="ll-h" type="range" min="0.1" max="3" step="0.05"></label>
        <label>Turn the raw lift about the vertical: <b id="ll-yaw-v"></b><input id="ll-yaw" type="range" min="0" max="359" step="1" value="0" aria-label="Turn the raw lift"></label>
        <p class="small" style="margin:0">Same as dragging the raw 3D picture. "Face the side camera" turns it back.</p>
        <h2 style="margin-top:12px">Bake steps (tick = on)</h2>
        <div id="ll-steps"></div>
      </div>
      <div style="display:grid;gap:14px;min-width:0">
        <div class="pics">
          <div class="card"><p class="cap">Raw lift, as it arrives (z is up, seen from a little above)</p><canvas id="ll-raw" width="340" height="300"></canvas></div>
          <div class="card"><p class="cap">After the bake: side camera</p><canvas id="ll-side" width="340" height="300"></canvas></div>
          <div class="card"><p class="cap">After the bake: from above</p><canvas id="ll-top" width="340" height="300"></canvas></div>
        </div>
        <div class="card"><h2>What came out</h2><dl class="facts" id="ll-facts"></dl><p id="ll-break" class="small" style="margin:6px 0 0"></p></div>
        <div class="card"><h2>The cut-out (recorded)</h2><div id="ll-cut"></div></div>
      </div>
    </div>
    <div class="card" id="ll-thin"><h2>The thin-bar lesson: the typed height stretches a bar</h2>
      <p class="small" style="margin:0 0 6px">Recorded: monkey bars from a photo of a park. The bar is long and thin, so its "height" is the thin direction. The lift says the bar is ${RECORDED_COST.monkeyBars.extent_aspect} times longer than it is high.</p>
      <label>Typed height for the monkey bars: <b id="ll-mh-v"></b><input id="ll-mh" type="range" min="0.05" max="3" step="0.05"></label>
      <p>The bar becomes <b id="ll-mlen"></b> long. <span id="ll-mwarn" class="bad"></span></p>
      <p class="small" style="margin:0">Recorded: 2.4 m gave a 52 m bar on the first try, 0.25 m gave 5 m. In the same way a thin shadow strip was scaled by its typical height to 33 m. So the box is checked before the lift.</p></div>
    <div class="card"><h2>What one object cost (recorded, not measured now)</h2><table id="ll-cost"></table></div>
    <div class="card"><button id="ll-eq-btn" class="go" style="font:700 14px system-ui;padding:6px 10px;border:0;border-radius:8px;background:${TEAL};color:#fff;cursor:pointer">Show the maths</button>
      <div id="ll-eq-body" class="eq" hidden style="margin-top:8px">scale factor = target height / the lift's height     (bench: 0.8 / 0.4246 = 1.884, recorded 1.8842)
turn about the vertical: choose the angle t in [0, 180) that makes the box  (max x - min x) x (max z - min z)  smallest, then put the longer side on x
z-up to y-up:  (x, y, z) -> (x, z, -y)
colour of a Gaussian:  0.5 + 0.282 x dc     (degree 0)
bar length = typed height x (length / height of the lift)     (monkey bars: 2.4 x 21.7 = 52 m)</div></div>
    <div class="card"><h2>What we chose in the game, and why</h2>
      <p class="small" style="margin:0">All seven rules are on. The photo becomes a skin only: the collider is a fitted box, never this mesh (next stage). Eight real raw lifts are in the page, thinned to 6,000 triangles each (the full ones weigh about 10 MB each); they keep the lift's own turn, size and tilt. For the other baked objects the raw lift was not kept, so the Lab turns the baked object back into a raw-looking lift (a stand-in) and bakes it again. See <code>docs/labs/lift.md</code>.</p></div>
    <p class="small">Credits: bench photo by Rick Obst (CC BY 2.0), railing photo by Peter Broster (CC0), monkey bars photo by Koefbac (CC BY-SA 4.0).</p>
  `;
  const $ = <T extends HTMLElement>(id: string) => wrap.querySelector<T>("#" + id)!;
  const sel = $<HTMLSelectElement>("ll-obj"), typedOn = $<HTMLInputElement>("ll-typed-on"), hRange = $<HTMLInputElement>("ll-h"), yawRange = $<HTMLInputElement>("ll-yaw");
  const state = { steps: { ...ALL_STEPS } as Steps, obj: null as Obj | null, mesh: null as Mesh | null, tri: [] as string[], real: null as RawPackMeta | null };
  const view = { pitch: 25, zoom: 1, bakedAz: 25 }; // the camera; the raw object's turn lives in the slider (one source of truth)
  const stepsBox = $("ll-steps");
  for (const s of STEP_NAMES) {
    const l = document.createElement("label"); l.className = "chk";
    l.innerHTML = `<input type="checkbox" data-step="${s.key}" checked><span><b>${s.name}</b><br><span class="small">${s.rule}</span></span>`;
    stepsBox.append(l);
  }

  // Colour: read each triangle's colour from the baked object's own picture (same UVs as the vertices).
  async function triangleColours(buf: ArrayBuffer, nTri: number, indices: ArrayLike<number>): Promise<string[]> {
    try {
      const dv = new DataView(buf); let json: any = null, bin = 0;
      for (let at = 12; at < dv.byteLength;) { const len = dv.getUint32(at, true), type = dv.getUint32(at + 4, true); if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, at + 8, len))); else if (type === 0x004e4942) bin = at + 8; at += 8 + len + ((4 - (len % 4)) % 4); }
      const uvA = json.accessors[json.meshes[0].primitives[0].attributes.TEXCOORD_0], uvV = json.bufferViews[uvA.bufferView], uvBase = bin + (uvV.byteOffset ?? 0) + (uvA.byteOffset ?? 0);
      const im = json.bufferViews[json.images[0].bufferView];
      const bmp = await createImageBitmap(new Blob([new Uint8Array(buf, bin + (im.byteOffset ?? 0), im.byteLength)], { type: "image/jpeg" }));
      const cv = document.createElement("canvas"); cv.width = bmp.width; cv.height = bmp.height;
      const cx = cv.getContext("2d")!; cx.drawImage(bmp, 0, 0);
      const px = cx.getImageData(0, 0, bmp.width, bmp.height).data, out: string[] = [];
      for (let t = 0; t < nTri; t++) {
        let u = 0, v = 0;
        for (let k = 0; k < 3; k++) { const i = indices[t * 3 + k]; u += dv.getFloat32(uvBase + i * 8, true) / 3; v += dv.getFloat32(uvBase + i * 8 + 4, true) / 3; }
        const x = Math.min(bmp.width - 1, Math.max(0, Math.floor(u * bmp.width))), y = Math.min(bmp.height - 1, Math.max(0, Math.floor(v * bmp.height))), o = (y * bmp.width + x) * 4;
        out.push(`rgb(${px[o]},${px[o + 1]},${px[o + 2]})`);
      }
      return out;
    } catch { return []; }
  }

  // Orthographic drawing: pick which two axes go across and up, and which one is the depth (bigger depth is drawn on top).
  function draw(cv: HTMLCanvasElement, m: Mesh, ax: number, ay: number, depth: number, flipDepth: boolean, win: { cx: number; cy: number; span: number } | null, colour: boolean, scaleBar: boolean) {
    const ctx = cv.getContext("2d")!, W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const b = bounds(m), w = win ?? (() => { const sp = Math.max(b.size[ax], b.size[ay]) * 1.25 || 1; return { cx: (b.min[ax] + b.max[ax]) / 2, cy: (b.min[ay] + b.max[ay]) / 2, span: sp }; })();
    const s = Math.min(W, H) / w.span, X = (v: number) => W / 2 + (v - w.cx) * s, Y = (v: number) => H / 2 - (v - w.cy) * s;
    ctx.strokeStyle = GRID; ctx.fillStyle = "#52605a"; ctx.font = "11px system-ui"; ctx.lineWidth = 1;
    if (win) { // a 1 m grid and the ground line at y = 0 (baked views)
      for (let g = Math.ceil(w.cx - w.span / 2); g <= w.cx + w.span / 2; g++) { ctx.beginPath(); ctx.moveTo(X(g), 0); ctx.lineTo(X(g), H); ctx.stroke(); }
      ctx.strokeStyle = TEAL; if (ay === 1) { ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(W, Y(0)); ctx.stroke(); ctx.fillText("ground", 4, Y(0) - 3); }
      ctx.fillText("1 m squares", 4, 12);
      if (scaleBar && ay === 1) { ctx.fillStyle = "#c8d3cc"; ctx.fillRect(X(w.cx + w.span / 2) - 14, Y(1.8), 10, Y(0) - Y(1.8)); ctx.fillStyle = "#52605a"; ctx.fillText("1.8 m", X(w.cx + w.span / 2) - 40, Y(1.8) - 3); }
    } else ctx.fillText(`${w.span.toFixed(2)} m across (own scale)`, 4, 12);
    const p = m.positions, idx = m.indices!, n = idx.length / 3, order: number[] = [];
    for (let t = 0; t < n; t++) order.push(t);
    const dep = (t: number) => (p[idx[t * 3] * 3 + depth] + p[idx[t * 3 + 1] * 3 + depth] + p[idx[t * 3 + 2] * 3 + depth]) * (flipDepth ? -1 : 1);
    order.sort((a, c) => dep(a) - dep(c));
    for (const t of order) {
      const a = idx[t * 3], c1 = idx[t * 3 + 1], c2 = idx[t * 3 + 2];
      ctx.beginPath(); ctx.moveTo(X(p[a * 3 + ax]), Y(p[a * 3 + ay])); ctx.lineTo(X(p[c1 * 3 + ax]), Y(p[c1 * 3 + ay])); ctx.lineTo(X(p[c2 * 3 + ax]), Y(p[c2 * 3 + ay])); ctx.closePath();
      ctx.fillStyle = colour && state.tri[t] ? state.tri[t] : "#9aa09c"; ctx.fill();
    }
  }

  const nice = (v: number) => { const e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; };
  function draw3d(rawMesh: Mesh, bakedMesh: Mesh) {
    const d = toDisplay(rawMesh), b = bounds(d), half = nice(Math.max(Math.abs(b.min[0]), Math.abs(b.max[0]), Math.abs(b.min[2]), Math.abs(b.max[2]), 1e-3) * 1.2);
    const cy = (Math.min(0, b.min[1]) + Math.max(0, b.max[1])) / 2;
    drawOrbit($<HTMLCanvasElement>("ll-3d-raw"), { mesh: d, tri: state.tri, colour: state.steps.colour, cam: frameCam(d, 0, view.pitch, view.zoom, { half: half * 1.6, centre: [0, cy, 0] }), gridStep: half / 4, gridHalf: half, unit: `${(half / 4).toPrecision(2)} (the lift's own units)`, title: "Raw lift (z was up)", arrow: true });
    drawOrbit($<HTMLCanvasElement>("ll-3d-baked"), { mesh: bakedMesh, tri: state.tri, colour: state.steps.colour, cam: frameCam(bakedMesh, view.bakedAz, view.pitch, view.zoom, { half: 4.2, centre: [0, 0.8, 0] }), gridStep: 1, gridHalf: 3, unit: "1 m", title: "Baked (metres)", arrow: true });
  }
  function currentTyped(): number | null { return typedOn.checked ? Number(hRange.value) : null; }
  function render() {
    if (!state.obj || !state.mesh) return;
    const o = state.obj, yawExtra = Number(yawRange.value), real = state.real;
    // a real raw lift is used as it arrived (its own turn, size and tilt); a baked object is turned back into a stand-in raw lift
    const { recipe: base, recorded: rec0 } = recipeFor(o.name), recorded = real ? true : rec0, raw = real ? rawFromPack(state.mesh, real, yawExtra) : unbake(state.mesh, withExtraYaw(base, yawExtra)), typed = currentTyped();
    $("ll-yaw-v").textContent = `${yawExtra} degrees`;
    const r = bake(raw, { label: o.label, typedHeight: typed, steps: state.steps });
    $("ll-h-v").textContent = `${Number(hRange.value).toFixed(2)} m`;
    // seen from a little above (30 degrees) so a turn about the vertical shows up; z stays up on the page
    const tilt = Math.PI / 6, vp: number[] = [], view: Mesh = { positions: vp, indices: raw.mesh.indices };
    for (let i = 0; i < raw.mesh.positions.length; i += 3) { const x = raw.mesh.positions[i], y = raw.mesh.positions[i + 1], z = raw.mesh.positions[i + 2]; vp.push(x, z * Math.cos(tilt) + y * Math.sin(tilt), y * Math.cos(tilt) - z * Math.sin(tilt)); }
    draw($<HTMLCanvasElement>("ll-raw"), view, 0, 1, 2, true, null, state.steps.colour, false);
    const WIN = { cx: 0, cy: 1.4, span: 7 };
    draw($<HTMLCanvasElement>("ll-side"), r.mesh, 0, 1, 2, false, WIN, state.steps.colour, true);
    draw($<HTMLCanvasElement>("ll-top"), r.mesh, 0, 2, 1, false, { cx: 0, cy: 0, span: 7 }, state.steps.colour, false);
    draw3d(raw.mesh, r.mesh);
    const rawH = bounds(raw.mesh).size[2], expect = typed ?? typicalHeight(o.label);
    const facts: [string, string][] = [
      ["Height", `${r.heightM.toFixed(2)} m ${expect !== null && state.steps.scale ? `(target ${expect} m)` : ""}`],
      ["Length x depth", `${r.size[0].toFixed(2)} m x ${r.size[2].toFixed(2)} m`],
      ["Scale factor", `${r.factor.toFixed(3)} (${r.scaleSource})`],
      ["Faces", `${r.faces.toLocaleString("en")}${r.faces > FACE_CAP ? " (over the 6,000 cap)" : ""}`],
      ["Lowest point", `${r.minY.toFixed(2)} m above the ground`],
      ["Off centre by", `${r.centreOffset.toFixed(2)} m`],
      ["Turned by you", `${yawExtra} degrees; the bake turned it by ${r.yawDeg.toFixed(1)}`],
      ["Leaning by", `${r.tiltDeg.toFixed(1)} degrees`],
      ["Raw lift height", `${rawH.toFixed(3)} (the lift's own units${real ? ", the real raw lift" : recorded ? ", sizes recorded, mesh rebuilt from the baked object" : ", a stand-in"})`],
    ];
    $("ll-facts").innerHTML = facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
    const off = STEP_NAMES.filter((s) => !state.steps[s.key]);
    const warn = sizeWarning(r.size);
    $("ll-break").innerHTML = (off.length ? off.map((s) => `<b>${s.name} is off:</b> ${s.breaks}`).join("<br>") : "All seven steps are on: the object stands on the ground, faces the side camera, and is the typed size.") + (warn ? `<br><span class="bad">${warn}</span>` : "") + (recorded ? "" : "<br>This object's raw lift was not kept, so its raw turn and tilt are stand-ins (the bench and the railing keep their recorded size and tilt). Pick a real raw lift in the first group to see true data.");
    document.documentElement.dataset.labDone = "1";
  }

  const packs: RawPackMeta[] = [];
  const lifts: RealLift[] = [];
  async function pickLift(name: string) {
    const o = lifts.find((x) => x.name === name)!, m = realToMeta(o);
    const { mesh, tri } = parseRawGlb(await (await fetch("/" + o.rawMesh)).arrayBuffer());
    state.real = m; state.mesh = mesh; state.tri = tri;
    state.obj = { name: o.name, label: o.label, glb: "", height_m: o.typedHeightM, photo: o.photo, faces: o.stats.rawFaces, scale_source: "typed" };
    hRange.value = String(o.typedHeightM); typedOn.checked = true;
    $("ll-cut").innerHTML = `<img src="/${o.maskPicture}" alt="The recorded cut-out of the ${o.label}"><p class="small" style="margin:6px 0 0">Real photo, cut-out and lift of a "${o.label}". ${o.credit}. The lift made ${o.stats.rawFaces.toLocaleString("en")} triangles in ${o.stats.liftSeconds} s (about ${(o.stats.costUsd * 100).toFixed(1)} cents); the pictures draw ${o.stats.previewFaces.toLocaleString("en")} of them. It leans ${o.stats.tiltDeg} degrees by the camera layout.${o.stats.padded ? " The box was padded." : ""}</p>`;
    render();
  }
  async function pickReal(name: string) {
    const m = packs.find((x) => x.name === name)!;
    const { mesh, tri } = parseRawPack(await (await fetch(`/assets/lab/lift/raw/${m.file}`)).arrayBuffer());
    state.real = m; state.mesh = mesh; state.tri = tri;
    state.obj = { name: m.name, label: m.label, glb: "", height_m: m.typed_height_m, photo: "", faces: m.raw_faces, scale_source: m.scale_source };
    hRange.value = String(m.typed_height_m); typedOn.checked = m.scale_source === "typed";
    $("ll-cut").innerHTML = `<p class="small" style="margin:0">Real raw lift of a "${m.label}" (photo by ${m.photo_credit}, ${m.licence}). The lift made ${m.raw_faces.toLocaleString("en")} triangles in ${m.lift_seconds} s (about ${(m.usd_estimate * 100).toFixed(1)} cents); the left picture draws ${m.drawn_faces.toLocaleString("en")} of them. Recorded: it leans ${m.tilt_deg} degrees by the camera layout, and the game bake scaled it by ${m.bake_factor}.</p>`;
    render();
  }
  async function pick(name: string) {
    if (name.startsWith("real:")) return pickLift(name.slice(5));
    if (name.startsWith("raw:")) return pickReal(name.slice(4));
    state.real = null;
    const o = (objects.find((x) => x.name === name) ?? objects[0]);
    state.obj = o;
    const buf = await (await fetch(`/assets/objects/${o.glb}`)).arrayBuffer();
    state.mesh = readGlbMesh(buf);
    state.tri = await triangleColours(buf, state.mesh.indices!.length / 3, state.mesh.indices!);
    hRange.value = String(o.height_m);
    typedOn.checked = o.scale_source === "typed";
    const c = CUTOUTS[o.name];
    $("ll-cut").innerHTML = c
      ? `<img src="/assets/lab/lift/${c}" alt="The photo on the left and the recorded cut-out on the right"><p class="small" style="margin:6px 0 0">Left: the photo. Right: the recorded cut-out the lift used (a text prompt "${o.label}" found it, then the privacy and mask steps ran). Recorded lift: ${RECORDED_LIFTS[o.name].rawFaces.toLocaleString("en")} raw faces to ${RECORDED_LIFTS[o.name].bakedFaces.toLocaleString("en")} baked, scale factor ${RECORDED_LIFTS[o.name].factor}.</p>`
      : `<img src="/assets/lab/lift/monkey-bars-cutout.jpg" alt="Cut-out preview next to the picture the lift used for a monkey bars box"><p class="small" style="margin:6px 0 0">This object's photo is not stored (only its fingerprint, in <code>public/assets/objects/provenance.json</code>). Shown instead: the recorded cut-out for the monkey bars box (our own box, because the finder did not find monkey bars).</p>`;
    render();
  }

  // the controls
  wrap.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset?.step) { (state.steps as any)[t.dataset.step] = t.checked; render(); }
    else if (t === typedOn || t === hRange) render();
    else if ((t as HTMLElement) === sel) void pick(sel.value);
  });
  hRange.addEventListener("input", () => { typedOn.checked = true; render(); });
  yawRange.addEventListener("input", render);
  // 3D view: drag, wheel, buttons and arrow keys. The raw picture's horizontal drag writes the same turn the slider holds.
  const turnBy = (dx: number) => { yawRange.value = String(Math.round(dragTurn(Number(yawRange.value), dx))); render(); };
  const viewBy = (dpitch: number) => { view.pitch = clampPitch(view.pitch + dpitch); render(); };
  const zoomBy = (f: number) => { view.zoom = clampZoom(view.zoom * f); render(); };
  const rawCv = $<HTMLCanvasElement>("ll-3d-raw"), bakedCv = $<HTMLCanvasElement>("ll-3d-baked");
  for (const [cv, isRaw] of [[rawCv, true], [bakedCv, false]] as const) {
    let last: { x: number; y: number } | null = null;
    cv.addEventListener("pointerdown", (e) => { last = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); cv.style.cursor = "grabbing"; cv.focus(); });
    cv.addEventListener("pointermove", (e) => {
      if (!last) return;
      const dx = e.clientX - last.x, dy = e.clientY - last.y; last = { x: e.clientX, y: e.clientY };
      if (isRaw) { yawRange.value = String(Math.round(dragTurn(Number(yawRange.value), dx))); } else view.bakedAz = normTurn(view.bakedAz - dx * 0.5);
      view.pitch = clampPitch(view.pitch + dy * 0.4); render();
    });
    const up = () => { last = null; cv.style.cursor = "grab"; };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", (e) => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
    cv.addEventListener("keydown", (e) => {
      const k = e.key, dx = k === "ArrowLeft" ? -10 : k === "ArrowRight" ? 10 : 0, dp = k === "ArrowUp" ? 5 : k === "ArrowDown" ? -5 : 0;
      if (!dx && !dp) return;
      e.preventDefault();
      if (dx) { if (isRaw) turnBy(dx * 2); else { view.bakedAz = normTurn(view.bakedAz - dx); render(); } }
      if (dp) viewBy(dp);
    });
  }
  $("ll-zin").addEventListener("click", () => zoomBy(1.25)); $("ll-zout").addEventListener("click", () => zoomBy(1 / 1.25));
  $("ll-reset").addEventListener("click", () => { view.pitch = 25; view.zoom = 1; view.bakedAz = 25; yawRange.value = "0"; render(); });
  const mh = $<HTMLInputElement>("ll-mh");
  const thin = () => { const h = Number(mh.value), L = barLength(h, RECORDED_COST.monkeyBars.extent_aspect); $("ll-mh-v").textContent = `${h.toFixed(2)} m`; $("ll-mlen").textContent = `${L.toFixed(1)} m`; $("ll-mwarn").textContent = sizeWarning([L, h, 0.1]); };
  mh.value = "0.25"; mh.addEventListener("input", thin); thin();
  const costRows: [string, string][] = [
    ["Mask (SAM 3, L4 GPU)", `${RECORDED_COST.mask_seconds_range[0]} to ${RECORDED_COST.mask_seconds_range[1]} s once loaded`],
    ["Lift (SAM 3D Objects, L40S GPU)", `${RECORDED_COST.lift_seconds_range[0]} to ${RECORDED_COST.lift_seconds_range[1]} s`],
    ["Bake (CPU), four photos", Object.entries(RECORDED_COST.bakeSeconds).map(([k, v]) => `${k} ${v} s`).join(", ")],
    ["One object, end to end", `about ${RECORDED_COST.per_object_seconds} s; the first one ${RECORDED_COST.first_object_seconds[0]} to ${RECORDED_COST.first_object_seconds[1]} s (both models load)`],
    ["Price", `about 2 cents per object (${RECORDED_COST.per_object_usd} USD)`],
    ["Monkey bars run (a player-style box)", `models loaded in ${RECORDED_COST.monkeyBars.mask_load_seconds} s and ${RECORDED_COST.monkeyBars.lift_load_seconds} s; mask ${RECORDED_COST.monkeyBars.mask_seconds} s; lift ${RECORDED_COST.monkeyBars.lift_seconds} s; ${RECORDED_COST.monkeyBars.wall_seconds} s on the clock; ${RECORDED_COST.monkeyBars.usd_estimate} USD`],
  ];
  $("ll-cost").innerHTML = costRows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("");
  $("ll-eq-btn").addEventListener("click", () => { const b = $("ll-eq-body"); b.hidden = !b.hidden; });

  const objects: Obj[] = [];
  fetch("/assets/objects/index.json").then((r) => r.json()).then(async (j) => {
    objects.push(...(j.objects as Obj[]));
    try { lifts.push(...((await (await fetch("/assets/lab/lift/real/index.json")).json()).objects as RealLift[])); } catch { /* the 8 older raw lifts below are the fallback */ }
    try { if (!lifts.length) packs.push(...((await (await fetch("/assets/lab/lift/raw/index.json")).json()).objects as RawPackMeta[])); } catch { /* the real raw lifts are optional: the baked objects still work */ }
    sel.innerHTML = (lifts.length ? `<optgroup label="Real lifts (photo, cut-out, lift)">${lifts.map((m) => `<option value="real:${m.name}">${m.name} (${m.label})</option>`).join("")}</optgroup>` : "") + (!lifts.length && packs.length ? `<optgroup label="Real raw lifts (the lift model's own output)">${packs.map((m) => `<option value="raw:${m.name}">${m.name} (${m.label})</option>`).join("")}</optgroup>` : "") +
      (lifts.length ? "" : `<optgroup label="Baked game objects (raw rebuilt from the baked mesh)">${objects.map((o) => `<option value="${o.name}">${o.name} (${o.label})</option>`).join("")}</optgroup>`);
    const first = lifts.length ? "real:" + (lifts.find((x) => x.name === "bench-concrete") ?? lifts[0]).name : packs.length ? "raw:" + packs[0].name : "bench-concrete";
    sel.value = first;
    await pick(first);
    labDefaultNote(wrap, "live", wrap.querySelector("h1")!.parentElement!.querySelector("p"));
    document.documentElement.dataset.labReady = "true";
    labPopulated("lab-lift");
  });
  return { backend: "canvas2d" };
}
