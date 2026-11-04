import { readGlbMesh } from "../../slice/glb";
import type { Mesh } from "../../slice/slice";
import { COLLIDERS, OBJECTS, SNAP, TOP_TOLERANCE, bounds, colliderFor, trial, type ColliderKind, type Played, type Trial } from "./skin-collider";

// "Skin versus collider" card. A real lifted object is drawn with its collider on top; one ball is rolled over the lift and over the same photo lifted again.
// Every number comes from skin-collider.ts (the same code the tests run). Nothing here talks or grades.
const INK = "#17201d", TEAL = "#0f6b5c", ORANGE = "#d9741a", GREY = "#9aa5a0", RED = "#b91c1c", BLUE = "#5b7fa6";
const W = 1100, H = 300;
const NOTE: Record<ColliderKind, string> = { skin: "", decimated: "", "box-exact": "exact bounds move with every lift", "box-snapped": "sides rounded to the 5 cm cell", "box-big": "same run, but the top sits a metre too high" };

export function mountSkinCollider(wrap: HTMLElement, onReady: () => void): void {
  const $ = <T extends HTMLElement>(id: string): T => wrap.querySelector("#" + id) as T;
  const meshes = new Map<string, Mesh>(), cache = new Map<string, Trial>();
  let obj = OBJECTS[0].id, mode: "skin" | "collider" = "skin", detail = 600, tick = 0, pick: ColliderKind | null = null, token = 0;
  let cur: Trial | null = null, skinTris = 0;
  const n0 = (v: number) => v.toLocaleString();

  const key = (k: ColliderKind, d: number) => `${obj}|${k}|${k === "decimated" ? d : 0}`;
  const run = (k: ColliderKind, d: number): Trial => { const id = key(k, d); let t = cache.get(id); if (!t) { t = trial(meshes.get(obj)!, k, d); cache.set(id, t); } return t; };

  function draw() {
    const c = $<HTMLCanvasElement>("lskin-cv"), g = c.getContext("2d")!, skin = meshes.get(obj)!, fr = bounds(skin);
    g.clearRect(0, 0, W, H);
    const axis = fr.hi[0] - fr.lo[0] >= fr.hi[2] - fr.lo[2] ? 0 : 2, x0 = fr.lo[axis] - 0.4, x1 = fr.hi[axis] + 0.5, y0 = -0.15, y1 = fr.hi[1] + 0.8;
    const sc = Math.min((W - 24) / (x1 - x0), (H - 24) / (y1 - y0)), px = (x: number) => 12 + (x - x0) * sc, py = (y: number) => H - 12 - (y - y0) * sc;
    g.fillStyle = "#e6ece7"; g.fillRect(0, py(0), W, H); // the ground
    const edges = (m: Mesh, colour: string, w: number, a: number) => {
      g.strokeStyle = colour; g.lineWidth = w; g.globalAlpha = a; g.beginPath();
      const p = m.positions, I = m.indices ?? [];
      for (let t = 0; t + 2 < I.length; t += 3) for (let k = 0; k < 3; k++) { const a1 = I[t + k] * 3, b1 = I[t + (k + 1) % 3] * 3; g.moveTo(px(p[a1 + axis]), py(p[a1 + 1])); g.lineTo(px(p[b1 + axis]), py(p[b1 + 1])); }
      g.stroke(); g.globalAlpha = 1;
    };
    edges(skin, BLUE, 0.5, 0.35); // the skin, always
    if (cur) {
      const col = colliderFor(mode === "skin" ? "decimated" : "box-snapped", skin, detail);
      if (mode === "skin") edges(col, ORANGE, 1, 0.9);
      else { const b = bounds(col); g.strokeStyle = ORANGE; g.lineWidth = 3; g.strokeRect(px(b.lo[axis]), py(b.hi[1]), (b.hi[axis] - b.lo[axis]) * sc, (b.hi[1] - b.lo[1]) * sc); }
      const path = (p: Played, colour: string, dash: number[]) => {
        g.strokeStyle = colour; g.lineWidth = 2.5; g.setLineDash(dash); g.beginPath();
        p.xs.forEach((x, i) => { const X = px(x), Y = py(p.ys[i]); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.stroke(); g.setLineDash([]);
        const i = Math.min(tick, p.xs.length - 1); g.beginPath(); g.arc(px(p.xs[i]), py(p.ys[i]), 0.1 * sc, 0, 7); g.fillStyle = colour; g.globalAlpha = 0.55; g.fill(); g.globalAlpha = 1;
      };
      path(cur.b, RED, [6, 4]); path(cur.a, TEAL, []);
    }
  }

  function facts() {
    if (!cur) return;
    const rows = [["First lift", cur.a], ["The same photo, lifted again", cur.b]] as [string, Played][];
    $("lskin-facts").innerHTML = rows.map(([n, p]) => `<tr><td>${n}</td><td>${n0(p.tris)}</td><td>${n0(p.checks)}</td><td>${p.snags}</td><td>${p.jitter.toFixed(2)}</td><td><code>${p.hash}</code></td><td>${p.finished ? "yes" : p.fell ? "fell" : "stuck"}</td></tr>`).join("");
    $("lskin-verdict").innerHTML = cur.same
      ? `<span class="good">The same run, tick for tick.</span> The ball does not know the photo was lifted twice.`
      : `<span class="bad">A different run.</span> The two lifts differ by 5 mm, and the ball felt it: ${cur.a.snags + cur.b.snags} snag${cur.a.snags + cur.b.snags === 1 ? "" : "s"}, a new hash.`;
    $("lskin-cost").textContent = `Cost of one run: ${n0(cur.tris)} triangles x ${cur.a.ticks} ticks = ${n0(cur.a.checks)} checks.`;
    const tk = $<HTMLInputElement>("lskin-tick"); tk.max = String(Math.max(cur.a.ticks, cur.b.ticks) - 1); tick = Math.min(tick, Number(tk.max)); tk.value = String(tick);
  }

  function table() {
    const mine = pick;
    $("lskin-all").innerHTML = COLLIDERS.map((c) => {
      const t = cache.get(key(c.kind, c.kind === "decimated" ? 600 : 0)); const nm = c.kind === "decimated" ? "A thinner skin (600 triangles)" : c.name;
      if (!t) return `<tr><td>${nm}</td><td colspan="5" class="small">working it out...</td></tr>`;
      return `<tr class="${mine === c.kind ? "cur" : ""}"><td>${nm}</td><td>${n0(t.tris)}</td><td>${t.same ? '<span class="good">same</span>' : '<span class="bad">different</span>'}</td><td>${t.topErr.toFixed(3)} m</td><td>${t.ok ? '<span class="good">keeps the run</span>' : `<span class="bad">no</span>`}</td><td class="small">${NOTE[c.kind]}</td></tr>`;
    }).join("");
  }

  async function fill() { // the five colliders for the challenge table, one per turn of the event loop so the page stays alive
    const my = ++token;
    for (const c of COLLIDERS) { if (my !== token) return; run(c.kind, 600); table(); await new Promise((r) => setTimeout(r, 0)); }
  }

  function refresh() {
    $("lskin-credit").textContent = OBJECTS.find((o) => o.id === obj)!.credit;
    $("lskin-det-row").hidden = mode !== "skin";
    $("lskin-det-v").textContent = detail >= skinTris ? `all ${n0(skinTris)}` : n0(detail);
    cur = run(mode === "skin" ? "decimated" : "box-snapped", detail);
    facts(); draw(); table();
  }

  async function load(id: string) {
    obj = id;
    if (!meshes.has(id)) meshes.set(id, readGlbMesh(await fetch(OBJECTS.find((o) => o.id === id)!.url).then((r) => r.arrayBuffer())));
    skinTris = Math.floor(meshes.get(id)!.indices!.length / 3);
    const d = $<HTMLInputElement>("lskin-det"); d.max = String(skinTris); detail = Math.min(detail, skinTris); d.value = String(detail);
    pick = null; $("lskin-result").textContent = ""; tick = 0;
    refresh(); void fill();
  }

  $("lskin-obj").innerHTML = OBJECTS.map((o) => `<option value="${o.id}">${o.name}</option>`).join("");
  $("lskin-pick").innerHTML = COLLIDERS.map((c) => `<label style="display:flex;gap:6px;align-items:center;margin:4px 0"><input type="radio" name="lskin-p" value="${c.kind}"> ${c.name}</label>`).join("");
  $("lskin-obj").addEventListener("change", () => void load(($("lskin-obj") as HTMLSelectElement).value));
  wrap.querySelectorAll<HTMLInputElement>("input[name=lskin-m]").forEach((r) => r.addEventListener("change", () => { mode = r.value as "skin" | "collider"; tick = 0; setTimeout(refresh, 10); }));
  $("lskin-det").addEventListener("input", () => { $("lskin-det-v").textContent = n0(Number(($("lskin-det") as HTMLInputElement).value)); });
  $("lskin-det").addEventListener("change", () => { detail = Number(($("lskin-det") as HTMLInputElement).value); setTimeout(refresh, 10); });
  $("lskin-tick").addEventListener("input", () => { tick = Number(($("lskin-tick") as HTMLInputElement).value); draw(); });
  wrap.querySelectorAll<HTMLInputElement>("input[name=lskin-p]").forEach((r) => r.addEventListener("change", () => { pick = r.value as ColliderKind; }));
  $("lskin-check").addEventListener("click", () => {
    if (!pick) { $("lskin-result").innerHTML = "Pick one first."; return; }
    const t = run(pick, 600), why = !t.same ? "the run changed when the photo was lifted again" : !t.a.finished ? "the ball did not get across" : t.topErr > TOP_TOLERANCE ? `the top is ${t.topErr.toFixed(2)} m from the skin's top` : "";
    $("lskin-result").innerHTML = t.ok ? `<span class="good">Yes: this collider keeps the run identical</span> (hash <code>${t.a.hash}</code> both times, top within ${TOP_TOLERANCE * 100} cm).` : `<span class="bad">No:</span> ${why}.`;
    table();
  });
  load(obj).catch((e) => { $("lskin-verdict").textContent = `Could not load the object: ${e}`; }).finally(onReady);
  void SNAP; void INK; void GREY;
}
