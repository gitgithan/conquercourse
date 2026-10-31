import { labsOn } from "../ui/labs";
import { KNOBS, OURS, judgePhoto, parseTable, summarize, sweep, type Knob, type Photo, type Rule, type Summary } from "../labs/vision/rule";

// Lab 4: Computer vision (CC-lab-vision). The player moves the thresholds of the photo-masking rule on a labelled street-photo set
// and reads photos kept against people missed. The rule is the real one (src/labs/vision/rule.ts); the detector's scores were computed offline.
// Nothing here talks or grades the player: it shows numbers and a picture. Behind the labs switch (?labs=1).
const BASE = "/assets/lab/vision";
const INK = "#17201d", TEAL = "#0f6b5c", GHOST = "#9aa5a0", BAD = "#b91c1c", AMBER = "#b45309";
interface Credit { id: string; flickr_url: string; licence: string }
const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;

export function startLabVision(host: HTMLElement): { backend: "canvas2d" } {
  const root = document.createElement("div");
  root.id = "lab-vision";
  root.style.cssText = `position:fixed;inset:0;overflow:auto;background:#f5f7f4;color:${INK};font:15px/1.4 system-ui,sans-serif`;
  host.append(root);
  if (!labsOn()) {
    root.innerHTML = `<div style="max-width:520px;margin:12vh auto;padding:0 16px"><h1 style="font-size:22px">Lab 4: Computer vision</h1><p>Labs are switched off.</p><p><a href="?mode=lab-vision&labs=1" style="color:${TEAL}">Switch labs on</a></p></div>`;
    return { backend: "canvas2d" };
  }
  const style = document.createElement("style");
  style.textContent = `
    #lab-vision .wrap{max-width:1040px;margin:0 auto;padding:16px;display:grid;gap:14px}
    #lab-vision h1{font-size:22px;margin:0}#lab-vision h2{font-size:15px;margin:0 0 6px}
    #lab-vision .grid{display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr);gap:14px;align-items:start}
    #lab-vision .card{background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:12px}
    #lab-vision label{display:grid;gap:2px;margin:8px 0}#lab-vision input[type=range]{width:100%}
    #lab-vision .sw{display:grid;gap:4px;margin:6px 0}
    #lab-vision .sw label{display:flex;gap:6px;align-items:center;margin:0}
    #lab-vision .btn{font:700 14px system-ui;padding:8px 12px;border:0;border-radius:8px;background:${TEAL};color:#fff;cursor:pointer;width:100%;margin-top:6px}
    #lab-vision .btn.alt{background:#fff;color:${TEAL};border:1px solid ${TEAL}}
    #lab-vision .facts{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:0}
    #lab-vision .facts dt{color:#52605a}#lab-vision .facts dd{margin:0;font-weight:600}
    #lab-vision table{border-collapse:collapse;width:100%;font-size:13px}#lab-vision th,#lab-vision td{text-align:left;padding:3px 8px 3px 0;border-bottom:1px solid #e3e8e4}
    #lab-vision .small{color:#52605a;font-size:13px}
    #lab-vision .eq{font:14px/1.6 ui-monospace,Menlo,monospace;background:#f1f4f1;border-radius:8px;padding:8px 10px;white-space:pre-wrap;overflow-x:auto}
    #lab-vision button.link{background:none;border:0;color:${TEAL};font:600 14px system-ui;cursor:pointer;padding:0;text-decoration:underline}
    #lab-vision a.back{color:${TEAL};font-weight:600}
    #lab-vision .thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:6px}
    #lab-vision .th{position:relative;border:3px solid ${TEAL};border-radius:6px;overflow:hidden;background:#eef3ee;line-height:0}
    #lab-vision .th.drop{border-color:${GHOST}}#lab-vision .th.drop img{opacity:.28;filter:grayscale(1)}
    #lab-vision .th img{width:100%;height:70px;object-fit:cover}
    #lab-vision .th b{position:absolute;left:0;bottom:0;right:0;font:700 11px system-ui;line-height:1.3;padding:1px 3px;background:rgba(23,32,29,.72);color:#fff}
    #lab-vision .th.miss b{background:${BAD}}
  `;
  root.append(style);
  const wrap = document.createElement("div"); wrap.className = "wrap"; root.append(wrap);
  wrap.innerHTML = `
    <div><a class="back" href="/?welcome=0">Back to the game</a>
    <h1>Lab 4: Computer vision</h1>
    <p class="small" style="margin:4px 0 0">The goal: use as many street photos as you can without leaving a person in a photo unmasked. The game finds people with a detector, covers them with a blur, and drops a photo when too much of it is covered. You move the thresholds and watch the trade-off on photos people have already outlined by hand.</p></div>
    <div class="grid">
      <div class="card">
        <h2>Your choices</h2>
        <label>Score cut: <b id="lv-score-v"></b><input id="lv-score" type="range"></label>
        <p class="small" style="margin:0">The detector gives each find a score from 0 to 1. Finds under the cut are ignored.</p>
        <label>Smallest person to mask: <b id="lv-size-v"></b><input id="lv-size" type="range"></label>
        <p class="small" style="margin:0">Finds smaller than this (share of the photo) are not masked, so those people stay visible.</p>
        <label>Most of a photo that may be masked: <b id="lv-max-v"></b><input id="lv-max" type="range"></label>
        <p class="small" style="margin:0">A photo with more of it masked than this is dropped.</p>
        <div class="sw" role="group" aria-label="Curve"><b class="small">Draw the curve by moving</b>
          <label><input type="radio" name="lv-knob" value="scoreCut" checked>the score cut</label>
          <label><input type="radio" name="lv-knob" value="minSize">the smallest person</label>
          <label><input type="radio" name="lv-knob" value="maxMasked">the masked share</label></div>
        <button class="btn" id="lv-mark">Mark this setting on the curve</button>
      </div>
      <div style="display:grid;gap:14px;min-width:0">
        <div class="card"><h2>Photos kept against people missed</h2>
          <canvas id="lv-pic" width="940" height="360" style="width:100%;height:auto;display:block;border-radius:6px;background:#eef3ee"></canvas>
          <p class="small" style="margin:6px 0 0"><span style="color:${TEAL}">Teal line</span>: the curve as you move the chosen control. <span style="color:${TEAL}">Filled dot</span>: your setting now. <span style="color:${AMBER}">Numbered dots</span>: settings you marked. Further right is more photos kept; lower is fewer people missed. The best corner is bottom right.</p></div>
        <div class="card"><h2>What your setting does</h2><dl class="facts" id="lv-facts"></dl></div>
        <div class="card"><h2>The photos</h2><div class="thumbs" id="lv-thumbs"></div><p class="small" id="lv-credits" style="margin:8px 0 0"></p></div>
        <div class="card" hidden id="lv-hist"><h2>Settings you marked</h2><table><thead><tr><th>#</th><th>Score cut</th><th>Smallest</th><th>Masked</th><th>Photos kept</th><th>People missed</th></tr></thead><tbody id="lv-rows"></tbody></table></div>
        <div class="card"><h2>What the game does</h2><button class="link" id="lv-ours-btn">Show the setting the game uses</button><div id="lv-ours" hidden></div></div>
        <div class="card"><h2>The maths</h2><button class="link" id="lv-eq-btn">Show the maths behind your setting</button><div class="eq" id="lv-eq" hidden></div></div>
      </div>
    </div>`;
  const $ = <T extends HTMLElement>(id: string): T => wrap.querySelector("#" + id) as T;
  const rule: Rule = { ...OURS };
  let knob: Knob = "scoreCut";
  let photos: Photo[] = [];
  const marks: { rule: Rule; s: Summary }[] = [];
  let showOurs = false;

  const sliders: [string, Knob][] = [["lv-score", "scoreCut"], ["lv-size", "minSize"], ["lv-max", "maxMasked"]];
  for (const [id, k] of sliders) {
    const el = $<HTMLInputElement>(id);
    el.min = String(KNOBS[k].min); el.max = String(KNOBS[k].max); el.step = String(KNOBS[k].step); el.value = String(rule[k]);
    el.addEventListener("input", () => { rule[k] = Number(el.value); update(); });
  }
  wrap.querySelectorAll<HTMLInputElement>("input[name=lv-knob]").forEach((r) => r.addEventListener("change", () => { knob = r.value as Knob; update(); }));

  const canvas = $<HTMLCanvasElement>("lv-pic");
  const g = canvas.getContext("2d")!;
  const draw = (curve: { value: number; s: Summary }[], now: Summary) => {
    const W = canvas.width, H = canvas.height, L = 62, R = 18, T = 14, B = 46;
    g.clearRect(0, 0, W, H);
    // x: photos kept 0..100 percent; y: people missed 0..yMax percent (shared axis so settings compare).
    let yMax = 0.1;
    for (const c of curve) yMax = Math.max(yMax, c.s.missedShare);
    for (const m of marks) yMax = Math.max(yMax, m.s.missedShare);
    yMax = Math.min(1, Math.ceil(yMax * 10) / 10);
    const sx = (v: number) => L + v * (W - L - R), sy = (v: number) => T + (v / yMax) * (H - T - B);
    g.font = "13px system-ui"; g.fillStyle = "#52605a"; g.strokeStyle = "#dfe6e0"; g.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const x = i / 5; g.beginPath(); g.moveTo(sx(x), T); g.lineTo(sx(x), H - B); g.stroke();
      g.textAlign = "center"; g.fillText(pct(x), sx(x), H - B + 16);
      const y = (i / 5) * yMax; g.beginPath(); g.moveTo(L, sy(y)); g.lineTo(W - R, sy(y)); g.stroke();
      g.textAlign = "right"; g.fillText(pct(y), L - 6, sy(y) + 4);
    }
    g.textAlign = "center"; g.fillText("photos kept (share of all photos)", (L + W - R) / 2, H - 8);
    g.save(); g.translate(14, (T + H - B) / 2); g.rotate(-Math.PI / 2); g.fillText("people missed (share of people in kept photos)", 0, 0); g.restore();
    g.strokeStyle = TEAL; g.lineWidth = 3; g.beginPath();
    curve.forEach((c, i) => (i ? g.lineTo(sx(c.s.keptShare), sy(c.s.missedShare)) : g.moveTo(sx(c.s.keptShare), sy(c.s.missedShare))));
    g.stroke();
    g.fillStyle = TEAL;
    for (const c of curve) { g.beginPath(); g.arc(sx(c.s.keptShare), sy(c.s.missedShare), 2.5, 0, 7); g.fill(); }
    marks.forEach((m, i) => {
      g.fillStyle = AMBER; g.beginPath(); g.arc(sx(m.s.keptShare), sy(m.s.missedShare), 9, 0, 7); g.fill();
      g.fillStyle = "#fff"; g.textAlign = "center"; g.font = "700 11px system-ui"; g.fillText(String(i + 1), sx(m.s.keptShare), sy(m.s.missedShare) + 4);
    });
    g.font = "13px system-ui";
    if (showOurs) {
      const o = summarize(photos, OURS);
      g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.arc(sx(o.keptShare), sy(o.missedShare), 11, 0, 7); g.stroke();
      g.fillStyle = INK; g.textAlign = "left"; g.fillText("the game's setting", sx(o.keptShare) + 16, sy(o.missedShare) + 4);
    }
    g.fillStyle = TEAL; g.strokeStyle = "#fff"; g.lineWidth = 2; g.beginPath(); g.arc(sx(now.keptShare), sy(now.missedShare), 8, 0, 7); g.fill(); g.stroke();
  };

  let credits = new Map<string, Credit>();
  const renderThumbs = () => {
    const box = $("lv-thumbs"); box.innerHTML = "";
    for (const p of photos) {
      if (!credits.has(p.id)) continue;
      const j = judgePhoto(p, rule);
      const d = document.createElement("div");
      d.className = "th" + (j.kept ? "" : " drop") + (j.kept && j.missed > 0 ? " miss" : "");
      d.dataset.id = p.id; d.dataset.state = j.kept ? (j.missed > 0 ? "kept-missed" : "kept") : "dropped";
      const label = !j.kept ? "dropped" : j.missed > 0 ? `${j.missed} missed` : j.people > 0 ? "all masked" : "no people";
      d.innerHTML = `<img src="${BASE}/t/${p.id}.jpg" alt="street photo ${p.id}" width="88" height="70"><b>${label}</b>`;
      box.append(d);
    }
  };

  const update = () => {
    for (const [id, k] of sliders) { $<HTMLInputElement>(id).value = String(rule[k]); }
    $("lv-score-v").textContent = rule.scoreCut.toFixed(2);
    $("lv-size-v").textContent = rule.minSize === 0 ? "any size" : pct(rule.minSize, 2) + " of the photo";
    $("lv-max-v").textContent = pct(rule.maxMasked);
    const now = summarize(photos, rule);
    draw(sweep(photos, rule, knob), now);
    const rows: [string, string][] = [
      ["Photos kept", `${now.kept} of ${now.photos} (${pct(now.keptShare)})`],
      ["People in those photos", `${now.people}, drawn by hand`],
      ["People missed", `${now.missed} (${pct(now.missedShare, 1)}): left unmasked in a kept photo`],
      ["Masks on nobody", `${now.falseMasks} (${now.falsePerPhoto.toFixed(2)} per kept photo)`],
    ];
    $("lv-facts").innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
    renderThumbs();
    if (showOurs) renderOurs();
    renderEq(now);
  };

  const renderOurs = () => {
    const o = summarize(photos, OURS);
    $("lv-ours").hidden = false;
    $("lv-ours-btn").hidden = true;
    $("lv-ours").innerHTML = `<p style="margin:0 0 6px">The game uses score cut ${OURS.scoreCut}, any person size, and drops a photo when more than ${pct(OURS.maxMasked)} is masked or one person fills more than 25% of it.</p>
      <p style="margin:0 0 6px">On this set that keeps ${o.kept} of ${o.photos} photos and misses ${o.missed} of ${o.people} people (${pct(o.missedShare, 1)}).</p>
      <p style="margin:0">Why: a person left visible in a street photo costs more than a photo we lose, so the game would rather drop a photo than keep one with an unmasked person. A second, different detector then checks every photo that is kept, and a photo that still shows a person it did not cover is dropped as well. That second check is not part of this Lab.</p>`;
  };
  $("lv-ours-btn").onclick = () => { showOurs = true; update(); };

  const renderEq = (s: Summary) => {
    $("lv-eq").textContent =
`recall    = covered / people = ${s.covered} / ${s.people} = ${s.recall.toFixed(3)}
missed    = 1 - recall = ${s.missedShare.toFixed(3)}
precision = covered / (covered + masks on nobody) = ${s.covered} / ${s.covered + s.falseMasks} = ${s.precision.toFixed(3)}
ROC point (false masks per kept photo, recall) = (${s.falsePerPhoto.toFixed(3)}, ${s.recall.toFixed(3)})
keep photo  when  sum(mask share of finds with score >= cut and box >= smallest) <= most masked
            and   largest such box <= 0.25`;
  };
  $("lv-eq-btn").onclick = () => { $("lv-eq").hidden = false; $("lv-eq-btn").hidden = true; };

  $("lv-mark").onclick = () => {
    marks.push({ rule: { ...rule }, s: summarize(photos, rule) });
    $("lv-hist").hidden = false;
    $("lv-rows").innerHTML = marks.map((m, i) => `<tr><td>${i + 1}</td><td>${m.rule.scoreCut.toFixed(2)}</td><td>${m.rule.minSize === 0 ? "any" : pct(m.rule.minSize, 2)}</td><td>${pct(m.rule.maxMasked)}</td><td>${pct(m.s.keptShare)}</td><td>${pct(m.s.missedShare, 1)}</td></tr>`).join("");
    update();
  };

  Promise.all([
    fetch(`${BASE}/scores.txt`).then((r) => r.text()),
    fetch(`${BASE}/credits.json`).then((r) => r.json() as Promise<Credit[]>),
  ]).then(([text, cr]) => {
    photos = parseTable(text);
    credits = new Map(cr.map((c) => [c.id, c]));
    $("lv-credits").innerHTML = `Photos from the COCO val2017 set (CC BY 2.0 or no known copyright restrictions; boxes drawn by hand, CC BY 4.0). Shown small. Sources: ${cr.map((c) => `<a href="${c.flickr_url}" rel="noopener" target="_blank">${c.id}</a>`).join(", ")}. The table behind the curve holds ${photos.length} photos.`;
    update();
    root.dataset.ready = "1";
  });
  return { backend: "canvas2d" };
}
