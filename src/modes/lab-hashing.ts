import { mountLabsNav } from "../ui/labs-nav";
import type { CourseData } from "../course/course";
import {
  COLLISION_TABLE, HASHES, KEYS, SCOPES, avalanche, collisionProb, expand, firstDivergence, hashOf, hex, judge, logBytes, maskOfKey, playLog, tamperLog, verdict,
  type HashId, type Played, type Scope, type TamperKey, type Avalanche,
} from "../labs/hashing/core";
import { courseHash, encodeLog, recordPlan } from "../sim/replay";
import { labsOn } from "../ui/labs";
import { labDefaultNote, labPopulated } from "../ui/lab-default";

// Lab 11: Verification and hashing. The player chooses which part of a run is hashed and which hash function does it, tampers with one tick of the recorded keys,
// replays them with the real simulator and reads whether the hash saw it. Nothing here talks or grades: it shows numbers and a picture. Behind the labs switch (?labs=1).
const COURSE_URL = "/assets/demo/lache.course.json";
const INK = "#17201d", TEAL = "#0f6b5c", GHOST = "#9aa5a0", DECK = "#cbd5cd", WATER = "#b7d3ee", BAD = "#b91c1c";
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

export function startLabHashing(host: HTMLElement): { backend: "canvas2d" } {
  const root = document.createElement("div");
  root.id = "lab-hashing";
  root.style.cssText = `position:fixed;inset:0;overflow:auto;background:#f5f7f4;color:${INK};font:15px/1.4 system-ui,sans-serif`;
  host.append(root);
  mountLabsNav(host, "lab-hashing");
  if (!labsOn()) {
    root.innerHTML = `<div style="max-width:520px;margin:12vh auto;padding:0 16px"><h1 style="font-size:22px">Lab 11: Verification and hashing</h1><p>Labs are switched off.</p><p><a href="?mode=lab-hashing&labs=1" style="color:${TEAL}">Switch labs on</a></p></div>`;
    return { backend: "canvas2d" };
  }
  const style = document.createElement("style");
  style.textContent = `
    #lab-hashing .wrap{max-width:1040px;margin:0 auto;padding:16px;display:grid;gap:14px}
    #lab-hashing h1{font-size:22px;margin:0}#lab-hashing h2{font-size:15px;margin:0 0 6px}
    #lab-hashing .grid{display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr);gap:14px;align-items:start}
    #lab-hashing .card{background:#fff;border:1px solid #d5ddd6;border-radius:10px;padding:12px}
    #lab-hashing label{display:grid;gap:2px;margin:8px 0}#lab-hashing input[type=range]{width:100%}
    #lab-hashing select{font:14px system-ui;padding:6px;border:1px solid #b9c4bb;border-radius:8px}
    #lab-hashing .opts{display:grid;gap:6px;margin-bottom:8px}
    #lab-hashing .opts button{font:600 14px system-ui;padding:8px;border:1px solid #b9c4bb;border-radius:8px;background:#fff;color:${INK};cursor:pointer;text-align:left}
    #lab-hashing .opts button[aria-pressed=true]{border-color:${TEAL};background:#e6f2ee}
    #lab-hashing .go{font:700 15px system-ui;padding:10px 14px;border:0;border-radius:8px;background:${TEAL};color:#fff;cursor:pointer;width:100%;margin-top:6px}
    #lab-hashing .facts{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:0}
    #lab-hashing .facts dt{color:#52605a}#lab-hashing .facts dd{margin:0;font-weight:600;word-break:break-all}
    #lab-hashing table{border-collapse:collapse;width:100%;font-size:13px}#lab-hashing th,#lab-hashing td{text-align:left;padding:3px 8px 3px 0;border-bottom:1px solid #e3e8e4}
    #lab-hashing td.yes{color:${BAD};font-weight:700}#lab-hashing td.no{color:#52605a}#lab-hashing tr.now td{background:#e6f2ee}
    #lab-hashing .small{color:#52605a;font-size:13px}
    #lab-hashing code,#lab-hashing .mono{font:13px ui-monospace,Menlo,monospace}
    #lab-hashing .eq{font:14px/1.6 ui-monospace,Menlo,monospace;background:#f1f4f1;border-radius:8px;padding:8px 10px;white-space:pre-wrap;overflow-x:auto}
    #lab-hashing .bar{display:grid;grid-template-columns:150px 1fr 120px;gap:8px;align-items:center;margin:4px 0;font-size:13px}
    #lab-hashing .track{position:relative;height:16px;background:#eef3ee;border-radius:4px}#lab-hashing .fill{position:absolute;left:0;top:0;bottom:0;background:${TEAL};border-radius:4px;opacity:.75}
    #lab-hashing .half{position:absolute;top:-2px;bottom:-2px;width:2px;background:${INK}}
    #lab-hashing button.link{background:none;border:0;color:${TEAL};font:600 14px system-ui;cursor:pointer;padding:0;text-decoration:underline}
    #lab-hashing a.back{color:${TEAL};font-weight:600}
  `;
  root.append(style);
  const wrap = document.createElement("div"); wrap.className = "wrap"; root.append(wrap);
  wrap.innerHTML = `
    <div><a class="back" href="/?welcome=0">Back to the game</a>
    <h1 id="lh-h1">Lab 11: Verification and hashing</h1>
    <p class="small" style="margin:4px 0 0">The goal: a run is a list of key presses, and the game plays them again to check them. You choose which part of a run gets a hash and which hash function does it. Then you change one tick of the keys and see whether the hash notices.</p></div>
    <div class="grid">
      <div class="card">
        <h2>Your choices</h2>
        <div class="small">What is hashed</div>
        <div class="opts" id="lh-scopes" role="group" aria-label="What is hashed"></div>
        <div class="small">Which hash function</div>
        <div class="opts" id="lh-hashes" role="group" aria-label="Hash function"></div>
        <div class="small">The change to the recorded keys</div>
        <label style="display:block">At tick <b id="lh-tick-v"></b> of <span id="lh-ticks"></span><input id="lh-tick" type="range" min="0" max="1" step="1"></label>
        <label>Change<select id="lh-key"></select></label>
        <p class="small" id="lh-key-about" style="margin:0"></p>
      </div>
      <div style="display:grid;gap:14px;min-width:0">
        <div class="card"><h2>The recorded run and the changed one</h2>
          <canvas id="lh-pic" width="940" height="260" style="width:100%;height:auto;display:block;border-radius:6px;background:#eef3ee"></canvas>
          <div class="small" style="margin-top:6px">Grey: the original run, played by the real simulator. Teal: the same keys with your change. The mark is the first tick where they differ.</div></div>
        <div class="card"><h2>What happened</h2><dl class="facts" id="lh-facts"></dl></div>
        <div class="card"><h2>Does the hash see the change?</h2>
          <p class="small" style="margin:0 0 6px">Every choice at once, for the change you made. Your current pick is shaded.</p>
          <table><thead><tr><th>Hashed part</th><th>Hash function</th><th>Seen?</th><th>Bits changed</th></tr></thead><tbody id="lh-rows"></tbody></table></div>
        <div class="card"><h2>Avalanche: flip every single bit of the key log, one at a time</h2>
          <p class="small" style="margin:0 0 6px">The bar is the average number of digest bits that change. The black line is half of the digest.</p>
          <button class="go" id="lh-aval" style="width:auto;margin:0 0 8px">Run the avalanche</button><div id="lh-bars"></div></div>
        <div class="card"><h2>The maths</h2><button class="link" id="lh-eq-btn">Show the maths behind this Lab</button><div class="eq" id="lh-eq-body" hidden></div></div>
        <div class="card"><h2>What the game hashes</h2><div id="lh-ours"></div></div>
      </div>
    </div>`;
  const $ = <T extends HTMLElement>(id: string): T => wrap.querySelector("#" + id) as T;

  let scope: Scope = "log", fnId: HashId = "sha";
  let tick = 0, key: TamperKey = "jump";
  let course: CourseData | null = null, orig: Played | null = null, tam: Played | null = null;

  const buildOptions = () => {
    const mk = (id: string, items: { id: string; label: string; about: string }[], cur: string, set: (v: string) => void) => {
      const box = $(id); box.innerHTML = "";
      for (const it of items) {
        const b = document.createElement("button"); b.type = "button"; b.dataset.id = it.id; b.setAttribute("aria-pressed", String(cur === it.id));
        b.innerHTML = `${esc(it.label)}<div class="small" style="font-weight:400">${esc(it.about)}</div>`;
        b.onclick = () => { set(it.id); buildOptions(); update(); };
        box.append(b);
      }
    };
    mk("lh-scopes", SCOPES, scope, (v) => (scope = v as Scope));
    mk("lh-hashes", HASHES.map((h) => ({ id: h.id, label: h.label, about: h.about })), fnId, (v) => (fnId = v as HashId));
  };
  const sel = $<HTMLSelectElement>("lh-key");
  sel.innerHTML = KEYS.map((k) => `<option value="${k}">Flip the ${k} key for that one tick</option>`).join("") + `<option value="drop">Delete that tick from the log</option>`;
  sel.value = key;
  sel.onchange = () => { key = sel.value as TamperKey; update(); };
  $<HTMLInputElement>("lh-tick").addEventListener("input", (e) => { tick = Number((e.target as HTMLInputElement).value); update(); });

  // ---- the picture ----
  const canvas = $<HTMLCanvasElement>("lh-pic"), g = canvas.getContext("2d")!;
  const draw = (div: number | null) => {
    if (!course || !orig || !tam) return;
    const W = canvas.width, H = canvas.height;
    g.clearRect(0, 0, W, H);
    const x0 = course.startX - 2, x1 = course.finishX + 3, y0 = -2.2, y1 = 3.2;
    const sx = (x: number) => ((x - x0) / (x1 - x0)) * W, sy = (y: number) => H - ((y - y0) / (y1 - y0)) * H;
    g.fillStyle = WATER; g.fillRect(0, sy(course.terrain.waterY ?? -2), W, H);
    g.fillStyle = DECK;
    for (const p of course.terrain.platforms) { const a = Math.max(p.x0, x0), b = Math.min(p.x1, x1); g.fillRect(sx(a), sy(p.top), sx(b) - sx(a), sy(y0) - sy(p.top)); }
    g.strokeStyle = BAD; g.lineWidth = 2; g.beginPath(); g.moveTo(sx(course.finishX), sy(-0.3)); g.lineTo(sx(course.finishX), sy(2.2)); g.stroke();
    const line = (p: Played, colour: string, dash: number[]) => {
      g.strokeStyle = colour; g.lineWidth = 3; g.setLineDash(dash); g.beginPath();
      p.xs.forEach((x, i) => (i ? g.lineTo(sx(x), sy(p.ys[i] + 0.9)) : g.moveTo(sx(x), sy(p.ys[i] + 0.9))));
      g.stroke(); g.setLineDash([]);
    };
    line(orig, GHOST, [8, 6]); line(tam, TEAL, []);
    if (div !== null && orig.xs[div] !== undefined) {
      g.fillStyle = INK; g.beginPath(); g.arc(sx(orig.xs[div]), sy(orig.ys[div] + 0.9), 6, 0, 7); g.fill();
    }
  };

  // ---- update: replay the changed keys, then show the facts ----
  const update = () => {
    if (!course || !orig) return;
    const log = tamperLog(orig.log, { tick, key });
    tam = playLog(course, log);
    const fn = hashOf(fnId), v = verdict(orig, tam, scope, fn);
    const div = firstDivergence(orig, tam);
    const jo = judge(course, orig.log), jt = judge(course, tam.log);
    $("lh-tick-v").textContent = String(tick);
    const kab = key === "drop" ? "Every later key moves one tick earlier." : maskOfKey(key as never) && !expand(orig.log).some((m, i) => i === tick && (m & maskOfKey(key as never)) !== 0) ? "That key is not pressed at this tick, so this presses it for one tick." : "That key is pressed at this tick, so this lifts it for one tick.";
    $("lh-key-about").textContent = kab;
    const secs = (n: number) => (n / 120).toFixed(2) + " s";
    $("lh-facts").innerHTML = `
      <dt>Original run</dt><dd>${jo.cleared ? "cleared" : "not cleared"} in ${secs(jo.ticks)} (${jo.ticks} ticks)</dd>
      <dt>Changed run</dt><dd>${jt.cleared ? "cleared" : "not cleared"} in ${secs(jt.ticks)} (${jt.ticks} ticks)</dd>
      <dt>First tick where the states differ</dt><dd>${div === null ? "none: the runner moves exactly as before" : div}</dd>
      <dt>Hash before (${esc(SCOPES.find((s) => s.id === scope)!.label.toLowerCase())}, ${esc(fn.label)})</dt><dd class="mono">${hex(v.before)}</dd>
      <dt>Hash after</dt><dd class="mono">${hex(v.after)}</dd>
      <dt>Seen by this hash?</dt><dd>${v.caught ? "yes" : "no: the two hashes are equal"}</dd>
      <dt>Digest bits that changed</dt><dd>${v.bitsChanged} of ${fn.bits}</dd>`;
    $("lh-rows").innerHTML = SCOPES.flatMap((s) => HASHES.map((h) => {
      const r = verdict(orig!, tam!, s.id, h);
      return `<tr class="${s.id === scope && h.id === fnId ? "now" : ""}"><td>${esc(s.label)}</td><td>${esc(h.label)}</td><td class="${r.caught ? "yes" : "no"}">${r.caught ? "yes" : "no"}</td><td>${r.bitsChanged} of ${h.bits}</td></tr>`;
    })).join("");
    draw(div);
    paintEq();
  };

  // ---- avalanche ----
  $("lh-aval").onclick = () => {
    if (!orig) return;
    const bytes = logBytes(orig.log);
    const rows: Avalanche[] = HASHES.map((h) => avalanche(bytes, h));
    $("lh-bars").innerHTML = rows.map((a) => `<div class="bar"><span>${esc(hashOf(a.id).label)}</span><div class="track"><div class="fill" style="width:${(a.mean / a.bits) * 100}%"></div><div class="half" style="left:50%"></div></div><span>${a.mean.toFixed(1)} of ${a.bits} (least ${a.min}, most ${a.max}; ${a.flips} flips)</span></div>`).join("");
  };

  // ---- the maths ----
  const eqBtn = $<HTMLButtonElement>("lh-eq-btn"), eqBody = $("lh-eq-body");
  let eqOpen = false;
  eqBtn.onclick = () => { eqOpen = !eqOpen; eqBody.hidden = !eqOpen; eqBtn.textContent = eqOpen ? "Hide the maths" : "Show the maths behind this Lab"; paintEq(); };
  const pct = (p: number) => (p < 1e-6 ? p.toExponential(1) : (p * 100).toFixed(p < 0.01 ? 4 : 1) + "%");
  function paintEq() {
    if (!eqOpen) return;
    const fn = hashOf(fnId);
    eqBody.textContent =
`Why replay checks a run (determinism)
  state(t+1) = step(state(t), keys(t))      step is a fixed function at 120 Hz
  state(T)   = step(...step(step(state(0), keys(0)), keys(1))..., keys(T-1))
  So the keys fix every state. A hash of the keys decides the whole run;
  a hash of one state is a function of the keys, and cannot decide them back.

A hash of n bits has 2^n digests; ${fn.label} has n = ${fn.bits}.
  Chance two given different inputs share a digest, if the hash mixes well:  2^-n = ${(2 ** -fn.bits).toExponential(2)}
  Birthday bound, k different inputs:   P(some two collide) = 1 - exp(-k(k-1) / 2^(n+1))
${COLLISION_TABLE.map((k) => `    k = ${String(k).padEnd(8)} P = ${pct(collisionProb(fn.bits, k))}`).join("\n")}

Avalanche: flip one input bit and each digest bit should flip with chance 1/2,
  so the expected number of changed bits is n/2 = ${fn.bits / 2}, and the spread is sqrt(n)/2 = ${(Math.sqrt(fn.bits) / 2).toFixed(1)}.
  A sum of bytes fails this: s = (b0 + b1 + ... ) mod 2^16, so swapping two bytes changes nothing.

Chaining (hash of every tick):  h(t) = H( h(t-1) || state(t) ),  h(0) = H(state(0))
  The first tick where two chains differ is the first tick where the states differ.`;
  }

  // ---- what the game hashes (real functions) ----
  const paintOurs = async () => {
    if (!course || !orig) return;
    const link = await encodeLog(orig.log);
    $("lh-ours").innerHTML = `
      <ul style="margin:0;padding-left:20px;display:grid;gap:4px">
        <li>A shared run is a link: a version, the course name <code>${esc(courseHash(course))}</code> (FNV-1a, 32 bits, of the course file without its stored line), a nick and the key log. This course's log, packed: ${link.length} characters for ${orig.ticks} ticks.</li>
        <li>The link holds no hash of the run. The game plays the keys again from the start with the same simulator, and the time it reports is the time the simulator got, never a number written in the link.</li>
        <li>Why the keys and not the states: the simulator is deterministic, so the keys already decide every state. A state hash would add characters and no information.</li>
        <li>Why a short course hash: it only has to tell apart the few courses of one game, and a changed course makes old keys meaningless. At 32 bits, ${COLLISION_TABLE.slice(0, 2).map((k) => `${k} courses collide with chance ${pct(collisionProb(32, k))}`).join(" and ")}.</li>
        <li>The golden files in the tests use the opposite pattern: SHA-256 of a result, cut to 16 hex digits. A search that gets faster must give the same plans, so any one changed tick changes the digest, and the test fails at once.</li>
      </ul>`;
  };

  // ---- start ----
  void (async () => {
    try {
      course = (await (await fetch(COURSE_URL)).json()) as CourseData;
      const rec = recordPlan(course, course.plan!, 120 * 120);
      orig = playLog(course, rec.recorder.snapshot());
      const masks = expand(orig.log), jump = maskOfKey("jump");
      tick = Math.max(0, masks.findIndex((m) => (m & jump) !== 0));
      const slider = $<HTMLInputElement>("lh-tick");
      slider.max = String(masks.length - 1); slider.value = String(tick);
      $("lh-ticks").textContent = String(masks.length - 1);
      buildOptions(); update();
      labDefaultNote(wrap, "live", $("lh-h1"));
      $<HTMLButtonElement>("lh-aval").click(); // CC-118: the avalanche runs on open (every hash, every bit of the key log)
      await paintOurs();
      labPopulated("lab-hashing");
    } catch (e) {
      $("lh-facts").textContent = "The course did not load: " + String(e);
    }
  })();
  buildOptions();
  return { backend: "canvas2d" };
}
